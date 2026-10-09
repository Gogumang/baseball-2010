import { integerSquareRoot } from '@/shared/lib/math/originalTrigonometry'

/**
 * **레이저 잔상** — 공 그리기 0x36dfc 의 0x37076~0x3724a (직접 뜬 것).
 * ```
 * 37076  장면 +0x1991 이 0 이면 건너뛴다 (공이 화면에서 떠 있을 때 — 높이 투영 h ≠ 0 갈래)
 * 3708a  S = 0xa25b1(공, 0) 의 (x, z) · (0, y) 투영 → (오프셋x + sx, 오프셋y + sz − sy)        ; 지금 궤적의 첫 점
 * 370c8  C = 공 그림 자리 (오프셋x + x, 오프셋y + z − h)
 * 37104  d = 0x6c66d(C, S) = isqrt(dx² + dy²)                                                   ; s16 짝
 * 3710e  w = 지금 공 그림(크기 칸 + 11 × 종류) 의 폭(+0x12)
 * 37134  k0 = d > 120 ? d − 120 : 1 ; 걸음 = max(1, ((d − k0) / w) / 14)
 * 371ae  k = k0 … d − 1 :  k % w == 0 이면
 *          점 = ((d − k)·S + k·C) / d   (x · y 따로, 0으로 버림)
 *          0xbe8d5(그리기 목록, 점, 깊이 = 공 z, 공 그림, 같은 프레임, 효과 1, 단계 min(n, 15), …)   ; n = 1, 1 + 걸음, …
 * ```
 * 곧 공 뒤 마지막 120 화소 안에 공 폭 간격으로 같은 공 그림을 늘어놓고, 공에 가까울수록 진하다(단계 = 무게 n/16, R6 3a).
 */
export interface LaserTrailStamp {
  readonly x: number
  readonly y: number
  /** 효과 1 의 단계 1~15 (반투명 무게 단계/16) */
  readonly level: number
}

/** 37134 `cmp #0x78` — 공 뒤로 잔상을 늘어놓는 거리 */
const TRAIL_REACH = 0x78
/** 37192 `movs r1, #0xe` */
const LEVEL_STEP_DIVISOR = 14
/** 37206 `movs r1, #0xf` */
const MAX_LEVEL = 15

const s16 = (value: number) => (Math.trunc(value) << 16) >> 16

export function laserTrailStampsOf(
  start: { readonly x: number; readonly y: number },
  current: { readonly x: number; readonly y: number },
  ballWidth: number,
): LaserTrailStamp[] {
  const sx = s16(start.x)
  const sy = s16(start.y)
  const cx = s16(current.x)
  const cy = s16(current.y)
  const distance = integerSquareRoot((cx - sx) ** 2 + (cy - sy) ** 2)
  if (ballWidth <= 0) return []
  const first = distance > TRAIL_REACH ? distance - TRAIL_REACH : 1
  const step = Math.max(1, Math.trunc(Math.trunc((distance - first) / ballWidth) / LEVEL_STEP_DIVISOR))
  const stamps: LaserTrailStamp[] = []
  let level = 1
  for (let k = first; k < distance; k += 1) {
    if (k % ballWidth !== 0) continue
    stamps.push({
      x: Math.trunc(((distance - k) * sx + k * cx) / distance),
      y: Math.trunc(((distance - k) * sy + k * cy) / distance),
      level: Math.min(level, MAX_LEVEL),
    })
    level += step
  }
  return stamps
}
