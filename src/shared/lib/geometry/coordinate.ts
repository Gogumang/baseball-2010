/**
 * 스트라이크존을 기준으로 정규화한 좌표.
 * 존 내부는 x, y 모두 [-1, 1] 범위이고 y는 위쪽이 양수다.
 * 존 밖의 유인구는 절댓값이 1을 넘는다.
 */
export interface Coordinate {
  readonly x: number
  readonly y: number
}

export function isInsideStrikeZone(point: Coordinate): boolean {
  return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1
}
