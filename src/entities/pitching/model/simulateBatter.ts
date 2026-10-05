import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import { swingResultOf } from '@/entities/batting/model/swingResult'
import { timingOf } from '@/entities/batting/model/swingTiming'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { outcomeOfPattern, randomPattern } from '@/entities/batting/model/battedBallOutcome'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
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
 * ⚠️ 미해결 — 이 값을 **잇지 않았다.** 필살 스윙의 효과(0xab214 에 넘기는 보정 구조체
 *    0x34d6c 타자 쪽: 히트·파워 +150~220 · B·C %), 실제 스윙 순간의 횟수 차감(0x4e136),
 *    타구가 날 때의 성공 굴림(0x34c74 → `rollSpecialSwing`, 마타자 30%)이 이 길에 하나도 없다.
 *    특히 0x34c74 굴림이 0xab214 굴림들 사이 어디에 끼는지 확인하지 않아 난수 차례를 지어낼 수
 *    없다. 사람 타석(resolvePitch)도 보정 구조체를 swingResultOf 에 싣지 않는다.
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
 * ⚠️ 미션 마타자의 레벨 배율(0xb6414 의 0xd88aa)과 로스터 스킬 보정은 아직 못 붙인다 (부르는 쪽 주석).
 */
export function pitchAgainstBatter(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: { readonly control: number; readonly velocity: number } = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
  traits: CpuBatterTraits = {},
): PitchResolution {
  const isMistake = traits.isMistakePitch === true
  const choice = cpuSwingChoiceOf(pitch, batter, random, situation, isMistake)
  if (choice === null) {
    return isInsideStrikeZone(pitch.plate)
      ? { kind: '스트라이크', isSwinging: false }
      : { kind: '볼' }
  }

  // 원본 0x34334 → 0x340f8: F = N − 2 + d
  const frame = pitch.frameCount - SWEET_FRAME_OFFSET + cpuSwingTimingOffsetOf(batter.hit, random, isMistake)
  // 0x3445a — 타이밍 굴림 **뒤**에 번트 종류
  const buntKind = cpuBuntKindOf(choice, traits.isMagicBatter === true, random)
  const result = swingResultOf(
    {
      horizontalError: Math.round(pitch.plate.x * ZONE_HALF_PIXELS),
      verticalError: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
      timing: timingOf(frame, pitch.frameCount, false),
      buntKind,
      controlTier: pitch.controlTier,
      batter,
      pitcher,
      mode: '일반',
      isPitcherExhausted: false,
      batterSkillIds: [],
      pitcherSkillIds: [],
      situation: NEUTRAL_SITUATION,
    },
    random,
  )
  if (result.kind === '헛스윙') return { kind: '스트라이크', isSwinging: true }

  const code = result.code + hitDirectionOf({ code: result.code, frame, frameCount: pitch.frameCount, batterSide: 0 }, random)
  // 2스트라이크 번트 파울은 아웃 (0x9d5e2) — 사람 타석(resolvePitch)과 같은 판정이다
  const batted = outcomeOfPattern(code, randomPattern(code, random), random, {
    strikes: situation.strikes,
    buntKind,
  })
  return batted.kind === '파울' ? { kind: '파울' } : { kind: '타구', outcome: batted.outcome }
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
