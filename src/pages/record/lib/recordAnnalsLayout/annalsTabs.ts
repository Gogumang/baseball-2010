export const SCREEN_WIDTH = 240

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

export const tabIconWidthOf = (tab: number, selected: number) => (tab === selected ? TAB_SELECTED_WIDTH : TAB_ICON_WIDTH)

/** 탭 커서 프레임 9 (72×17) — `x = 24 + 박스x`, `y = 54 + 박스y − 2 = 54` (0x2e5ca~0x2e618) */
export const TAB_CURSOR = { frame: 9, width: TAB_SLOT_WIDTH, height: TAB_SLOT_HEIGHT, y: 54 } as const

/**
 * 탭 이름 (img_text 276+탭) — `x = 24 + 박스x + (박스w − 이름폭)/2`, `y = 54 + 박스y + 2 = 58`
 * (0x2e568~0x2e5ba). 원본은 **고른 탭의 이름 하나만** 그린다 — 안 고른 탭은 막대 그림의 아이콘이다.
 */
export const TAB_NAME_Y = 58

export const tabNameXOf = (tab: number, nameWidth: number) => tabSlotXOf(tab) + Math.trunc((TAB_SLOT_WIDTH - nameWidth) / 2)

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
