/**
 * 기록연감 배치 (메인 메뉴 상태 30, 그리기 0x2e29c~0x2fc12 — P6 2c 확정).
 *
 * ```
 * 창 = 공용 판 (24, 54, 192, 212) · x0 = W/2 − 96 = 24 · y0 = H/2 − 106 = 54
 * 탭 막대 = slt_frame 프레임 4 + 탭 (192×19) 을 (24, H/2 − 108 = 52)
 * 탭 커서 = 프레임 9 (72×17)
 * ```
 * 그림은 모두 `ui/slt_frame.pzx`(this+0x9c)와 `ui/num.pzx`, 전역 `img_text` 다.
 */
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

const SCREEN_WIDTH = 240

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** 탭 막대 — 고른 탭만 넓고 흰 칸이라 탭마다 프레임이 다르다 (표 0xcedcc = [4,5,6,7,8]) */
export const TAB_BAR = { firstFrame: 4, x: 24, y: 52, width: 192, height: 19 } as const
/** 탭 이름 — img_text 276 기록 · 277 진행 · 278 스킬 · 279 닉네임 · 280 통계 (표 0xcedb8) */
export const TAB_NAME_FRAMES = [276, 277, 278, 279, 280] as const
export const TAB_NAMES = ['기록', '진행', '스킬', '닉네임', '통계'] as const
export const TAB_COUNT = TAB_NAME_FRAMES.length

/**
 * 탭 이름·커서의 x 는 탭 막대 프레임의 **박스**가 정한다 (0x94a65 → 0x94fe1,
 * 박스 한 칸 = 8바이트 i16 x,y,w,h). slt_frame 프레임 4~8 의 **박스 0** 을 직접 읽은 값이다 (S12 1절 확정):
 *
 * ```
 * 탭 0 (2, 2, 72, 17) · 1 (31, …) · 2 (60, …) · 3 (89, …) · 4 (118, 2, 72, 17)
 * ```
 * x 간격은 **29** 다 — 막대 폭 192 를 5 로 나눈 38.4 가 아니다.
 * 박스는 프레임 왼쪽 위가 원점이라 화면 좌표는 막대 x0 = **24** 를 더한다.
 */
export const TAB_SLOT_BOX_XS = [2, 31, 60, 89, 118] as const
export const TAB_SLOT_WIDTH = 72
export const TAB_SLOT_HEIGHT = 17
/** 고른 탭 박스의 화면 x — 26 · 55 · 84 · 113 · 142 (0x2e51c 가 읽는 박스 0) */
export const tabSlotXOf = (tab: number) => TAB_BAR.x + TAB_SLOT_BOX_XS[tab]

/**
 * 박스는 **고른 탭의 글씨 칸**이다. 안 고른 탭은 아이콘만 든 29px 칸이고 그림은 막대 프레임에 붙어 있다
 * (프레임 파트 배치 — 안 고른 탭 i 의 x = `29i`(i < 고른탭) · `29i + 46`(i > 고른탭), 고른 탭은 폭 75).
 */
export const TAB_ICON_STEP = 29
export const TAB_ICON_WIDTH = 29
export const TAB_SELECTED_WIDTH = 75
export const TAB_SELECTED_GAP = 46
export function tabIconXOf(tab: number, selected: number): number {
  const base = TAB_BAR.x + TAB_ICON_STEP * tab
  return tab > selected ? base + TAB_SELECTED_GAP : base
}
export const tabIconWidthOf = (tab: number, selected: number) =>
  (tab === selected ? TAB_SELECTED_WIDTH : TAB_ICON_WIDTH)

/** 탭 커서 프레임 9 (72×17) — `x = 24 + 박스x`, `y = 54 + 박스y − 2 = 54` (0x2e5ca~0x2e618) */
export const TAB_CURSOR = { frame: 9, width: TAB_SLOT_WIDTH, height: TAB_SLOT_HEIGHT, y: 54 } as const

/**
 * 탭 이름 (img_text 276+탭) — `x = 24 + 박스x + (박스w − 이름폭)/2`, `y = 54 + 박스y + 2 = 58`
 * (0x2e568~0x2e5ba). 원본은 **고른 탭의 이름 하나만** 그린다 — 안 고른 탭은 막대 그림의 아이콘이다.
 */
export const TAB_NAME_Y = 58
export const tabNameXOf = (tab: number, nameWidth: number) =>
  tabSlotXOf(tab) + Math.trunc((TAB_SLOT_WIDTH - nameWidth) / 2)

/** 쪽 수가 있는 탭 (표 0xce8dc s8) — 기록 6쪽 · 닉네임 3쪽 · 통계 2쪽 */
export const TAB_PAGE_COUNTS = [6, 0, 0, 3, 2] as const

/** 쪽 번호·화살 (W/2 ± …, y0 + 22 = 76) */
export const PAGER = {
  numberX: SCREEN_WIDTH / 2 + 52,
  totalX: SCREEN_WIDTH / 2 + 66,
  y: 76,
  leftArrow: { image: 20, x: SCREEN_WIDTH / 2 + 35, y: 77 },
  rightArrow: { image: 20, x: SCREEN_WIDTH / 2 + 79, y: 77 },
} as const

/** 쪽 제목 줄 — 노란 네모 이미지 38 (34, 78) + 제목 (42, 76) */
export const PAGE_TITLE = { bulletImage: 38, bulletX: 34, bulletY: 78, x: 42, y: 76 } as const

/**
 * 칸 격자 (탭 1 진행 · 탭 2 스킬, 0x2ebe0~0x2ec18):
 * `x = W/2 − 87 + 44·(i % 4)` = 33 · 77 · 121 · 165 · `y = y0 + 33 + 28·(i / 4)` = 87 · 115 · 143, 칸 41×25
 */
export const CELL_GRID = {
  columns: 4,
  visibleRows: 3,
  width: 41,
  height: 25,
  firstX: SCREEN_WIDTH / 2 - 87,
  stepX: 44,
  firstY: PANEL.y + 33,
  stepY: 28,
} as const

export function cellPositionOf(index: number) {
  return {
    x: CELL_GRID.firstX + CELL_GRID.stepX * (index % CELL_GRID.columns),
    y: CELL_GRID.firstY + CELL_GRID.stepY * Math.floor(index / CELL_GRID.columns),
  }
}

/** 얻은 칸 파랑 17 (진행) · 보라 20 (스킬) · 못 얻은 칸 회색 18 · 고른 칸 노란 테두리 21 */
export const CELL_FRAMES = { progress: 17, skill: 20, locked: 18, cursor: 21 } as const
/** 못 얻은 칸의 "?" 두 개 — 이미지 111 을 (x+10, y+7) · (x+20, y+7) */
export const LOCKED_MARK = { image: 111, dx: [10, 20], dy: 7 } as const

/**
 * 위·아래 스크롤 표시 — 프레임 24 ▲ (42×11) · 23 ▼ (0x2eb2c~0x2ebc8 · 0x2eff4~0x2f090).
 * x 는 둘 다 프레임 24 폭으로 가운데 (W/2 − 21). y 는 깜박임(`isBlinkOn`)에 따라 1px 까딱인다 —
 * 켜지면 ▲ y0 + 20 · ▼ y0 + 116, 꺼지면 ▲ y0 + 21 · ▼ y0 + 115.
 */
export const SCROLL_MARKS = {
  up: { frame: 24, yOn: PANEL.y + 20, yOff: PANEL.y + 21 },
  down: { frame: 23, yOn: PANEL.y + 116, yOff: PANEL.y + 115 },
  x: SCREEN_WIDTH / 2 - 21,
} as const

/** 닉네임 줄 — slt_frame 프레임 12 (164×18) 을 (33, 89 + 19i) */
export const NAME_ROW = {
  frame: 12,
  x: SCREEN_WIDTH / 2 - 87,
  firstY: PANEL.y + 35,
  step: 19,
  numberX: SCREEN_WIDTH / 2 - 72,
  nameX: SCREEN_WIDTH / 2 - 50,
  visibleRows: 8,
} as const

/**
 * 아래 합계 줄 — 프레임 15 (101×18) + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑. 탭 3 (0x2f834~0x2f920) · 탭 4 (0x2fa60~0x2fb90)
 * 가 같은 꼴이다 — w·h = 프레임 15 상자(101, 18), x0 = 24 · y0 = 54:
 * 프레임 15 (x0 − w + 0xb6 = 105, y0 − h + 0xce = 242) · 이미지 0x26 (x0 + 0x10 = 40, y0 − h + 0xd3 = **247**) ·
 * img_text 0x10d (x0 + 0x1a = 50, y0 − h + 0xd2 = **246**) · 값 0xba269(글, x0 − w + 0xbb = **110**, y0 − h + 0xd2 = **246**, w − 10 = **91**)
 * 호출 2fb90 (탭 3 `"!C!cffff00%d/%d"` 가운데 · 탭 4 `"!R!cFFFF00…"` 오른쪽). *(정정 r129 — 전에는 네모 246 · 글씨 242 · 값 (105, 243, 101))*
 */
export const TOTAL_ROW = {
  frame: 15,
  frameX: PANEL.x - 101 + 0xb6,
  bulletX: PANEL.x + 0x10,
  bulletDy: 5,
  labelFrame: 269,
  labelX: PANEL.x + 0x1a,
  labelDy: 4,
  value: { x: PANEL.x - 101 + 0xbb, dy: 4, width: 101 - 10 },
  y: 242,
} as const

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
  ORIGINAL_MAIN_MENU_TEXT[189] ?? '', ORIGINAL_MAIN_MENU_TEXT[190] ?? '', ORIGINAL_MAIN_MENU_TEXT[191] ?? '', ORIGINAL_MAIN_MENU_TEXT[192] ?? '', ORIGINAL_MAIN_MENU_TEXT[193] ?? '', ORIGINAL_MAIN_MENU_TEXT[194] ?? '', ORIGINAL_MAIN_MENU_TEXT[195] ?? '', ORIGINAL_MAIN_MENU_TEXT[196] ?? '', ORIGINAL_MAIN_MENU_TEXT[197] ?? '', ORIGINAL_MAIN_MENU_TEXT[198] ?? '', // StrMAINMENU[189~198]
  ORIGINAL_MAIN_MENU_TEXT[199] ?? '', ORIGINAL_MAIN_MENU_TEXT[200] ?? '', ORIGINAL_MAIN_MENU_TEXT[201] ?? '', ORIGINAL_MAIN_MENU_TEXT[202] ?? '', ORIGINAL_MAIN_MENU_TEXT[203] ?? '', // [199~203]
  ORIGINAL_MAIN_MENU_TEXT[204] ?? '', ORIGINAL_MAIN_MENU_TEXT[205] ?? '', ORIGINAL_MAIN_MENU_TEXT[206] ?? '', ORIGINAL_MAIN_MENU_TEXT[207] ?? '', ORIGINAL_MAIN_MENU_TEXT[208] ?? '', // [204~208]
] as const
/** 칸 0~14 = 나리 엔딩(전역기록 +0xa8 + i) — 그 뒤 15~19 = 시즌 엔딩(+0xa0 + (i − 15)) */
export const NARI_ENDING_CELL_COUNT = 15
export const SEASON_ENDING_CELL_COUNT = 5

/** 얻은 엔딩 칸의 프레임 (0x2ecfa~0x2ed3c) */
export function endingCellFrameOf(index: number): number {
  if (index === 8 || index === 9 || index === 14 || index === 18 || index === 19) return 20
  if (index === 0 || index === 1 || index === 10 || index === 15) return 19
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
export const endingProgressOf = (row: number, gained: number) =>
  (row === 0 ? Math.trunc((gained * 100) / NARI_ENDING_CELL_COUNT) : gained * 20)

/**
 * slt_frame 프레임 2(꼬리 탭)의 높이 h — 0x2f300~0x2f318 이 `0xba815(slt_frame, 2, 종류 1)` 상자를 [sp+0x140] 에 두고
 * 탭 2 그림이 그 +6(s16 h, 0x2f326 · 0x2f414 · 0x2f456)을 `y0 − h + …` 로 쓴다. 상자는 0x94962~0x9497c 가 (x, y, w, h) 를
 * strh 넷으로 채운다 — 프레임 2 는 91×15 다.
 */
const SKILL_TAB_FRAME_HEIGHT = 15

/** 스킬 설명 — 꼬리 탭 프레임 2 (91×15) + 설명 상자 0xbb28d(120, …, 173, 60) + 글 */
export const SKILL_DESCRIPTION = {
  tabFrame: 2,
  /** 0x2f330~0x2f34e — 0xba759(slt_frame, 2, 종류 1, W/2 − 0x56 = 34, y0 − h + 0x90 = 183) *(정정 r136 — 전에는 176)* */
  tabX: SCREEN_WIDTH / 2 - 86,
  tabY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x90,
  /**
   * 0x2f35e~0x2f36e — 0xbb28d(W/2, y0 + 0x91 = 199, 0xad, 0x3c, 정렬 2). 정렬 2 는 비트 1 만이라 x 만 가운데(bb29c~bb2a6),
   * y 는 그대로다(비트 5·6 이 y 를 옮긴다) *(정정 r136 — 전에는 190)*. 글(202)은 상자 위 3 아래다.
   */
  box: { centerX: 120, y: PANEL.y + 0x91, width: 173, height: 60 },
  /**
   * 글 — 0xba269(글, W/2 − 0x51 = 39, y0 + 0x94 = 202, 폭 −1, 색 −1, 0) (0x2f3a0 · 0x2f4d8 → 0x2f4e6~0x2f4ec 가 **0x2fb8e 로 뛴다**).
   * 0x2fb8c `subs r3, #0xa` 는 뛰어든 자리(0x2fb8e) 앞이라 안 지난다 — 폭은 −1 그대로다 *(정정 r133 — r129 노트의 "폭 −11" 은 이 뜀을 잘못 읽었다)*.
   * 폭 −1 이면 0x6ef4c 가 6efb0~6efd0 에서 0x9c52c 로 날 글 폭(0x0a 줄 중 최댓값)을 재어 폭으로 쓰므로 **줄은 `!N` 에서만 끊긴다**.
   * 글에 `!C` 가 없어 왼쪽 맞춤 · 줄 높이는 글꼴 +0x6c(11) + 줄간 +0x67(3) = 14 (0x6ef90~0x6efa4, R5).
   * 얻은 스킬은 `"%s!N효과 : !cFFFF00%s"`(0xcf978) = StrSKILL[i] · StrSKILL[i + 40](0x702b5) · 못 얻었으면 `"!cffffff아직 획득하지 못한!N스킬입니다."`(0xcf950).
   * 원본 그대로라 네 줄짜리 설명(202 + 56 = 258)은 상자(190~250) 아래로 넘친다.
   */
  text: { x: SCREEN_WIDTH / 2 - 0x51, y: PANEL.y + 0x94 },
} as const


/**
 * **얻은 스킬 그림 두 장** (0x2f3b0~0x2f488, r136 직접 떴다) — 표 [+0x13c + 4i] ≠ −1(얻음)일 때만 상자 위에 그린다.
 * ```
 * 2f3b0  등급 = 칸 ≤ 7 ? 0 : 칸 ≤ 0x17 ? 1 : 2
 * 2f3e4  s = 칸 ≤ 0x27 ? [[this+0x120]+0x13c + 4·칸] : −1 ; 0x5f351(_, s) 비트 1(마이너스) 이면 이미지 0x7d, 아니면 0x7c
 * 2f3fc  0x913e5([0x1552ae8], 0)                                      ; img_text 팔레트 0(흰 글자)
 * 2f444  0xba759(img_text [0x1552aec], 표[sp+0x2a4][등급], 종류 1, W/2 − 0x3d = 59, y0 − h + 0x92 = 185)
 *        표 = 0xced88 [281 공통, 149 타자, 150 투수] (0x2e358~0x2e35e 가 스택에 옮긴다)
 * 2f488  0xba759(slt_frame, 0x7c/0x7d, 종류 0(이미지), W/2 − 0x24 = 84, y0 − h + 0x91 (+1 = [sp+0xa8] 깜박임이 켜졌으면))
 * ```
 * 표 [+0x13c] 는 탭을 고를 때 0x58a3c(0x2b6fc)가 채운다 — 모두 −1 로 두고 칸 0~7 은 스킬 비트 i 가 +0xf4(타자편)·+0xf8(투수편)
 * "한 번이라도 켠 스킬" 중 하나에 있으면 i, 칸 8~23 은 +0xf4 의 비트 k = 칸, 칸 24~39 는 +0xf8 의 비트 k = 칸 − 16 이면 k 를 적는다.
 * 곧 0x5f351 이 받는 값은 칸이 아니라 **스킬 비트 번호**다(투수 칸 33~36 새가슴 · 비겁자 · 깃털 · 더티볼 → 비트 17~20 → 빨간 아래 화살).
 */
export const SKILL_BADGE = {
  gradeFrames: [281, 149, 150],
  gradeX: SCREEN_WIDTH / 2 - 0x3d,
  gradeY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x92,
  /** 0x7c 파란 위 화살 · 0x7d 빨간 아래 화살 (slt_frame 이미지) */
  plusImage: 0x7c,
  minusImage: 0x7d,
  arrowX: SCREEN_WIDTH / 2 - 0x24,
  arrowY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x91,
} as const

/** 스킬 등급 (0x2f3b0~0x2f3c0) — 0 공통 · 1 타자 · 2 투수 */
export const skillGradeOf = (cell: number): 0 | 1 | 2 => (cell <= 7 ? 0 : cell <= 0x17 ? 1 : 2)

/* 칸 → 스킬 비트 번호(표 [+0x13c], 0x58a3c)는 `entities/collection` 의 `annalsSkillOfCell` — 켠 스킬 비트로 −1 도 가른다 */

/** 못 얻은 스킬 설명 `"!cffffff아직 획득하지 못한!N스킬입니다."`(0xcf950) — 0x2f37e~0x2f3ae (칸 > 0x27 이거나 표 [+0x13c + 4i] == −1) */
export const SKILL_NOT_GAINED_TEXT = '!cffffff아직 획득하지 못한!N스킬입니다.'
/**
 * 기록·통계 탭의 목록 격자 — 탭 0 `0x79ed5(격자, 종류, 120, y0 + 0x24 = 90, 칸너비 [174], 줄높이 18, 1열, 8줄)` (0x2e8e6~0x2e92e) ·
 * 탭 4 는 같은 꼴에 종류 2 · **y0 + 0x23 = 89** (0x2f96a~0x2f9ae). 칸 x = 120 − 174/2 = 33, 칸 y = 첫 y + 18 × 줄.
 * `x` 는 칸 바탕 프레임을 놓는 x(= 칸 x − 1)다. 칸 그리기 0x7a571 은 칸 (x, y) 와 칸너비 174 로 글을 놓는다 —
 * 이름 (칸 x + 5, 칸 y + 2)(0x7a98c~0x7a9a2) · 0x7a08c(격자, 칸 x, 칸 y + 2, 칸너비 [격자+0x1c+4열], n)(0x7a9b4~0x7aa26).
 * *(정정 r129 — 전에는 글을 프레임 x 32 · 폭 176 에서 셌다)*
 */
export const LIST_GRID = { x: PANEL.x + 8, cellX: PANEL.x + 9, cellWidth: 174, firstY: PANEL.y + 36, step: 18, rows: 8 } as const
/** 탭 0 칸 이름 `"%s"`(0xd09bc) StrGAME[8 + n] 흰 글 — 0xba269(글, 칸 x + 5, 칸 y + 2, 폭 자리 = RGB(255,255,255) 값, −1, 0) 호출 7a9a2. 폭 자리에 색이 들어가 줄을 안 끊는다 */
export const LIST_NAME = { dx: 5, dy: 2 } as const
/**
 * 탭 4 통계 — 0x7a08c 종류 2 갈래. 값 `"!R!cffff00…"` 은 0xba269(글, x − 2, y, 칸너비 − 4)(7a1f8 · 7a2b2 · 7a306 · 7a366 ·
 * 7a3ba · 7a418 · 7a4b6 · 7a502 — 8갈래 모두 `subs r1,#2` · `subs r3,#4`), 이름 `"!cffffff%s"`(0xd09a8) 은
 * 0xba269(글, x + 3, y + 1, 칸너비 − 10)(7a52e~7a542). 여기 x·y 는 0x7a08c 가 받은 (칸 x, 칸 y + 2) 다.
 */
export const STAT_VALUE = { dx: -2, dy: 2, widthInset: 4 } as const
export const STAT_NAME = { dx: 3, dy: 3, widthInset: 10 } as const
/** 탭 4 통계 격자의 첫 칸 y — 0x2f9a6 `adds r3, #0x23` (탭 0 은 #0x24) */
export const STAT_LIST_FIRST_Y = PANEL.y + 0x23
/** 탭별 목록 격자 첫 칸 y (탭 0 · 4 만) */
export const listFirstYOf = (tab: number) => (tab === 4 ? STAT_LIST_FIRST_Y : LIST_GRID.firstY)

/**
 * 칸 바탕 — 0x7a571 의 종류별 칸 그리기(점프표 0xd40c0)가 칸마다 slt_frame **프레임**(0xba759 종류 1)을 (칸 x − 1, 칸 y − 1) 에:
 * 종류 0 → 10 · 종류 1 → 11 (0x7a928~0x7a954) · 종류 2 → 13 (0x7a9cc~0x7a9fe). 모두 174×18.
 * 탭 0 의 종류는 `쪽 [skin+0xfc] == 5 ? 1 : 0` (0x2e900~0x2e90a) — 스페셜기록 쪽(6쪽째)만 11 이다. 탭 4 는 늘 종류 2.
 */
export function listRowFrameOf(tab: number, page: number): number {
  if (tab === 4) return 13
  return page === 5 ? 11 : 10
}
export const LIST_ROW_FRAME_DY = -1

/**
 * **줄 커서** — 0x7a571 꼬리(0x7b3a0~0x7b406, 직접 떴다). 열림 애니가 끝났고(+9) 커서를 보이고(+6) 깜박임이 켜졌으면
 * 종류 0·1·2 는 점프표 0xd4118 → 0x7b3de: slt_frame 프레임 `셋째 인자 == 3 ? 0x36 : 0x19` 를 (고른 칸 x − 1, 고른 칸 y − 2) 에.
 * 기록연감은 셋째 인자 0 (0x2e9a6 · 0x2fa34) 이라 **프레임 25** (174×20 노란 테두리). 고른 칸 x·y 는 흔들림이 더해진 값이다.
 */
export const LIST_CURSOR = { frame: 0x19, dy: -2 } as const

/**
 * **탭 0 기록의 칸 이름** — 격자 종류 1 칸 그리기 0x7a916 이 칸 번호 n(= 쪽 × 8 + 줄)의 이름을 글 표 `[격자+0x90]` 의
 * `n + 8` 번(0x7a964~0x7a970)으로 찍는다 = StrGAME[8 + n]. 0~39 는 경기 기록(`RECORD_NAMES`), 40~47 은 아래 여덟
 * (StrGAME[48~55] — 끝 공백도 원본 글 그대로)이다.
 */
export const SPECIAL_RECORD_NAMES = [
  '시즌모드 리그 1위 1회', '시즌모드 리그 1위 5회', '시즌모드 리그 1위 10회', '미션모드 모두 성공',
  '기록달성 모두 성공 ', '스킬 모두 수집 ', '닉네임 모두 수집 ', '엔딩 모두 수집 ',
] as const
/** 달성 표시 칸이 시작하는 칸 번호 — 0x7a08c 의 `n > 0x27` 갈래 (`0x22db4(mgr, n − 0x28)`) */
export const SPECIAL_RECORD_FIRST_CELL = 0x28

/**
 * **달성 표시** — 0x7a08c(격자, x, y + 2, 칸너비, n) 의 종류 0·1 갈래(0x7a102~0x7a156, 직접 떴다):
 * ```
 * 0x22db4(mgr, n − 0x28) == 0 → 아무것도 안 그림
 * w = 0xba815([격자+0x94], 0x47, 0) 의 너비          ; slt_frame 이미지 71 (28×18)
 * 0xba759([격자+0x94], 0x47, 0, x + 칸너비 − w − 1, (y + 2) − 3, …)
 * ```
 * 곧 칸 오른쪽 끝에서 1px 안쪽에 오른쪽을 맞추고, 칸 위쪽보다 1px 위에 그린다.
 */
export const ACHIEVEMENT_MARK = { image: 71, width: 28, dx: -1, dy: -1 } as const

/**
 * **달성 횟수** — 같은 0x7a08c 의 `n ≤ 0x27` 갈래(0x7a0d0~0x7a0fc, 직접 떴다):
 * ```
 * sprintf(buf, "!R!cffff00%d", (u8)[[mgr+0xc8] + 4 + n])      ; 0xd4140
 * 0xba269(buf, x + 3, (y + 2) + 1, 칸너비 − 10, −1, 0)            ; 노랑 오른쪽 맞춤
 * ```
 * 달성 표시와 같은 기준(줄 위 = (y + 2) − 2)이라 글은 줄 위에서 3px 아래, 칸 왼쪽 3px 안에서 폭 − 10 칸 오른쪽에 붙는다.
 * 0 도 그대로 찍는다.
 */
export const RECORD_COUNT = { dx: 3, dy: 3, widthInset: 10 } as const

/**
 * **탭 0 설명 막대** (0x2e9b0~0x2ea86, 직접 떴다):
 * ```
 * 0xba759(slt_frame, 3, 프레임, x0 + 8, y0 + 0xbd)                 ; 막대 — 초점과 상관없이 늘
 * [skin+0xf6] ≠ 0(탭 막대 초점) → 여기서 꼬리 0x2fb94 로 (글 없음)
 * 글 = "!cffffff" + StrGAME[쪽 × 8 + 격자 커서 + 0x38]
 * 판이 덜 열렸으면(높이 ≤ 211) 판 안쪽으로 자르고 자르기 깃발 0
 * 0x5a8c8(skin, 글, x0 + 10, y0 + 0xc1, 폭 0xaa, 높이 0x10, 1, 자르기 깃발, 1)
 * ```
 * 0x5a8c8 = 흐르는 글: 깃발이 서면 (x + 2, y, 폭 − 4, 높이) 로 자르고, 글 폭 tw 를 재
 * `x' = x + 폭 − [skin+0x284] % (tw + 폭)` 에 왼쪽 맞춤으로 그린 뒤 [skin+0x284] += 3 (오른쪽에서 들어와 왼쪽으로 3px 씩).
 */
export const DESCRIPTION_BAR = { frame: 3, x: PANEL.x + 8, y: PANEL.y + 0xbd } as const
export const DESCRIPTION_TICKER = {
  x: PANEL.x + 10,
  y: PANEL.y + 0xc1,
  width: 0xaa,
  height: 0x10,
  /** 자르기 칸은 좌우 2px 안쪽 */
  clipInset: 2,
  /** 그릴 때마다 [skin+0x284] 가 오르는 값 */
  step: 3,
} as const

/** 흐르는 글의 왼쪽 x — 카운터 c · 글 폭 tw (0x5a91e~0x5a93a) */
export function tickerTextXOf(counter: number, textWidth: number): number {
  const { x, width } = DESCRIPTION_TICKER
  const period = textWidth + width
  return period > 0 ? x + width - (counter % period) : x + width
}

/**
 * 탭 3 스크롤 막대 — 0x58c10(…, x0 + 0xb3, y0 + 0x28, 그림) (0x58c56~0x58cf0):
 * 길 (203, 94, 7, 길이 + 2) 을 RGB(0x20, 0x30, 0x9e) 로 채우고, slt_frame 이미지 78(▲ 7×5)을 (203, 90) ·
 * 뒤집어 (203, 94 + 길이 + 1), 막대는 흰색 (204, 95 + 위치, 4, 막대 길이).
 */
export const NICKNAME_SCROLLBAR = {
  x: PANEL.x + 0xb3,
  y: PANEL.y + 0x28,
  width: 7,
  trackColor: '#20309e',
  arrowImage: 78,
  arrowDy: -4,
  thumbWidth: 4,
} as const
/** 쪽 제목 "공통/타자/투수" 다음 "닉네임"(img_text 279)은 제목 폭 + 2 뒤 (0x2f5aa~0x2f5ca) */
export const NICKNAME_TAB_LABEL = { frame: 279, gap: 2 } as const
