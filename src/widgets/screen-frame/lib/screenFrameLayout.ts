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
/** 머리띠 G 숫자 0x54a60(skin, G, W − 72, 머리띠y + 0x12, 0x41, 0, 1, 1, 0, 1) (0x550e0~0x5510c) — `lib/gamePointBadge` */
export const HEADER_GAME_POINT = { x: 240 - 72, dy: 0x12, width: 0x41, align: 1, plus: false, plate: true } as const
export const FRAME_COLORS = {
  headerBand: ORIGINAL_COLORS.headerBand,
  headerLine: ORIGINAL_COLORS.headerLine,
  footerBand: ORIGINAL_COLORS.footerBand,
  footerLine: ORIGINAL_COLORS.footerLine,
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


/**
 * **바닥비트** (0x54d95 의 [sp+0x3c], 0x55220~0x554f4 — 직접 떴다). 비트 0 은 아무 데서도 안 본다.
 * ```
 * 0x4   이미지 21 되돌아가기 (W − 19 − 15, B − 6 − 13 + 3)
 * 0x20  프레임 5 "#재선택"   (2, B − 6 − 12)          ; 왼쪽 넷은 같은 자리 — 0x20 → 0x8 → 0x10 → 0x80 차례로 덧그린다
 * 0x8   프레임 3 "#타자"
 * 0x10  프레임 2 "#투수"
 * 0x80  프레임 8 "#닉네임"
 * 0x2   프레임 1 "0상세정보"  (W/2 − 47/2 = 97, B − 6 − 12)   ; 가운데 넷도 같은 자리 — 0x2 → 0x40 → 0x100 → 0x200
 * 0x40  프레임 6 "0경기설정"  — 그릴 때마다 [skin+0x410]++ 의 `% 18 ≤ 8` 일 때만 (깜박임)
 * 0x100 프레임 7 "#목표"
 * 0x200 프레임 9 "0레벨업"
 * ```
 * 프레임은 모두 47×12 (원점 0,0). 자리의 높이·폭은 프레임 1 크기(0xba815(…, 1, 1))로 잰다.
 */
export const FOOTER_BITS = {
  back: 0x4,
  reselect: 0x20,
  batter: 0x8,
  pitcher: 0x10,
  nickname: 0x80,
  detail: 0x2,
  gameSettings: 0x40,
  goal: 0x100,
  levelUp: 0x200,
} as const
/** 왼쪽 표시 (그리는 차례대로) — [비트, game_frame 프레임] */
export const FOOTER_LEFT_MARKS = [
  [FOOTER_BITS.reselect, 5],
  [FOOTER_BITS.batter, 3],
  [FOOTER_BITS.pitcher, 2],
  [FOOTER_BITS.nickname, 8],
] as const
/** 가운데 표시 (그리는 차례대로) — [비트, game_frame 프레임] */
export const FOOTER_CENTER_MARKS = [
  [FOOTER_BITS.detail, 1],
  [FOOTER_BITS.gameSettings, 6],
  [FOOTER_BITS.goal, 7],
  [FOOTER_BITS.levelUp, 9],
] as const
export const FOOTER_MARK_WIDTH = 47
export const FOOTER_MARK_HEIGHT = 12
export const FOOTER_LEFT_X = 2
export const FOOTER_CENTER_X = 240 / 2 - (FOOTER_MARK_WIDTH >> 1)
/** 표시 윗변 = B − 6 − 12 */
export const footerMarkTopOf = (bottom: number) => bottom - 6 - FOOTER_MARK_HEIGHT
/** "0경기설정" 깜박임 — 카운터 `% 18 ≤ 8` (0x553f0~0x5540c) */
export const isGameSettingsMarkShown = (counter: number) => counter % 18 <= 8
