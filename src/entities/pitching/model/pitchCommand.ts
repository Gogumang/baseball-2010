import type { Coordinate } from '@/shared/lib/geometry/coordinate'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import { flightMillisecondsOf } from '@/entities/pitching/model/selectPitch'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 투구 조작.
 *
 * 원작 설명서 <투구 조작> 그대로다:
 *   1. 구질 선택 : (2),(4),OK,(6),(8)   마구 선택 : (0)
 *   2. 코스 선택 : (2),(4),(6),(8)
 *   3. 투구 결정 : OK
 *   투구 게이지 — "PERFECT로 결정됐을 시 ... 더욱 강한 공을 던질 수 있습니다"
 */

/** 구질 슬롯 5개. 원작의 (2)(4)OK(6)(8) 다섯 자리다. */
export const PITCH_SLOT_COUNT = 5

/** 코스는 존 안 9칸 중 하나로 노린다. */
export const COURSE_GRID = 3

export type GaugeResult = 'PERFECT' | 'GOOD' | 'BAD' | '사용안함'

/** PERFECT 판정이 나는 게이지 오차 (0~1 중) */
export const PERFECT_WINDOW = 0.06
export const GOOD_WINDOW = 0.2

export function judgeGauge(error: number): GaugeResult {
  const magnitude = Math.abs(error)
  if (magnitude <= PERFECT_WINDOW) return 'PERFECT'
  if (magnitude <= GOOD_WINDOW) return 'GOOD'
  return 'BAD'
}

/** 게이지 결과가 제구에 주는 보정 */
const GAUGE_CONTROL_BONUS: Readonly<Record<GaugeResult, number>> = {
  PERFECT: 25,
  GOOD: 5,
  BAD: -20,
  사용안함: 0,
}

/** 게이지 결과가 구속에 주는 배율 */
const GAUGE_SPEED_FACTOR: Readonly<Record<GaugeResult, number>> = {
  PERFECT: 1.08,
  GOOD: 1,
  BAD: 0.92,
  사용안함: 1,
}

/** 제구 0인 투수가 노린 코스에서 벗어나는 최대 거리 (존 단위) */
const MAXIMUM_CONTROL_ERROR = 0.75


export interface PitchCommand {
  readonly type: PitchTypeInfo
  /** 노린 코스 (존 좌표) */
  readonly aim: Coordinate
  readonly gauge: GaugeResult
}

/** 코스 격자 칸 번호(0~8)를 존 좌표로 바꾼다. */
export function courseOf(cell: number): Coordinate {
  const column = cell % COURSE_GRID
  const row = Math.floor(cell / COURSE_GRID)
  // 3×3 칸의 가운데를 노린다
  return { x: (column - 1) * 0.62, y: (1 - row) * 0.62 }
}

export function buildPitch(
  command: PitchCommand,
  pitcher: PitcherAbility,
  random: RandomPort,
): Pitch {
  const control = Math.min(100, Math.max(0, pitcher.control + GAUGE_CONTROL_BONUS[command.gauge]))
  const controlError = (1 - control / 100) * MAXIMUM_CONTROL_ERROR

  // 게이지가 좋을수록 원본의 빠른 구속 단계를 쓴 것과 같은 효과를 낸다.
  const effectiveVelocity = Math.min(
    100,
    Math.max(0, pitcher.velocity * GAUGE_SPEED_FACTOR[command.gauge]),
  )

  const flightDurationMilliseconds = flightMillisecondsOf(command.type.flightSteps, effectiveVelocity)
  return {
    type: command.type.name,
    plate: {
      x: command.aim.x + random.nextInRange(-controlError, controlError),
      y: command.aim.y + random.nextInRange(-controlError, controlError),
    },
    breakOffset: {
      x: command.type.horizontalBreak * (0.6 + (pitcher.velocity / 100) * 0.4),
      y: command.type.verticalBreak * (0.6 + (pitcher.velocity / 100) * 0.4),
    },
    flightDurationMilliseconds,
    frameCount: Math.max(1, Math.round(flightDurationMilliseconds / millisecondsPerFrame())),
    // 사용자 투구의 등급(게이지 규칙)은 일부만 확인됐다 — 배율 100 으로 둔다 (추정)
    controlTier: -1,
    worldPath: null,
    // 투수편 화면은 타석 화면과 같은 배치를 쓴다 (추정)
    stageSide: 1,
  }
}
