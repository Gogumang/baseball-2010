import {
  BASE_POWER,
  EXTRA_INNING_DIVISOR_UNIT,
  EXTRA_INNING_FROM,
  EXTRA_INNING_POWER_FLOOR,
  EXTRA_INNING_POWER_STEP,
  POWER_SCALE,
  RANDOM_LIMIT,
  SPREAD_RANGE,
  TIGHT_COURSE_GAIN,
  TIGHT_COURSE_GATE,
  WEAK_SWING_GATE,
} from '@/entities/game/model/quickAtBat/constants'
import type { QuickAtBatBatter, QuickAtBatPitcher, QuickAtBatSituation } from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface QuickPitch {
  readonly spreadX: number
  readonly spreadY: number
  /** 0xab214 의 param_6 — 웹판 `swingResultOf` 는 이것을 timing 자리에 받는다 */
  readonly power: number
}

const trunc = Math.trunc

/** 투수 구속이 타자 히트를 누르면 스윙 자체가 힘을 잃는다 (0xc1584) — 판정 굴림 · 투수 · 타자 차례 */
function rollWeakSwing(batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher, random: RandomPort): boolean {
  if (random.rand(0, RANDOM_LIMIT) > WEAK_SWING_GATE) return false
  const pitcherRoll = random.rand(0, pitcher.velocity)
  const batterRoll = random.rand(0, batter.hit)
  return batterRoll < pitcherRoll
}

/** 타자 파워가 투수 제구를 누르면 코스가 가운데로 당겨진다 (0xc1590) — 판정 굴림 · 투수 · 타자 차례 */
function rollTightCourse(batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher, random: RandomPort): boolean {
  if (random.rand(0, RANDOM_LIMIT) > TIGHT_COURSE_GATE) return false
  const pitcherRoll = random.rand(0, pitcher.control)
  const batterRoll = random.rand(0, batter.power)
  return pitcherRoll < batterRoll
}

/** 연장 보정 (0xc13e0) — 11회부터 이닝마다 세기가 오르고 코스를 세기 ÷ 20 로 나눠 좁힌다 */
function extraInningPitchOf(pitch: QuickPitch, inning: number): QuickPitch {
  if (inning <= EXTRA_INNING_FROM || pitch.power <= EXTRA_INNING_POWER_FLOOR) return pitch
  const power = Math.min(100, pitch.power + (inning - EXTRA_INNING_FROM) * EXTRA_INNING_POWER_STEP)
  const divisor = trunc(power / EXTRA_INNING_DIVISOR_UNIT)
  return { spreadX: trunc((pitch.spreadX * 3) / divisor), spreadY: trunc((pitch.spreadY * 3) / divisor), power }
}

/**
 * 부호를 각각 다시 뽑는다 — c144c · c1464 의 0xbfaa0 = `rand(0, 2)`(bfaa2 movs r0,#0 · movs r1,#2 · bl 0xbfa54, 확정).
 * 0 이 아니면 그대로, 0 이면 뒤집는다. 차례는 x(sp+0x58 → sp+0x44) 먼저, y(sp+0x54 → sp+0x40) 다음이고 구위 등급 0xb74bc(c1492) 앞이다
 */
function rollSpreadSigns(pitch: QuickPitch, random: RandomPort): QuickPitch {
  const spreadX = random.rand(0, 2) === 0 ? -pitch.spreadX : pitch.spreadX
  const spreadY = random.rand(0, 2) === 0 ? -pitch.spreadY : pitch.spreadY
  return { spreadX, spreadY, power: pitch.power }
}

/** 한 번 던질 때 정해지는 코스 오차와 스윙 세기 (0xc11f0 앞부분) */
export function quickPitchOf(batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher, situation: QuickAtBatSituation, random: RandomPort): QuickPitch {
  const spreadX = random.rand(SPREAD_RANGE.minimum, SPREAD_RANGE.maximumExclusive)
  const spreadY = random.rand(SPREAD_RANGE.minimum, SPREAD_RANGE.maximumExclusive)
  const swingPower = rollWeakSwing(batter, pitcher, random) ? 0 : BASE_POWER
  const course = rollTightCourse(batter, pitcher, random)
    ? { spreadX: Math.abs(spreadX) - TIGHT_COURSE_GAIN, spreadY: Math.abs(spreadY) - TIGHT_COURSE_GAIN }
    : { spreadX, spreadY }
  const power = trunc((swingPower * (POWER_SCALE.maximumValue - POWER_SCALE.minimum)) / 100) + POWER_SCALE.minimum
  return rollSpreadSigns(extraInningPitchOf({ ...course, power }, situation.inning), random)
}
