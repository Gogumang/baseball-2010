import { ORIGINAL_COLORS } from '@/shared/config/design'
/**
 * 화면 머리띠·바닥띠 (binary.mod 0x54d94, ui/game_frame.pzx — layout-re 2차, 바이트 확인).
 * slide = 미끄러짐 값(+0x86), 정착하면 30.
 */
export const HEADER_TILE_XS = [-10, 39, 88]
export const HEADER_CORNER_X = 135
export const FOOTER_TILE_XS = [233, 226, 219, 212, 205, 198]
export const FOOTER_CORNER_X = 182
export const BACK_ICON_X = 206
export const GAME_POINT_LEFT = 168
/** 숫자 오른쪽 끝 = x0 + 67 */
export const GAME_POINT_DIGITS_RIGHT = GAME_POINT_LEFT + 67
export const FRAME_COLORS = {
  headerBand: ORIGINAL_COLORS.headerBand,
  headerLine: ORIGINAL_COLORS.headerLine,
  footerBand: ORIGINAL_COLORS.footerBand,
  footerLine: ORIGINAL_COLORS.footerLine,
  pill: ORIGINAL_COLORS.panelDeep,
}

/** 머리띠 기준 Y (정착 −8) */
export const headerTopOf = (slide: number) => slide - 38
/** 바닥띠 기준 B (정착 320) */
export const footerBottomOf = (slide: number) => 350 - slide

/** 머리띠 제목 — 종류 8 = 그림9 "나만의리그" + 그림10 "타자편" (0x169da) */
export const TITLE_IMAGES = {
  나만의리그타자편: [
    { image: 9, x: 8, dy: 15 },
    { image: 10, x: 98, dy: 21 },
  ],
} as const
export type ScreenFrameTitle = keyof typeof TITLE_IMAGES

/** gpoint 숫자 그림 폭 — 1 만 4px, 나머지 8px (그림 크기) */
export const gamePointDigitWidthOf = (digit: string) => (digit === '1' ? 4 : 8)
