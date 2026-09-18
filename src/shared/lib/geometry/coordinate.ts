/**
 * 스트라이크존을 기준으로 정규화한 좌표.
 * 존 내부는 x, y 모두 [-1, 1] 범위이고 y는 위쪽이 양수다.
 * 존 밖의 유인구는 절댓값이 1을 넘는다.
 */
export interface Coordinate {
  readonly x: number
  readonly y: number
}

export function distanceBetween(left: Coordinate, right: Coordinate): number {
  const horizontal = left.x - right.x
  const vertical = left.y - right.y
  return Math.sqrt(horizontal * horizontal + vertical * vertical)
}

export function isInsideStrikeZone(point: Coordinate): boolean {
  return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1
}

export function clampToPlayableArea(point: Coordinate): Coordinate {
  return {
    x: clamp(point.x, -PLAYABLE_AREA_LIMIT, PLAYABLE_AREA_LIMIT),
    y: clamp(point.y, -PLAYABLE_AREA_LIMIT, PLAYABLE_AREA_LIMIT),
  }
}

/** 배트 커서가 움직일 수 있는 범위. 존 밖 유인구까지는 쫓아갈 수 있어야 한다. */
export const PLAYABLE_AREA_LIMIT = 1.8

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
