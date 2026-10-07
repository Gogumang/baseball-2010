import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import { isPitchInHitByPitchBox } from '@/entities/pitching/model/hitByPitch'
import { swingResultOf } from '@/entities/batting/model/swingResult'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import { pitcherBoostSideOf, swingBoostOf } from '@/entities/batting/model/swingBoost'
import { remainingAfterSpecialSwing, rollSpecialSwing } from '@/entities/batting/model/specialSwing'
import { timingOf } from '@/entities/batting/model/swingTiming'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { contactOfPattern, drawScenePattern, launchPatternOf } from '@/entities/batting/model/battedBallOutcome'
import { provisionalOutcomeOf, registerContact, type BattedContact } from '@/entities/batting/model/battedContact'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { Coordinate } from '@/shared/lib/geometry/coordinate'
import {
  battingPatternChoiceOf,
  battingPatternOdds,
} from '@/shared/config/original/battingPatterns'

/**
 * 투수편에서 상대 타자를 대신 판단한다.
 *
 * 휘두를지는 **원본 확률표 battingPattern.arr**(0x34334) 이 정한다 — 볼카운트·아웃·주자로
 * 고른 행에서 치기/번트/지켜보기를 뽑고, 공이 존 밖이면 "쫓아갈지" 를 한 번 더 굴린다.
 * 히트가 높을수록 존 밖 공을 덜 쫓는다 (원본 문턱 250 − h/4 · 2000 − 3h/2).
 */

/**
 * 0x34334 가 보는 상황. 원본은 경기 state 에서 바로 읽는다 —
 * state[+4] 스트라이크 · state[+5] 볼 · state[+6] 아웃 · 주자 수 0xa9599(scene[+0x20c]).
 * 주자는 u8 로 잘라 0 인가 아닌가만 본다.
 */
export interface BatterSituation {
  readonly strikes: number
  readonly balls: number
  readonly outs: number
  readonly hasRunner: boolean
}

/**
 * 아직 상황을 넘겨주지 않는 부르는 곳이 쓰는 자리표시 — 무사 0-0 주자 없음.
 * ⚠️ 원본에 이런 기본값은 없다. 이 값이 쓰이면 그 자리는 배선이 덜 된 것이다.
 */
const UNWIRED_SITUATION: BatterSituation = {
  strikes: 0,
  balls: 0,
  outs: 0,
  hasRunner: false,
}

/**
 * 공 도착점 구역 0x341ec — 0·1 존 안 · 2 존을 사방 20px 넓힌 띠 · 3 그 밖.
 * 원본은 화면 픽셀로 잰다: 존 = (226,310,33,33) (0xcfb7c), 띠 = 사방 +20.
 * 웹 존 좌표는 존 반폭(16.5px)이 1 이므로 띠 경계는 (16.5+20)/16.5 이다.
 * (0 = 한가운데 16×16 은 여기서 1 과 똑같이 다루므로 나누지 않는다 — 둘 다 "무조건 진행")
 */
const NEAR_ZONE_LIMIT = (16.5 + 20) / 16.5

function swingZoneOf(plate: Coordinate): number {
  if (isInsideStrikeZone(plate)) return 1
  if (Math.abs(plate.x) <= NEAR_ZONE_LIMIT && Math.abs(plate.y) <= NEAR_ZONE_LIMIT) return 2
  return 3
}

/** 0 으로 자르는 나눗셈 (원본 `asrs` 앞의 음수 보정과 같다) */
function truncated(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value)
}

/** 0x34334 가 휘두르기로 정한 뒤의 갈래 — 표에서 뽑은 choice 0(치기)·1(번트) */
export type CpuSwingChoice = '치기' | '번트'

/**
 * CPU 타자가 휘두르는가, 휘두른다면 표에서 무엇을 뽑았나 — 원본 0x34334
 * (사람이 투구할 때만 도는 길, 부르는 곳 0x51f26). 지켜보면 null.
 *
 * ```
 * choice = 0x9f224(0x9f190(pat, S, B, O, 주자))   ; rand(0,100) 한 번
 *   r < c0 → 0 치기 · r < c0+c1 → 1 번트 · 그 밖 2 지켜보기
 * if choice >= 2: 끝                              ; 지켜보기
 * zone = 0x341ec(공 도착점)
 * if zone == 3 and rand(0,10000) >  250 − h/4  : 끝
 * if zone == 2 and rand(0,10000) > 2000 − 3h/2 : 끝
 * → 그 밖에는 휘두른다
 * ```
 * 난수는 **표 뽑기 한 번은 늘**, **존 밖이고 휘두를 마음이 있을 때만 한 번 더** 돈다.
 *
 * **실투**(0x33cbc → `[+0xf98].byte8`, `mistakePitch.ts`)면 표 굴림 **뒤에** choice 를 0(치기)으로
 * 덮는다 (0x34376~0x3438e). 표 굴림은 그대로 하고, 존 밖이면 쫓아가기 굴림도 그대로 한다 —
 * 실투가 "무조건 휘두른다" 는 뜻은 아니다.
 *
 * h 는 **경기용 히트** `0xb570d(ctx=0xb8681(팀), 0, 타자, 1, 90, 1)` 다 (0x343be~0x343d4 —
 * 지켜보기면 부르지 않는다). 셋째 인자 1 은 보정 적용, 다섯째 90 은 체력 인자라 피로 감소가 없다
 * (P7 G1) — 장비·스킬·질병·부상·사기·팀 보정이 붙은 값이다. 이 모듈은 넘겨받은 `ability.hit` 를
 * 그 값으로 믿는다: 타이밍 0x340f8 도 같은 식으로 다시 부른다(0x3413e).
 * ⚠️ 부르는 쪽이 날 레코드 히트를 넘기면 원본과 달라진다 (`pitchAgainstBatter` 주석 참고).
 */
export function cpuSwingChoiceOf(
  pitch: Pitch,
  ability: BatterAbility,
  random: RandomPort,
  situation: BatterSituation = UNWIRED_SITUATION,
  isMistakePitch = false,
): CpuSwingChoice | null {
  const odds = battingPatternOdds(
    situation.strikes,
    situation.balls,
    situation.outs,
    situation.hasRunner,
  )
  // 0x9f224 — rand(0,100), 위끝 제외
  const drawn = battingPatternChoiceOf(odds, randomIntegerBelow(random, 0, 100))
  // 0x34376 — 실투면 뽑은 것을 버리고 0(치기)
  const choice = isMistakePitch ? '치기' : drawn
  if (choice === '지켜보기') return null

  const zone = swingZoneOf(pitch.plate)
  // 히트가 높을수록 덜 쫓는다. 원본 비교는 `rand > 문턱` 이면 그만둔다 = 같으면 쫓는다.
  if (zone === 3 && randomIntegerBelow(random, 0, 10000) > 250 - truncated(ability.hit / 4)) return null
  if (zone === 2 && randomIntegerBelow(random, 0, 10000) > 2000 - truncated((ability.hit * 3) / 2)) {
    return null
  }
  return choice
}

/** CPU 타자가 휘두르는가 — `cpuSwingChoiceOf` 에서 치기·번트를 가리지 않은 것 */
export function willSwing(
  pitch: Pitch,
  ability: BatterAbility,
  random: RandomPort,
  situation: BatterSituation = UNWIRED_SITUATION,
  isMistakePitch = false,
): boolean {
  return cpuSwingChoiceOf(pitch, ability, random, situation, isMistakePitch) !== null
}

/** 0x3445a — 번트 종류 rand(1,4) → 1·2·3 (사람 번트 키 '8'=1 · '7'=2 · '9'=3 과 같은 칸 +0xfdc) */
const BUNT_KIND_MINIMUM = 1
const BUNT_KIND_LIMIT = 4

/**
 * 휘두르기로 정한 뒤 번트 종류 — 원본 0x34446~0x34464 (타이밍 0x340f8 **다음**에 돈다).
 *
 * ```
 * scene[+0xfdc] = 0
 * if choice == 1 and not 0xb633d(타자): scene[+0xfdc] = rand(1,4)   ; 번트 1~3
 * ```
 * 마선수(0xb633d = 레코드 [10] 비트6)는 번트 칸을 뽑아도 번트하지 않고 그냥 친다.
 * 난수는 번트할 때만 한 번 돈다. 0 이면 보통 스윙이다.
 */
export function cpuBuntKindOf(choice: CpuSwingChoice, isMagicBatter: boolean, random: RandomPort): number {
  if (choice !== '번트' || isMagicBatter) return 0
  return randomIntegerBelow(random, BUNT_KIND_MINIMUM, BUNT_KIND_LIMIT)
}

/** 0x34468 의 마타자 필살 판단에 드는 값 */
export interface CpuSpecialSwingInput {
  /** 마선수인가 (0xb633d = 선수 레코드 [10] 비트6) */
  readonly isMagicBatter: boolean
  /** 고른 필살 번호 — 선수 +0x18 (u8). 0 이면 안 고른 것 */
  readonly swingNumber: number
  /** 이 경기 남은 횟수 — s8 팀[+0x29 + 타순(+0x32)] */
  readonly remaining: number
}

/**
 * CPU 타자의 이번 스윙 필살 번호 (`[scene+0xf9c]+0x10`) — 원본 0x34442~0x34488. 0 이면 보통 스윙.
 *
 * ```
 * 34444  [+0xf9c][+0x10] = 0                                  ; 새 공마다 지운다
 * 34446  if choice == 1 and not 0xb633d(타자): 번트 (필살 없음)
 * 34468  elif 0xb633d(타자) and 0xaea30(팀) != 0:
 * 34488      [+0xf9c][+0x10] = 타자[+0x18]
 * 0xaea30(팀) = 타자[+0x18] == 0 ? 0 : s8 팀[+0x29 + 팀[+0x32]]
 * ```
 * 즉 **마타자는 휘두를 때마다, 번호가 있고 남은 횟수가 0 이 아니면 무조건 필살**이다 —
 * 번트 칸을 뽑아도 필살 스윙이다. 일반 CPU 타자는 번호가 있어도 절대 쓰지 않는다
 * (S+0x10 에 CPU 가 쓰는 곳은 여기 하나, Q1 5절). 난수는 쓰지 않는다.
 *
 * `pitchAgainstBatterDetailed` 가 이 값을 잇는다 — 보정 구조체 0x34d6c 타자 쪽(마타자 레벨 표),
 * 스윙 순간 소모 0x4e136, 맞은 공의 성공 굴림 0x34c74(마타자 30%).
 */
export function cpuSpecialSwingNumberOf(input: CpuSpecialSwingInput): number {
  // 일반 타자는 번트든 치기든 0, 마타자는 번트 갈래(0x34446)로 안 가니 표 선택과 무관하다
  if (!input.isMagicBatter) return 0
  if (input.swingNumber === 0) return 0
  return input.remaining !== 0 ? input.swingNumber : 0
}

/** 부르는 쪽이 넘기는 CPU 타자의 성질 */
export interface CpuBatterTraits {
  /** 마선수인가 (0xb633d = 선수 레코드 [10] 비트6) — 마선수는 번트하지 않는다 */
  readonly isMagicBatter?: boolean
  /**
   * 이 공이 실투인가 — 투구 순간 0x33cbc(`isMistakePitch`)가 정한 값. 부르는 쪽이 궤적을 만든 뒤
   * (0x4dea0 은 궤적 준비 0x9e669 다음) 이 함수보다 **먼저** 굴려 넘긴다.
   * 참이면 표 선택이 치기로 강제되고 타이밍이 늘 d = 0 이다.
   */
  readonly isMistakePitch?: boolean
  /**
   * 마타자 필살 (0x34468~0x34488). `isMagicBatter` 일 때만 본다. 안 넘기면 필살을 쓰지 않는다(예전 동작).
   *   swingNumber = 선수 +0x18 (마타자 5~9) · remaining = 이 경기 남은 횟수 s8 팀[+0x29 + 타순]
   *   aceOrder·aceLevel = 0x34d6c 의 k = 레벨·5 + 순번 (`mgr[0x13f + 순번]`)
   */
  readonly specialSwing?: {
    readonly swingNumber: number
    readonly remaining: number
    readonly aceOrder?: number
    readonly aceLevel?: number
  }
  /**
   * 0x34d6c 투수 쪽 — 사람 투수의 공에 실린 마구(`pitch.magicNumber` = P+0x10)를 볼 때 마투수 레벨.
   * 공에 번호가 없으면(사용자 투구는 아직 안 실음) 쓰이지 않는다.
   */
  readonly pitcherAceLevel?: number
  /**
   * 판정 모드 (0x1552d10 묶음) — 투수편(모드 3) '나만의리그' · 투수 미션(모드 5) '투수미션' · 팀 경기 '일반'.
   * 넘기면 이 타석의 수비 팀이 사람이라는 것도 함께 판정에 싣는다 — 모드 3·4 밖이면 hit·power 쪽 −10
   * (0xab5c0, state[0x31 + 수비] == 0). **안 넘기면 예전처럼 '일반' 이고 팀 조작 보정을 하지 않는다.**
   */
  readonly swingMode?: SwingMode
  /** 던지는 사람 투수가 육성·명전(비트7)인가 — 나리 보너스(모드 3)·투수 미션 +100(모드 5). 안 넘기면 거짓 */
  readonly isPitcherOwnPlayer?: boolean
  /** 나리 연차 idx (저장 레코드 +0xb3) — 투수 보너스 400 − 40 × 연차. 안 넘기면 0 */
  readonly careerYearIndex?: number
  /**
   * **파울 각 공도 수비 판으로 돌리는가** — 원본은 맞은 공이면 파울 각이라도 판(상태 0x17)을 돌아 낙구 · 담장선 틱에 0x9d5bc 가 7 을
   * 내야 파울이고, 그 전에 잡히면 뜬공 아웃(13)이다. 참이면 파울 각 공을 `foulContact` 로 돌려주고 필살타법 굴림(0x517e6)도
   * 판 시작에 맡긴다. 안 넘기면 예전처럼 여기서 곧장 파울로 끝낸다(판을 아직 안 잇는 부르는 쪽 — 웹 근사).
   */
  readonly playsFoulBall?: boolean
}

/** `pitchAgainstBatterDetailed` 의 결과 — 필살 칸을 부르는 쪽에 돌려준다 */
export interface CpuPitchOutcome {
  readonly resolution: PitchResolution
  /** 이번 스윙이 필살인가 (S+0x10 ≠ 0) */
  readonly isSpecialSwing: boolean
  /**
   * 스윙 뒤 남은 필살 횟수 — 0x4e136 이 스윙 틱에 −1 한 값. 필살을 안 썼으면 넘겨받은 값 그대로,
   * `traits.specialSwing` 을 안 넘겼으면 null.
   */
  readonly specialSwingRemaining: number | null
  /** 필살 성공 — 0x517e6 이 필살타법 표시(공 속성 4)를 단 타구 (야수가 쥐지 못한다). 판을 도는 공은 판 시작이 굴려 늘 거짓이다 */
  readonly isUncatchable: boolean
  /**
   * 판을 돌 파울 각 공(`traits.playsFoulBall`) — 쏜 패턴 · 결과 코드 · 필살 스윙 재료. 부르는 쪽이 이것으로 수비 판을 돌리고,
   * 판이 파울로 닫히면(`DefensePlayResult.foulEnded`) 그제야 스트라이크를 올린다(0x35108 → 0xb6b58).
   */
  readonly foulContact?: BattedContact
}

/** 스윙 프레임 F = N − 2 + d — d = 0 이 타이밍 100 이다 (0x34be0) */
const SWEET_FRAME_OFFSET = 2
/** 0x340f8 — K = h/4 + 2900 (0xb54) */
const TIMING_BASE = 2900
/** 0x340f8 — 실투면 K = 10000 (0x2710) 이라 첫 굴림이 늘 통과한다 */
const MISTAKE_TIMING_K = 10000
/** 0x340f8 — 두 번째 문턱 K × 19 / 10 */
const SECOND_TIMING_NUMERATOR = 19
const SECOND_TIMING_DENOMINATOR = 10
/** 표 0xcfd84 · 0xcfd88 · 0xcfd8c (s8, 앞 2·2·3 칸만 쓴다) */
const TIMING_OFFSETS_EXACT: readonly number[] = [0, 0]
const TIMING_OFFSETS_LATE: readonly number[] = [0, 1]
const TIMING_OFFSETS_WIDE: readonly number[] = [0, 1, -1]

/**
 * CPU 타자의 스윙 프레임 어긋남 d — 원본 0x340f8 (0x34334 가 휘두르기로 정한 뒤 바로 부른다).
 *
 * ```
 * K = h/4 + 2900                     ; h 음수면 (h+3)>>2 = 0 쪽 버림
 * if 실투(+0xf98.byte8 ≠ 0): K = 10000
 * if   rand(0,10000) < K        : d = [0,0][rand(0,2)]       ; 늘 0
 * elif rand(0,10000) < K*19/10  : d = [0,1][rand(0,2)]
 * else                          : d = [0,1,−1][rand(0,3)]
 * F = N − 2 + d
 * ```
 * 난수는 **첫 갈래 2번, 나머지 3번** 돈다 — 첫 갈래의 표가 [0,0] 이라 결과는 늘 0 이지만 굴림은 한다.
 * 히트 영향은 아주 작다 (h=0 이면 d=0 59.2% · +1 30.2% · −1 10.6%).
 */
export function cpuSwingTimingOffsetOf(hit: number, random: RandomPort, isMistakePitch = false): number {
  const k = isMistakePitch ? MISTAKE_TIMING_K : truncated(hit / 4) + TIMING_BASE
  if (randomIntegerBelow(random, 0, 10000) < k) {
    return TIMING_OFFSETS_EXACT[randomIntegerBelow(random, 0, TIMING_OFFSETS_EXACT.length)]
  }
  const second = truncated((k * SECOND_TIMING_NUMERATOR) / SECOND_TIMING_DENOMINATOR)
  if (randomIntegerBelow(random, 0, 10000) < second) {
    return TIMING_OFFSETS_LATE[randomIntegerBelow(random, 0, TIMING_OFFSETS_LATE.length)]
  }
  return TIMING_OFFSETS_WIDE[randomIntegerBelow(random, 0, TIMING_OFFSETS_WIDE.length)]
}
/** 투수편 투수 능력치를 아직 넘겨받지 않아 쓰는 기본값 (추정) */
const DEFAULT_PITCHER_STATS = { control: 500, velocity: 500 }

/**
 * 투수편 한 구의 결과. 플레이어가 던지고 타자는 자동으로 반응한다.
 * 휘두른 뒤는 타자편과 같은 원본 스윙 결과(0xab214) → 방향 → 타구 패턴 → 대체 근사를 쓴다.
 * 휘두를지는 원본 0x34334(battingPattern.arr) 그대로다 — `cpuSwingChoiceOf` 참고.
 * **언제** 휘두를지는 원본 0x340f8 — `cpuSwingTimingOffsetOf` 참고.
 * 표에서 번트 칸이 뽑히면 타이밍 뒤에 rand(1,4) 로 번트 종류를 정한다 (`cpuBuntKindOf`, 마선수 제외).
 *
 * `batter` 는 **경기용 능력치**(0xb570c/0xb570d, 체력 인자 90)여야 한다 — 쫓아가기 문턱과
 * 타이밍 K 가 그 히트를 본다. 팀 경기는 `entryBatterGameAbilities`, 투수편은 `opponentBatterAbility`
 * (모드 3 `gameAbilityOf`), 투수 미션은 모드 5 `gameAbilityOf` 값을 넘긴다.
 * 미션 마타자는 부르는 쪽(`useMissionSession` 의 `missionOpponentAbility`)이 레벨 배율(0xb6414 의
 * 0xd88aa[`mgr[0x13a+칸]`])을 먼저 곱해 넘긴다 — 레벨은 전역 저장(`useAceLevels`)이고 스페셜 마선수
 * 레벨업(0x5fb24)이 올린다. ⚠️ 로스터 스킬 보정(0xb6414 플래그 1)은 아직 못 붙인다 (부르는 쪽 주석).
 */
export function pitchAgainstBatter(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: { readonly control: number; readonly velocity: number } = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
  traits: CpuBatterTraits = {},
): PitchResolution {
  return pitchAgainstBatterDetailed(pitch, batter, random, pitcher, situation, traits).resolution
}

/**
 * `pitchAgainstBatter` 에 마타자 필살 칸을 더 돌려준다. 원본 차례:
 * ```
 * 0x34334  표 굴림 → (존 밖이면) 쫓기 굴림 → 0x340f8 타이밍 굴림 → 번트 종류 굴림 → S+0x10 (난수 없음)
 * 0x4e136  스윙 틱: S+0x10 ≠ 0 && 남은 > 0 이면 남은 − 1
 * 0x51294  0x34d6c 보정 구조체 → 0xab214 (번트 r100 · contact · B · C · 15/18)
 *          헛스윙이면 여기서 끝 (0x5135c → 0x51840)
 * 0x51430~ 방향 · 타구 패턴
 * 0x517e6  S+0x10 ≠ 0 이면 0x34c74 의 p(마타자 30) 로 p·10 > rand(0,1000)
 *          ── 그 뒤 수비 판(상태 0x17)이 안타·아웃을 낸다 (`features/defense-play`)
 * ```
 */
export function pitchAgainstBatterDetailed(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: { readonly control: number; readonly velocity: number } = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
  traits: CpuBatterTraits = {},
): CpuPitchOutcome {
  const isMistake = traits.isMistakePitch === true
  const remainingBefore = traits.specialSwing?.remaining ?? null
  const unswung = (resolution: PitchResolution): CpuPitchOutcome => ({
    resolution,
    isSpecialSwing: false,
    specialSwingRemaining: remainingBefore,
    isUncatchable: false,
  })
  const choice = cpuSwingChoiceOf(pitch, batter, random, situation, isMistake)
  if (choice === null) {
    // 사구가 볼·스트라이크보다 먼저다 — 상태 0x12 진입 0x3dfac 가 0x35a20 을 맨 먼저 불러 state[0x12] 에
    // 넣고(0x3dfc0~0x3dfc8), 투구 판정 0x9d57c 가 그 칸을 첫머리(0x9d582)에서 봐 곧장 4 를 돌려준다.
    // 사람 타석과 같은 함수·같은 경로다 — 0x3dfac 의 부르는 곳은 경기 장면 진입표 0xd04bc 의 0x52d28 하나뿐이고
    // 누가 치는지 가르지 않는다. 지켜보기면 0x34334 가 스윙 예약(scene+0xfe0 = 1, 0x34420)을 안 하므로
    // 스윙(0x4e0e0~ 의 vtable +0x14/+0x18)이 안 나가 스윙 객체 +0xd·+0xe 가 0 이다 → 상자 판정까지 간다.
    // 좌타 뒤집기는 0xb63c0(현재 타자)이고, 화면 배치 side(+0x17e1)는 타석 시작 0x3b084 가 같은
    // 0xb63c1(타자)로 정한 값이라 둘이 같다 — 웹 CPU 타자는 손 정보가 없어 `pitch.stageSide` 를 쓴다.
    if (isPitchInHitByPitchBox(pitch, pitch.stageSide)) return unswung({ kind: '사구' })
    return unswung(isInsideStrikeZone(pitch.plate) ? { kind: '스트라이크', isSwinging: false } : { kind: '볼' })
  }

  // 원본 0x34334 → 0x340f8: F = N − 2 + d
  const frame = pitch.frameCount - SWEET_FRAME_OFFSET + cpuSwingTimingOffsetOf(batter.hit, random, isMistake)
  // 0x3445a — 타이밍 굴림 **뒤**에 번트 종류
  const buntKind = cpuBuntKindOf(choice, traits.isMagicBatter === true, random)
  // 0x34468~0x34488 — 마타자는 남은 횟수가 있으면 무조건 필살 (난수 없음)
  const special = traits.specialSwing
  const specialNumber =
    special === undefined
      ? 0
      : cpuSpecialSwingNumberOf({
          isMagicBatter: traits.isMagicBatter === true,
          swingNumber: special.swingNumber,
          remaining: special.remaining,
        })
  const isSpecialSwing = specialNumber !== 0
  // 0x4e136 — 스윙 틱에 소모 (결과와 무관)
  const remainingAfter =
    remainingBefore === null ? null : isSpecialSwing ? remainingAfterSpecialSwing(remainingBefore) : remainingBefore
  // 0x34d6c — 타자 쪽은 S+0x10, 투수 쪽은 공+0x10 (사람 투수 공에 마구가 실렸을 때만)
  const boost = swingBoostOf(
    {
      number: specialNumber,
      // 일반 CPU 타자는 S+0x10 을 쓰지 않으므로(0x34488 만 쓴다) 필살 번호가 있으면 마타자다
      isAce: true,
      aceOrder: special?.aceOrder ?? 0,
      aceLevel: special?.aceLevel ?? 0,
      isOwnPlayer: false,
    },
    pitcherBoostSideOf(pitch.magicNumber ?? 0, pitch.pitcherMagicNumber ?? 0, () => traits.pitcherAceLevel ?? 0),
  )
  const result = swingResultOf(
    {
      horizontalError: Math.round(pitch.plate.x * ZONE_HALF_PIXELS),
      verticalError: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
      timing: timingOf(frame, pitch.frameCount, false),
      buntKind,
      controlTier: pitch.controlTier,
      batter,
      pitcher,
      mode: traits.swingMode ?? '일반',
      isPitcherOwnPlayer: traits.isPitcherOwnPlayer,
      careerYearIndex: traits.careerYearIndex,
      // 사람이 던지고 CPU 가 치는 타석 — 모드를 넘겨받았을 때만 팀 조작 보정을 싣는다
      isOffenseHuman: false,
      isDefenseHuman: traits.swingMode !== undefined,
      boost,
      isPitcherExhausted: false,
      batterSkillIds: [],
      pitcherSkillIds: [],
      // 0xab214 는 투수·타자 레코드로 손(0xb63c0)·칸(0xb6394)을 바로 읽는다. 투수 손은 공에 실린 폼·+0x18 로,
      // 타자 손은 화면 배치(`stageSide` = 0x3b084 의 0xb63c1(타자))로 둔다. 타자 레코드 칸(스킬 31)은 몰라 0 이다.
      // ⚠️ 지금은 두 스킬 목록이 비어 있어(CPU 타자·사람 투수 스킬 비트 미이식) 이 상황이 결과를 바꾸지 않는다
      situation: { ...NEUTRAL_SITUATION, pitcherSide: pitcherHandOfPitch(pitch), batterSide: pitch.stageSide },
    },
    random,
  )
  const swung = (resolution: PitchResolution, isUncatchable: boolean): CpuPitchOutcome => ({
    resolution,
    isSpecialSwing,
    specialSwingRemaining: remainingAfter,
    isUncatchable,
  })
  // 헛스윙은 0x5135c → 0x51840 — 필살 굴림이 없다
  if (result.kind === '헛스윙') return swung({ kind: '스트라이크', isSwinging: true }, false)

  const code = result.code + hitDirectionOf({ code: result.code, frame, frameCount: pitch.frameCount, batterSide: 0 }, random)
  // 0x51490 — 사람 타석과 같은 장면 덱(0x3e340 이 경기 시작에 연 하나, `openScenePatternDeck`)에서 꺼낸다.
  // 장면을 열지 않은 호출(시험 · 옛 길)만 덱 없이 한 장을 굴린다(`drawScenePattern`)
  const drawn = drawScenePattern(code, random)
  // 0x514f2 — 코드 25·26 의 2% 특수 타구 표
  const pattern = launchPatternOf(code, drawn, random)
  // 파울 각만 여기서 가른다 — 페어 타구의 안타·아웃은 수비 판이 낸다(`battedBallOutcome.contactOfPattern` 머리말).
  // 2스트라이크 번트 파울은 아웃 (0x9d5e2) — 사람 타석(resolvePitch)과 같은 판정이다
  const contact = contactOfPattern(code, pattern, { strikes: situation.strikes, buntKind })
  // 0x517e6 — 메시지 0x11(필살수비 · 표시 패턴 · 폴 굴림) 뒤. 마타자는 0x34c74 가 번호와 무관하게 30%.
  // 판을 도는 페어 타구는 재료만 쏜 공에 실어 수비 판 시작(`startDefensePlay`)이 그 차례에 굴린다 — 판을 아직 안 도는
  // 파울 · 판정 11 만 여기서 굴린다(사람 타석 `resolvePitch` 와 같다, 미해결)
  const specialSwing = isSpecialSwing ? { number: specialNumber, isAceBatter: true } : undefined
  if (contact.kind === '파울' && traits.playsFoulBall === true) {
    // 파울 각이라도 판을 돈다 — 필살타법 굴림까지 판 시작(메시지 0x11 뒤 517e6)에 맡긴다
    return {
      ...swung({ kind: '파울' }, false),
      foulContact: { pattern, resultCode: code, ...(specialSwing === undefined ? {} : { specialSwing }) },
    }
  }
  const isUncatchable = contact.kind !== '타구' && isSpecialSwing && rollSpecialSwing(specialNumber, random, true)
  if (contact.kind === '파울') return swung({ kind: '파울' }, isUncatchable)
  if (contact.kind === '번트파울아웃') {
    return swung({ kind: '타구', outcome: registerContact({ kind: '아웃', detail: '직선타아웃' }, null) }, isUncatchable)
  }
  // 타석을 끝내는 임시 결과 — 쏜 패턴을 묶어 투수편 진행기가 그 패턴으로 판을 돌린다(`battedContact`)
  return swung(
    {
      kind: '타구',
      outcome: registerContact(provisionalOutcomeOf(pattern), {
        pattern,
        resultCode: code,
        ...(specialSwing === undefined ? {} : { specialSwing }),
      }),
    },
    isUncatchable,
  )
}

const ZONE_HALF_PIXELS = 16.5
const NEUTRAL_SITUATION = {
  inning: 1,
  isLosing: false,
  runnerCount: 0,
  hasSecondBaseRunner: false,
  pitcherSide: 0,
  batterSide: 0,
  balls: 0,
  strikes: 0,
  batterOrderIndex: 0,
  recentAtBatCodes: [],
}
