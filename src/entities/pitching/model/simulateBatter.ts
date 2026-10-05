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

/**
 * CPU 타자가 휘두르는가 — 원본 0x34334 (사람이 투구할 때만 도는 길, 부르는 곳 0x51f26).
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
 * ⚠️ 아직 안 옮긴 것 — 원본은 실투(0x33cbc)면 choice 를 0 으로 **강제**하고,
 *    h 는 실효 히트(0xb570d: 컨디션·스킬 보정)다. 웹에는 둘 다 없어 날 히트를 쓴다.
 */
export function willSwing(
  pitch: Pitch,
  ability: BatterAbility,
  random: RandomPort,
  situation: BatterSituation = UNWIRED_SITUATION,
): boolean {
  const odds = battingPatternOdds(
    situation.strikes,
    situation.balls,
    situation.outs,
    situation.hasRunner,
  )
  // 0x9f224 — rand(0,100), 위끝 제외
  const choice = battingPatternChoiceOf(odds, randomIntegerBelow(random, 0, 100))
  if (choice === '지켜보기') return false

  const zone = swingZoneOf(pitch.plate)
  // 히트가 높을수록 덜 쫓는다. 원본 비교는 `rand > 문턱` 이면 그만둔다 = 같으면 쫓는다.
  if (zone === 3) {
    return randomIntegerBelow(random, 0, 10000) <= 250 - truncated(ability.hit / 4)
  }
  if (zone === 2) {
    return randomIntegerBelow(random, 0, 10000) <= 2000 - truncated((ability.hit * 3) / 2)
  }
  return true
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
 * 휘두를지는 원본 0x34334(battingPattern.arr) 그대로다 — `willSwing` 참고.
 * **언제** 휘두를지는 원본 0x340f8 — `cpuSwingTimingOffsetOf` 참고.
 * ⚠️ 번트도 아직 없다 — 원본은 표에서 번트 칸이 뽑히면 rand(1,4) 로 번트 종류를 정한다.
 */
export function pitchAgainstBatter(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: { readonly control: number; readonly velocity: number } = DEFAULT_PITCHER_STATS,
  situation: BatterSituation = UNWIRED_SITUATION,
): PitchResolution {
  if (!willSwing(pitch, batter, random, situation)) {
    return isInsideStrikeZone(pitch.plate)
      ? { kind: '스트라이크', isSwinging: false }
      : { kind: '볼' }
  }

  // 원본 0x34334 → 0x340f8: F = N − 2 + d
  const frame = pitch.frameCount - SWEET_FRAME_OFFSET + cpuSwingTimingOffsetOf(batter.hit, random)
  const result = swingResultOf(
    {
      horizontalError: Math.round(pitch.plate.x * ZONE_HALF_PIXELS),
      verticalError: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
      timing: timingOf(frame, pitch.frameCount, false),
      buntKind: 0,
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
  const batted = outcomeOfPattern(code, randomPattern(code, random), random)
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
