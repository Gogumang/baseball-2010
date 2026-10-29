import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 박스 하나 — 원본 프레임 박스(x, y, w, h)는 화면 절대 좌표다 */
export interface BracketBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 대진표 그림 = mode_ui 프레임 53 (195×210). 앵커 (0,0) 에 놓으면 원점 (24,48) 로 들어간다 */
export const BRACKET_BACKDROP = {
  folder: assetUrl('./sprites/mode_ui/frames'),
  frame: 53,
  anchorX: 0,
  anchorY: 0,
} as const

/**
 * 프레임 53 박스 0~3 — 팀 칸 계단(칸 3 이 가장 높다).
 * 칸 k 로고는 `team_logo 0x66431(skin, [this+0x384], [this+0x388 + 4k], 박스x + 3, 박스y + 3)` — 앉는 팀은 `CELL_QUALIFIER_INDEX`.
 */
export const TEAM_CELLS: readonly BracketBox[] = [
  { x: 25, y: 195, width: 41, height: 40 }, // 칸 0 — 딱지 "4위", 정규 3위 팀
  { x: 75, y: 195, width: 41, height: 40 }, // 칸 1 — 딱지 "3위", 정규 4위 팀
  { x: 125, y: 171, width: 41, height: 40 }, // 칸 2 — 2위
  { x: 175, y: 147, width: 41, height: 40 }, // 칸 3 — 1위
]

/** 로고 안쪽 여백 (0x66431 인자 박스x + 3) */
export const LOGO_INSET = 3

/**
 * 프레임 53 박스 4~7 — 순위 딱지. 칸 k 의 딱지 = 박스 4 + k, 숫자 4 − k (아래 `rankGlyphsOf` 주석).
 */
export const RANK_TAGS: readonly BracketBox[] = [
  { x: 26, y: 243, width: 39, height: 15 }, // 칸 0 "4위"
  { x: 76, y: 243, width: 39, height: 15 }, // 칸 1 "3위"
  { x: 126, y: 219, width: 39, height: 15 }, // 칸 2 "2위"
  { x: 176, y: 195, width: 39, height: 15 }, // 칸 3 "1위"
]

/**
 * 팀 칸 k 에 앉는 팀 = 대진 칸 (직접 떴다 — 0x8533c, 부르는 곳 0x693e 시즌 · 0x12110 나리):
 * ```
 * [this+0x388] = 0xb7649(L, 2, 0) = L[0x3c] (정규 3위)   ← 칸 0
 * [this+0x38c] = 0xb7649(L, 2, 1) = L[0x3d] (정규 4위)   ← 칸 1
 * [this+0x390] = 0xb7649(L, 1, 0) = L[0x3a] (정규 2위)   ← 칸 2
 * [this+0x394] = 0xb7649(L, 0, 0) = L[0x38] (정규 1위)   ← 칸 3
 * ```
 * 0x853ac 는 칸 k 에 로고 `0x66431(…, [this+0x388 + 4k], …)` 와 딱지 숫자 **4 − k** 를 그린다(0x85512).
 * 그래서 **"4위" 딱지 칸에 정규 3위 팀, "3위" 딱지 칸에 정규 4위 팀**이 앉는다 — 원본 그대로.
 * 값은 `qualifiers`(1~4위) 의 색인이다.
 */
export const CELL_QUALIFIER_INDEX: readonly number[] = [2, 3, 1, 0]

/** 칸 k 의 딱지 숫자 (0x85512 `movs r3, #4; subs r3, r3, r7`) */
export function rankLabelOfCell(cell: number): number {
  return 4 - cell
}

/** 진 팀 칸 덮기 — [0x15605d4] 검정 몸통 단계 7 (0x8584a `movs r3, #7`): 화면을 7/16 남긴다 */
export const DARK_CELL_STEP = 7

/** 덮는 칸 = 프레임 53 박스 k 를 (x, y, w, h + 1) 로 (0x85840 `adds r5, r3, #1`) */
export function darkCellBoxOf(cell: number): BracketBox {
  const box = TEAM_CELLS[cell]
  return { x: box.x, y: box.y, width: box.width, height: box.height + 1 }
}
