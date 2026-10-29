import { fill, line, type PanelPaint } from '@/shared/lib/commonPanel/panelPaint'

/** 0xbb28c 의 색 — 0x1400748(r, g, b) 로 만든다 (0xbb2cc · 0xbb2f0 · 0xbb340) */
export const INSET_BOX_COLORS = {
  fill: '#1D44A8', // RGB(0x1d, 0x44, 0xa8)
  lit: '#5A86FF', // RGB(0x5a, 0x86, 0xff) — 오른쪽 · 아래 변
  shade: '#08246B', // RGB(0x08, 0x24, 0x6b) — 위 · 왼쪽 변
} as const

/**
 * **안쪽 칸 `0xbb28c(x, y, w, h, 정렬)`** 의 칠 목록 (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)). R = w − 1 · B = h − 1:
 * ```
 * bb2ea  칠 (0, 0, w, h) #1D44A8
 * bb318  선 (R, 0)–(R, B) #5A86FF · bb33a 선 (0, B)–(R, B) #5A86FF
 * bb35c  선 (0, 0)–(R, 0) #08246B · bb37e 선 (0, 0)–(0, B) #08246B
 * ```
 * 곧 들어간 칸 — 위·왼쪽이 어둡고(오른쪽 위 · 왼쪽 아래 끝 점도 어둡다) 오른쪽·아래가 밝다.
 */
export function insetBoxPaintsOf(w: number, h: number): PanelPaint[] {
  const right = w - 1
  const bottom = h - 1
  const c = INSET_BOX_COLORS
  return [
    ...fill(0, 0, w, h, c.fill),
    ...line(right, 0, right, bottom, c.lit),
    ...line(0, bottom, right, bottom, c.lit),
    ...line(0, 0, right, 0, c.shade),
    ...line(0, 0, 0, bottom, c.shade),
  ]
}
