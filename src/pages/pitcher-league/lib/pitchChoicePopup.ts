/**
 * 칸 둘 — 0x19162~0x19170 칸 0 (W/2 − 0x38, H/2, 0x20, 0x20) 프레임 0x13 · 0x19272~0x19284 칸 1 (W/2 + 0x18, H/2, 0x20, 0x20)
 * 프레임 0x12 를 0x858fd([장면+0xe0], 칸, 프레임, 팔레트) 로 (0x1919c · 0x192a4). 칸 글은 img_text +0x4d0(308 "마구") ·
 * +0x4d4(309 "변화구") 를 (칸 x + (0x20 − 글 폭)/2, 칸 y + 0x20 + 4) 에.
 */
export const PITCH_CHOICE_CELLS: readonly { readonly x: number; readonly y: number; readonly iconFrame: number; readonly labelFrame: number }[] = [
  { x: 120 - 0x38, y: 160, iconFrame: 0x13, labelFrame: 308 },
  { x: 120 + 0x18, y: 160, iconFrame: 0x12, labelFrame: 309 },
]
