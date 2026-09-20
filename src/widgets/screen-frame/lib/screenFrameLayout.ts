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

/**
 * 머리띠 제목 — 제목번호 → game_frame 이미지 (점프표 0xd19b0 17칸, P6 1절 확정).
 *
 * 제목 그림은 **(8, 7)**, 시즌모드만 x = 10. 부제(타자편/투수편)는 **(98, 13)** 이다.
 * `dy` 는 머리띠 기준 Y 에서 잰 값이라 제목 15 · 부제 21 이 된다 (둘 다 +8).
 */
export const TITLE_IMAGES = {
  '2010프로야구': [{ image: 3, x: 8, dy: 15 }],
  팀선택: [{ image: 5, x: 8, dy: 15 }],
  '선공/구장': [{ image: 4, x: 8, dy: 15 }],
  마선수선택: [{ image: 8, x: 8, dy: 15 }],
  경기정보: [{ image: 12, x: 8, dy: 15 }],
  타자엔트리: [{ image: 7, x: 8, dy: 15 }],
  투수엔트리: [{ image: 6, x: 8, dy: 15 }],
  나만의리그타자편: [
    { image: 9, x: 8, dy: 15 },
    { image: 10, x: 98, dy: 21 },
  ],
  나만의리그투수편: [
    { image: 9, x: 8, dy: 15 },
    { image: 11, x: 98, dy: 21 },
  ],
  시즌모드: [{ image: 22, x: 10, dy: 15 }],
  미션모드: [{ image: 18, x: 8, dy: 15 }],
  미션모드타자편: [
    { image: 18, x: 8, dy: 15 },
    { image: 10, x: 98, dy: 21 },
  ],
  미션모드투수편: [
    { image: 18, x: 8, dy: 15 },
    { image: 11, x: 98, dy: 21 },
  ],
  홈런더비: [{ image: 13, x: 8, dy: 15 }],
  대전모드: [{ image: 31, x: 8, dy: 15 }],
  명예의전당: [{ image: 29, x: 8, dy: 15 }],
} as const
export type ScreenFrameTitle = keyof typeof TITLE_IMAGES

/** gpoint 숫자 그림 폭 — 1 만 4px, 나머지 8px (그림 크기) */
export const gamePointDigitWidthOf = (digit: string) => (digit === '1' ? 4 : 8)
