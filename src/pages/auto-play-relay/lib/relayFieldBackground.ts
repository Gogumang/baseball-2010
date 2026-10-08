import { cameraBoundsOf, centerOn, screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
import { DEFENSE_BACKGROUND_WIDTH } from '@/pages/defense/lib/defenseView'

/** 화면 240×320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 투수판 0xcfa8c[0] = (20000, 24500) — 상태 0x21 진입 0x3abf0 이 카메라를 여기에 즉시 맞춘다 */
export const RELAY_CAMERA_TARGET = { x: 20000, z: 24500 } as const

/**
 * **상태 0x21 의 운동장 배경 자리** (2026-10-08 직접 뜸):
 * ```
 * 3ac04  [장면+0x1e8](수비 카메라).vtc(0xcfa8c[0], 0xcfa8c[2]) = (20000, 24500)   ; 0xc074c — 가운데 맞추고 곧바로 그 자리
 * 52f36  0x41230(장면)   ; 상태 7 · 8 · 9 말고 모든 그림 — 오프셋 = −(카메라 현재) × 620/40000, ×500/32500 (0xb9480)
 * 41396  0x33c98(야외 상태: 6 · 0x17 · 0x18 · 0x1a · 0x1c · 0x1e · 0x20 · 0x21) → 0x411e0 → 0x78930([장면+0xf14])
 * 78954  defense.pzx 를 (오프셋 x, 오프셋 y) 에, 78976 같은 그림을 효과 0x11(좌우)로 (오프셋 x + 폭 − 1, 오프셋 y) 에
 * ```
 * 카메라를 움직이는 0x3f060 은 상태 0x17 에서만 대상을 따라가므로 0x21 동안 배경은 그 자리에 선다. 모드를 안 가린다
 * (미션 · 나리편도 같다). 240×320 이면 시야 15483×20800 · 목표 (12259, 11700)(세로는 32500 − 20800 에서 잘림) → (−190, −180).
 */
export function relayFieldBackgroundAt(): { readonly x: number; readonly y: number; readonly mirroredX: number } {
  const offset = screenOffsetOf(centerOn(cameraBoundsOf(SCREEN_WIDTH, SCREEN_HEIGHT), RELAY_CAMERA_TARGET))
  return { x: offset.x, y: offset.y, mirroredX: offset.x + DEFENSE_BACKGROUND_WIDTH - 1 }
}
