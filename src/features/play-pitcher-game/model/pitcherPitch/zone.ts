import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/**
 * 존 반폭 (월드) — `selectPitch.ts` 가 월드 좌표를 존 좌표(−1~1)로 바꿀 때 쓰는 값과 같다.
 * 그쪽 상수가 파일 안에 숨어 있어 같은 수를 여기에 다시 적는다 (목표 종류 1·2 의 최대 거리 331·329).
 */
export const ZONE_HALF_WORLD = { x: 331, y: 329 }

/**
 * 스트라이크 존 표 `0xcfb7c` (존 판정 0x341ec, Q1 문서) — 칸 = 타자 우/좌(`scene+0x17e1`).
 * 화면 좌표 (x, y, 폭, 높이) 이고 경계를 포함한다. 한가운데 16×16 의 중심 표는 `0xcfb54` 다.
 */
export const STRIKE_ZONE_RECTS: readonly { x: number; y: number; width: number; height: number }[] = [
  { x: 226, y: 310, width: 33, height: 33 },
  { x: 221, y: 310, width: 33, height: 33 },
]
/** 한가운데 16×16 의 중심 `0xcfb54` */
export const ZONE_CENTER_POINTS: readonly { x: number; y: number }[] = [
  { x: 242, y: 326 },
  { x: 237, y: 326 },
]

/** 월드 목표점 → 존 좌표(−1~1) — `selectPitch` 의 같은 셈 */
export function plateOf(target: WorldPoint, side: number) {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: (target.x - center.x) / ZONE_HALF_WORLD.x, y: (target.y - center.y) / ZONE_HALF_WORLD.y }
}
