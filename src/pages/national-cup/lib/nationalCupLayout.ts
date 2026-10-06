import {
  HEADER_CELLS,
  HEADER_DIVIDER_COUNT,
  NATIONAL_MATCH_ROW_COUNT,
  PERCENT_OFFSET,
  RANK_GLYPH_HEIGHT,
  ROW_CELLS,
  ROW_FRAME,
  ROW_FRAME_ORIGIN,
  ROW_STEP,
  STANDINGS_WINDOW,
  TEAM_LABEL_BASE_FRAME,
  rankGlyphsOf,
  valueGlyphsOf,
  winningPercentOf,
} from '@/widgets/standings/lib/standingsLayout'

/**
 * 국가대항전 화면 배치.
 *
 * **둘째 화면(나리 상태 135 그림 0x168dc → 0x168a4 · 시즌 0xf4 그림 0xae5c → 0xae24)은 순위표 `0x7f070` 를 그대로 쓴다.**
 * 그 함수는 `L+0xac`(국가대항전 진행 플래그)가 서 있으면 `7f1d2` 에서 **4줄** 에서 멈춘다 —
 * `standingsLayout.ts` 의 `NATIONAL_MATCH_ROW_COUNT` 가 바로 그 값이다 (P5·P6 확정).
 * 팀 이름표도 같은 `img_text 65 + 팀번호` 라 10~13 이 **75·76·77·78 = 대한민국·일본·쿠바·미국** 이다.
 * 그래서 배치 상수는 새로 만들지 않고 순위표 것을 그대로 가져와 다시 내보낸다.
 *
 * 첫 화면(나리 134 그림 0x19fc8 · 시즌 0xf3 그림 0xe6e4)은 **대진판 0x85af4** 다 — 아래 `BRACKET_*`.
 */
export {
  HEADER_CELLS,
  HEADER_DIVIDER_COUNT,
  PERCENT_OFFSET,
  RANK_GLYPH_HEIGHT,
  ROW_CELLS,
  ROW_FRAME,
  ROW_FRAME_ORIGIN,
  ROW_STEP,
  STANDINGS_WINDOW,
  TEAM_LABEL_BASE_FRAME,
  rankGlyphsOf,
  valueGlyphsOf,
  winningPercentOf,
}

/** 대회 순위표는 **4줄** 이다 (`0x7f070` 의 `L+0xac` 가지) */
export const NATIONAL_CUP_ROW_COUNT = NATIONAL_MATCH_ROW_COUNT

export const SCREEN = { width: 240, height: 320 } as const

/**
 * 대진판 `0x85af4(ui)` (직접 떴다, 끝 0x85e36 → 머리띠 0x7f4ec).
 *
 * 단계 n = `S+0x12d`(= L+0xad) 로 mode_ui(`[ui+0x138]`) 프레임 하나를 (0, 0) 원점에 통째로 그리고(vtable+0x10),
 * 그 프레임의 박스(0x94a65 → 0x94fe1 모드 0 = 박스 그대로)에 그림을 가운데(정렬 0x22) 맞춰 얹는다.
 * ```
 * n > 1 (풀리그)  프레임 66 ([..]+0x108)   박스 0 ← img_text (314 − n)  팔레트 3 (0x913e5(애니, 3))
 *                                           i = 0..3:  팀 = 0xb7615(L, n, i)
 *                                             박스 i+1 ← team_logo 그림[팀]       (0xb9d35, [ui+0x384])
 *                                             박스 i+5 ← img_text 65 + 팀  팔레트 0 (0xb9e05)
 * n == 1 (결승)   프레임 67 ([..]+0x10c)   박스 0 ← img_text 313(0x4e4/4)  팔레트 3
 *                                           i = 0..1:  박스 i+1 ← 로고 · 박스 i+3 ← 이름표
 * n ≤ 0 (끝)      프레임 68 ([..]+0x110)   S+0x12c ≠ 0 이면  팀 = S+0x144(우승국)
 *                                             박스 0 ← 로고 · 박스 1 ← 이름표 (팔레트 0)
 * ```
 * 박스 값은 `public/sprites/mode_ui/frames/boxes.json` 그대로다. 풀리그 칸 0·1 이 위 경기(대한민국 · 상대),
 * 칸 2·3 이 아래 경기(같은 날 CPU 끼리 0xc2dac) 다 — 프레임 66 그림에 "VS" 가 두 줄 박혀 있다.
 */
export type BracketBox = readonly [x: number, y: number, width: number, height: number]

export const BRACKET_FRAME = { 풀리그: 66, 결승: 67, 끝: 68 } as const

/** 프레임 66 박스 — [0] 제목 · [1..4] 로고 · [5..8] 이름표 */
export const BRACKET_LEAGUE_BOXES: readonly BracketBox[] = [
  [85, 41, 70, 18],
  [20, 75, 76, 77], [146, 75, 76, 77], [21, 176, 76, 77], [146, 176, 76, 77],
  [21, 154, 74, 18], [147, 154, 74, 18], [22, 255, 74, 18], [147, 255, 74, 18],
]
/** 프레임 67 박스 — [0] 제목 · [1..2] 로고 · [3..4] 이름표 */
export const BRACKET_FINAL_BOXES: readonly BracketBox[] = [
  [85, 41, 70, 18],
  [20, 130, 76, 77], [146, 131, 76, 77],
  [21, 212, 74, 18], [147, 212, 74, 18],
]
/** 프레임 68 박스 — [0] 우승국 로고 · [1] 이름표 */
export const BRACKET_END_BOXES: readonly BracketBox[] = [[82, 118, 76, 71], [83, 190, 74, 18]]

/** 풀리그 제목 = img_text (314 − n) — n 4·3·2 → 310·311·312 (0x85b6e `movs #0x9d ; lsls #1 ; subs n`) */
export const BRACKET_LEAGUE_TITLE_BASE = 314
/** 결승 제목 = img_text 313 (0x85cae 의 0x4e4 / 4) */
export const BRACKET_FINAL_TITLE_FRAME = 313

/**
 * team_logo 그림 크기 (PNG 를 읽어 적었다) — 0xb9d35 가 가운데 맞춤에 쓴다. 대회 4국 10~13 만.
 * 0x85bcc~0x85bd4: 그림 = `[[ui+0x384]+8]+8 [팀]` — 프레임이 아니라 **그림** 목록이다.
 */
export const TEAM_LOGO_SIZES: Readonly<Record<number, readonly [width: number, height: number]>> = {
  10: [76, 76], 11: [76, 77], 12: [76, 77], 13: [77, 76],
}

/**
 * 그림 가운데(0xb9d35 → 0xb9c5c, 정렬 0x22): 가로 d = 박스폭 − 그림폭 → `x + trunc(d/2) + d % 2`(C 나머지 — 양수면 올림),
 * 세로 `y + trunc((박스높이 − 그림높이)/2)`.
 */
export function imageCenterOf(box: BracketBox, width: number, height: number): { readonly x: number; readonly y: number } {
  const dx = box[2] - width
  return { x: box[0] + Math.trunc(dx / 2) + (dx % 2), y: box[1] + Math.trunc((box[3] - height) / 2) }
}

/**
 * 프레임 가운데(0xb9e05 → 0xb9d74, 정렬 0x22): 가로 `x + ((박스폭 − 프레임폭) >> 1)`(산술 밀기 — 내림),
 * 세로 e = 박스높이 − 프레임높이 → `y + trunc(e/2) + e % 2`(양수면 올림). 원점은 프레임이 따로 더한다.
 */
export function frameCenterOf(box: BracketBox, width: number, height: number): { readonly x: number; readonly y: number } {
  const dy = box[3] - height
  return { x: box[0] + ((box[2] - width) >> 1), y: box[1] + Math.trunc(dy / 2) + (dy % 2) }
}
