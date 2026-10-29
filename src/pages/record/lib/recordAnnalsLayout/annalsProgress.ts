import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import { PANEL } from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'

/**
 * **탭 1 진행 = 엔딩 칸 20개** (그리기 0x2ead8~0x2ef6a, 칸 값은 0x58b5c 가 채운다 — 둘 다 직접 떴다).
 * ```
 * 0x58b5c(skin): skin+0x1dc..+0x1ef = 0
 *   i = 0..14: 전역기록 [+0xa8 + i] ≠ 0 → skin[+0x1dc + i] = 1, 나리 n++        ; 나리 엔딩 15칸
 *   j = 0..4 : 전역기록 [+0xa0 + j] ≠ 0 → skin[+0x1eb + j] = 1, 시즌 s++        ; 시즌 엔딩 5칸 (칸 15~19)
 *   skin[+0x1f0] = n·100 / 15 (0xca7b5) · skin[+0x1f1] = s·20                    ; 진행도 두 줄
 * 칸 i (0x2ec88): i ≤ 19 이면 skin[+0x1dc + i], 아니면 0
 *   0  → 프레임 18(회색) + slt_frame 이미지 111 "?" 두 개 (x+10, y+7) · (x+20, y+7)
 *   ≠0 → 프레임 (i ∈ {8,9,14,18,19} → 20 · i ∈ {0,1,10,15} → 19 · 그 밖 17) (0x2ecfa~0x2ed3c)
 *        + 이름 StrMAINMENU[0xbd + i] = [189 + i] 검정 (x, y+7) · 흰 (x−1, y+6), 폭 41 (0x2ed6e~0x2edcc)
 * ```
 */
export const ENDING_CELL_NAMES = [
  ORIGINAL_MAIN_MENU_TEXT[189] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[190] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[191] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[192] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[193] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[194] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[195] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[196] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[197] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[198] ?? '', // StrMAINMENU[189~198]
  ORIGINAL_MAIN_MENU_TEXT[199] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[200] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[201] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[202] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[203] ?? '', // [199~203]
  ORIGINAL_MAIN_MENU_TEXT[204] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[205] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[206] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[207] ?? '',
  ORIGINAL_MAIN_MENU_TEXT[208] ?? '', // [204~208]
] as const

/** 칸 0~14 = 나리 엔딩(전역기록 +0xa8 + i) — 그 뒤 15~19 = 시즌 엔딩(+0xa0 + (i − 15)) */
export const NARI_ENDING_CELL_COUNT = 15

export const SEASON_ENDING_CELL_COUNT = 5

/** 얻은 엔딩 칸 프레임 20 · 19 인 칸 — 나머지는 17 */
const ENDING_CELL_FRAME_20: ReadonlySet<number> = new Set([8, 9, 14, 18, 19])
const ENDING_CELL_FRAME_19: ReadonlySet<number> = new Set([0, 1, 10, 15])

/** 얻은 엔딩 칸의 프레임 (0x2ecfa~0x2ed3c) */
export function endingCellFrameOf(index: number): number {
  if (ENDING_CELL_FRAME_20.has(index)) return 20
  if (ENDING_CELL_FRAME_19.has(index)) return 19
  return 17
}

/**
 * 진행도 두 줄 (0x2ee10~0x2ef68) — 칸 격자 뒤 y = y0 + 10 = 64 에서 줄마다 +20:
 * ```
 * 노란 네모 slt_frame 이미지 38 (x0 + 13, y + 0x92)
 * 모드 이름 img_text 표 0xced84 = [12 "나만의리그", 15 "시즌모드"] (x0 + 23, y + 0x91)
 * img_text 275 "진행도" (x0 + 23 + 모드폭 + 2, y + 0x91)
 * slt_frame 프레임 14 (67×18) (x0 − 67 + 184, y + 0x8d) · 값 "!C!cffffff%d%%"(0xcf940) 를 그 폭 가운데 (…, y + 0x91)
 * ```
 * 값은 skin[+0x1f0 + 줄](s8) — 나리 n·100/15 · 시즌 s·20.
 */
export const PROGRESS_ROW = {
  frame: 14,
  frameX: PANEL.x - 67 + 184,
  frameWidth: 67,
  bulletImage: 38,
  bulletX: PANEL.x + 13,
  modeFrames: [12, 15],
  modeLabelX: PANEL.x + 23,
  labelFrame: 275,
  /** "진행도" 는 모드 이름 오른쪽 끝에서 2px 뒤 (x0 + 모드폭 + 0x19) */
  labelGap: 2,
  /** 모드 이름·"진행도"·값 글의 y — y0 + 10 + 0x91 */
  firstY: PANEL.y + 10 + 0x91,
  step: 20,
  /** 노란 네모는 글보다 1 아래(+0x92), 프레임 14 는 4 위(+0x8d) */
  bulletDy: 1,
  frameDy: -4,
} as const

/** 진행도 값 — 나리 줄 = 얻은 칸 수 × 100 / 15 (0xca7b5, 버림) · 시즌 줄 = 얻은 칸 수 × 20 */
export const endingProgressOf = (row: number, gained: number) => (row === 0 ? Math.trunc((gained * 100) / NARI_ENDING_CELL_COUNT) : gained * 20)
