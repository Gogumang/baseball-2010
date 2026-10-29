import { BIG_HIT_HOLD_COUNTER_START } from '@/widgets/batting-stage/lib/bigHitScreen/bigHitClock'

/** 4cc2c — 확대 배율 % = 100 + 2 × (6 − [+0x10a8]) */
export function bigHitZoomPercentOf(counter: number): number {
  return 100 + 2 * (BIG_HIT_HOLD_COUNTER_START - counter)
}

/** 4cc6c `lsls r4, r3, #0x1f ; bpl` — 옛값이 홀수(−1 포함)면 번쩍임 */
export function bigHitFlashesAt(counter: number): boolean {
  return (counter & 1) !== 0
}

/** 표 0xcfb54 — 존 한가운데(480 × 390 격자), +0x17e1 칸 */
const ZONE_CENTER_TABLE: readonly (readonly [number, number])[] = [
  [242, 326],
  [237, 326],
]

/** 4cbc0~4cc06 — 확대 중심 (px, py) = (trunc(W × x / 480), trunc(H × y / 390)) */
export function bigHitZoomCenterOf(side: number, width: number, height: number): { readonly x: number; readonly y: number } {
  const [x, y] = ZONE_CENTER_TABLE[side === 1 ? 1 : 0]
  return { x: Math.trunc((width * x) / 480), y: Math.trunc((height * y) / 390) }
}

/** 흐리기 n — 멈춤 갈래 4cc52 `movs r3, #2` · 뒤 갈래 4cdc6 `movs r3, #1` (감사 2026-10-24: 예전 주소 4cc7a 는 번쩍임 표 복사 크기 자리였다) */
export const BIG_HIT_HOLD_BLUR = 2

export const BIG_HIT_FOLLOW_BLUR = 1

/** 번쩍임 색 0x78FFFFFF — 채우기 [창+0x80] · 테두리 [창+0x7c] 같은 색 (4cc8a~4cc92) */
export const BIG_HIT_FLASH_COLOR = { r: 255, g: 255, b: 255, alpha: 0x78 } as const

/** 4cd2c~4cda6 — 검은 테두리 4 줄 (x, y, w, h), 0x6a9f1 색 0 */
export function bigHitBorderRectsOf(width: number, height: number): readonly (readonly [number, number, number, number])[] {
  return [
    [0, 0, width, 4],
    [0, 0, 4, height],
    [0, height - 4, width, 4],
    [width - 4, 0, 4, height],
  ]
}

/** 4cdfa — game_effect 애니 번호 ([[+0x102c]+0x10]+8 의 +0xc) */
export const BIG_HIT_FOLLOW_ANIMATION = 3
