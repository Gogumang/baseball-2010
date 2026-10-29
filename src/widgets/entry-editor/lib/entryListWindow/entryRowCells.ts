/** 타순 열 0x5698d — 줄 ≤ 8 이면 num 0x1e + 숫자로 줄 + 1 을 (x, y + 3, 25) 가운데, 그 밖은 "!C!cffffff-" 를 (x, y, 25, 15) 가운데 */
export function entryOrderCellOf(row: number): { readonly number: number } | { readonly dash: true } {
  return row <= 8 ? { number: row + 1 } : { dash: true }
}

/**
 * 등판 순서 열 0x56721 — 줄 0 은 game_ui 0x17 을 칸 위에 덧칠하고 img_text 53 "등판"(팔레트 0)을 칸 가운데,
 * 줄 1~3 은 숫자 줄 + 1, 그 밖은 "-" (568b0 `cmp r5, #3`).
 */
export function entryRotationCellOf(row: number): { readonly today: true } | { readonly number: number } | { readonly dash: true } {
  if (row === 0) return { today: true }
  return row <= 3 ? { number: row + 1 } : { dash: true }
}

export const ENTRY_TODAY_OVERLAY_FRAME = 0x17

export const ENTRY_TODAY_LABEL_FRAME = 53

/**
 * 딱지 열 0x56b5d — 타자 0x54590(+0x1c & 0xf) · 투수 0x545e8(0xb6ded = +0xb & 3). 칸이 −1 이 아니면 game_ui 0x20 + 칸을 칸 위에,
 * 글 img_text 를 팔레트 0 으로 (x, y − 1, 36, 15) + dy 1 가운데. −1 이면 글꼴 0x9c069 로 "-" 를 (x + 15, y + 3).
 */
export const ENTRY_BADGE_CHIP_BASE = 0x20

export const ENTRY_BADGE_DASH = { dx: 15, dy: 3 } as const

/**
 * 이름 칸 덧그림 0x571d8 — [ed+0x333] ≠ 0 일 때만. 타자: +0xb & 3 색(0 #89DB14 · 1 #FF3C14 · 2 #14B3DB)으로
 * (x + w − 4 · x + w − 3, y + 1)~(…, y + h − 2) 세로 두 줄. 투수: M = 0x66e44(팀, rec, 0) ·
 * S = [ed+0x334] ∈ {1, 2, 3, 4, 8, 9}(0x31e) ? trunc(+0x2c / 100) : 100 · L = trunc(trunc(M × (w × 100 − 400) / 1249) / 100) ·
 * 녹 (0x1c, 0x93, 0) (x + 3, y + h − 2)~(x + 3 + L) 두 줄 위에 빨 (0xff, 0x3c, 0x14) (x + 3)~(x + 3 + trunc(S × L / 100)) 두 줄.
 */
export const ENTRY_FIELDER_COLORS: readonly string[] = ['#89DB14', '#FF3C14', '#14B3DB']

export function entryStaminaLinesOf(capacity: number, percent: number, cellWidth = 54): { readonly length: number; readonly current: number } {
  const length = Math.trunc(Math.trunc((capacity * (cellWidth * 100 - 400)) / 0x4e1) / 100)
  return { length, current: Math.trunc((percent * length) / 100) }
}

/** [ed+0x334] 가 이 모드들이면 +0x2c 를 읽는다 (0x572a4 `0x31e` 비트표) */
export function entryStaminaPercentOf(mode: number, stamina: number): number {
  return mode >= 0 && mode <= 9 && ((0x31e >> mode) & 1) === 1 ? Math.trunc(stamina / 100) : 100
}
