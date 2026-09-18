import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { PLATE_DEPTH, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/**
 * CPU 목표점 (0x345fc) 과 제구 오차 (0x4dc78) — 위치 분석 2·5차, 난수 순서까지 원본 그대로.
 * rand(a, b) = [a, b) 정수. rand01 = rand(0, 2), 0 이면 + 방향.
 */
export interface TargetSituation {
  /** 화면 배치 side (존 중심 표 0xcfbcc 의 칸) */
  readonly side: number
  readonly batterSide: number
  readonly runnerCount: number
}

const INNER = 141
const EDGE_X = [141, 332]
const EDGE_Y = [141, 330]
const CORNER_X = [282, 332]
const CORNER_Y = [280, 330]
const OUTSIDE_X = [332, 382]
const OUTSIDE_Y = [330, 380]
const PICKOFF_KIND = 4
const FULL_BASES = 3
const FLIP_CHANCE = 3

const signed = (random: RandomPort, value: number) => (randomIntegerBelow(random, 0, 2) === 0 ? value : -value)

export function pitchTargetOf(kind: number, situation: TargetSituation, random: RandomPort): WorldPoint {
  const center = ZONE_CENTERS[situation.side] ?? ZONE_CENTERS[0]
  // 종류 4 는 주자가 없거나 만루면 1 이다. 그 밖은 원본이 견제구(메시지 0x10)를 던지지만 웹에는 견제가 없어 1 로 둔다 (추정)
  const effective =
    kind === PICKOFF_KIND && (situation.runnerCount === 0 || situation.runnerCount === FULL_BASES) ? 1 : kind
  switch (effective) {
    case 0: {
      const x = center.x + randomIntegerBelow(random, -INNER, INNER)
      const y = center.y + randomIntegerBelow(random, -INNER, INNER)
      return { x, y, z: PLATE_DEPTH }
    }
    case 2:
    case 1:
    case PICKOFF_KIND: {
      const [minimumX, maximumX] = effective === 2 ? CORNER_X : EDGE_X
      const [minimumY, maximumY] = effective === 2 ? CORNER_Y : EDGE_Y
      const dx = randomIntegerBelow(random, minimumX, maximumX)
      const dy = randomIntegerBelow(random, minimumY, maximumY)
      const x = center.x + signed(random, dx)
      const y = center.y + signed(random, dy)
      return { x, y, z: PLATE_DEPTH }
    }
    default: {
      const dx = randomIntegerBelow(random, OUTSIDE_X[0], OUTSIDE_X[1])
      const dy = randomIntegerBelow(random, OUTSIDE_Y[0], OUTSIDE_Y[1])
      let direction = situation.batterSide === 0 ? 1 : -1
      if (randomIntegerBelow(random, 0, FLIP_CHANCE) === 0) direction = -direction
      const y = center.y + signed(random, dy)
      return { x: center.x + dx * direction, y, z: PLATE_DEPTH }
    }
  }
}

/** 등급별 누적 % (표 0xcfd60) → 계수 칸 */
const ERROR_ROWS: readonly (readonly number[])[] = [
  [10, 35, 80, 100],
  [40, 65, 90, 100],
  [50, 73, 93, 100],
  [60, 80, 95, 100],
  [72, 87, 97, 100],
  [84, 94, 99, 100],
]
const ERROR_COEFFICIENTS = [12, 20, 25, 30]
/** slt_pitch 프레임 59~67 의 반폭 — 조준 칸 크기 */
const AIM_HALF_WIDTHS = [21, 20, 18, 16, 14, 12, 10, 8, 6]
const COMPUTER_AIM_OFFSET = 3
const SIXTEEN_BITS = 16

export interface ControlErrorInput {
  /** 제구 등급 0~5 (0xb74bc) */
  readonly tier: number
  readonly isComputer: boolean
  /** 사용자 투구의 조준 칸 (게이지). CPU 는 등급 + 3 */
  readonly aimIndex?: number
}

export function applyControlError(target: WorldPoint, input: ControlErrorInput, random: RandomPort): WorldPoint {
  const row = ERROR_ROWS[Math.max(0, Math.min(input.tier, ERROR_ROWS.length - 1))]
  const aimIndex = input.isComputer ? input.tier + COMPUTER_AIM_OFFSET : (input.aimIndex ?? 0)
  const roll = randomIntegerBelow(random, 0, 100)
  const column = row.findIndex((percent) => roll < percent)
  const coefficient = ERROR_COEFFICIENTS[column < 0 ? ERROR_COEFFICIENTS.length - 1 : column]
  const half = input.tier === 0 ? AIM_HALF_WIDTHS[0] : AIM_HALF_WIDTHS[Math.min(aimIndex, AIM_HALF_WIDTHS.length - 1)]
  const angle = randomIntegerBelow(random, 0, 360) + 1
  const dx = Math.abs(coefficient * ((half + randomIntegerBelow(random, -2, 3)) * sineSixteen(angle))) >> SIXTEEN_BITS
  const dy = Math.abs(coefficient * ((half + randomIntegerBelow(random, -2, 3)) * cosineSixteen(angle))) >> SIXTEEN_BITS
  const x = randomIntegerBelow(random, 0, 2) !== 0 ? target.x - dx : target.x + dx
  const y = randomIntegerBelow(random, 0, 2) !== 0 ? target.y - dy : target.y + dy
  return { x, y, z: target.z }
}
