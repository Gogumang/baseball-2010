import { SINE_HUNDRED_TABLE, SINE_SIXTEEN_TABLE, TANGENT_TABLE } from '@/shared/config/original/trigonometryTables'

/**
 * 원본 정수 삼각함수 (binary.mod, 위치 분석 2·5차 — 디스어셈블로 확인).
 *   0x6c6a8 sin×100 · 0x6c6dc cos×100 · 0x6c7c0 sin×65535 · 0x6c7f4 cos×65535
 *   0x6c768 atan2(x, y) → 0~359° · 0x6c71c tan 표 이진 탐색 · 0x6c64c 정수 제곱근
 * 각도는 도 단위 정수다. 표는 0~90° 뿐이라 접어서 읽는다.
 */
const HALF_TURN = 180
const RIGHT_ANGLE = 90
const FULL_TURN = 360

function foldedSine(angle: number, table: readonly number[]): number {
  let degree = angle
  for (;;) {
    while (degree < 0) degree += FULL_TURN
    // 정수 연산이라 −0 이 없다 — JS 의 −0 을 0 으로 맞춘다
    if (degree > HALF_TURN) return 0 - foldedSine(degree - HALF_TURN, table) + 0
    if (degree <= RIGHT_ANGLE) return table[degree]
    degree = HALF_TURN - degree
  }
}

export const sineHundred = (angle: number) => foldedSine(angle, SINE_HUNDRED_TABLE)
export const cosineHundred = (angle: number) => sineHundred(RIGHT_ANGLE - angle)
export const sineSixteen = (angle: number) => foldedSine(angle, SINE_SIXTEEN_TABLE)
export const cosineSixteen = (angle: number) => sineSixteen(RIGHT_ANGLE - angle)

const TANGENT_SCALE = 10_000
const LAST_TANGENT_INDEX = 89

/** 0x6c71c — lo=0, hi=89 로 가운데를 잡다가 같은 가운데가 두 번 나오면 멈춘다 */
function arctangentIndex(ratio: number): number {
  let low = 0
  let high = LAST_TANGENT_INDEX
  let previous = -1
  for (;;) {
    const middle = (low + high) >> 1
    if (middle === previous) return middle
    previous = middle
    if (ratio < TANGENT_TABLE[middle]) high = middle
    else low = middle
  }
}

/** 원본 인자 순서는 (x, y) 다. x 가 0 이면 y 가 0 일 때만 0°, 아니면 90° 에서 사분면을 붙인다 */
export function atan2Degrees(x: number, y: number): number {
  let angle = 0
  if (x !== 0) {
    angle = arctangentIndex(Math.abs(Math.trunc((y * TANGENT_SCALE) / x)))
  } else if (y !== 0) {
    angle = RIGHT_ANGLE
  }
  if (y >= 0) return x >= 0 ? angle : HALF_TURN - angle
  return x >= 0 ? FULL_TURN - angle : HALF_TURN + angle
}

/** 0x6c64c 뉴턴법 — 0 이상에서 floor(sqrt) 와 같다 (position-re 가 재현으로 확인) */
export function integerSquareRoot(value: number): number {
  return Math.floor(Math.sqrt(Math.max(0, value)))
}
