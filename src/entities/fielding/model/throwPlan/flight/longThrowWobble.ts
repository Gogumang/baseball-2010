import { horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { throwFlightOf } from '@/entities/fielding/model/throwPlan/flight/throwFlight'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** a198c — 이 거리(0x2008)를 넘는 보통 송구만 흔들림 굴림을 한다 */
export const LONG_THROW_DISTANCE = 0x2008
/** a199c — 흔들림 기준 = 특수 × 100 + 1000 (만분율) */
const LONG_THROW_WOBBLE_BASE = 1_000
const SPECIAL_WOBBLE_BONUS = 100
/** a19a8 — 흔들리면 수평 · 수직 속도 × 85 / 100 */
const LONG_THROW_WOBBLE_PERCENT = 85

/**
 * **긴 송구 흔들림** — 0xa1620 이 악송구 굴림(a1828)에 떨어진 보통 송구에서 한 번 더 굴린다 (직접 뜬 것):
 * ```
 * a198c  거리(0xbf9f0(놓는 점, 받는 점)) > 0x2008 → r = rand(0, 10000)
 * a199c  r < 특수 × 100 + 1000 → h = h·85/100 · w = w·85/100 · 야수+0xc4 = 4 · 공+0xaad = 1
 * ```
 * 공+0xaad 면 0xb2e38 의 받는 점 끼워 넣기(b2f9c — 점[T−1] = 받는 점)가 빠져 공은 느려진 궤적 그대로 가고, 예보 vt24(0)
 * (움직임허용 없음 · 내야끼리면 +0x1e8 로 받을 야수만 낮은 공 · 가슴 높이)가 받는 야수를 고른다.
 * 원바운드(a17fc)와 악송구(a1908)는 a19d0 으로 바로 가 이 굴림이 없다. 레이저(0xa222c)도 없다.
 * 거리가 문턱 이하면 굴리지 않고 null, 굴렸는데 안 흔들리면 false.
 */
export function rollLongThrowWobble(fielder: FielderState, point: WorldPoint, special: boolean, random: RandomPort): boolean | null {
  if (horizontalDistance(fielder.position, point) <= LONG_THROW_DISTANCE) return null
  return random.rand(0, 10_000) < (special ? SPECIAL_WOBBLE_BONUS : 0) + LONG_THROW_WOBBLE_BASE
}

/** 흔들린 긴 송구의 수평 속도 · 수직 속도 · 방향 — a173c · a17e4 의 h · w 에 85% (a19a6~a19be) */
export function wobbledThrowFlight(
  fielder: FielderState,
  point: WorldPoint,
): { readonly horizontalSpeed: number; readonly verticalSpeed: number; readonly direction: number } {
  const flight = throwFlightOf(fielder, point)
  const vertical = (flight.gravity * flight.ticks) >> 1
  return {
    horizontalSpeed: Math.trunc((flight.horizontalSpeed * LONG_THROW_WOBBLE_PERCENT) / 100),
    verticalSpeed: Math.trunc((vertical * LONG_THROW_WOBBLE_PERCENT) / 100),
    direction: flight.direction,
  }
}
