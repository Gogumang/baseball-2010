/**
 * 메인 메뉴 배치 — 원본 그림을 그대로 쓴다.
 *
 * 확정된 것 (그림 치수를 직접 읽었다):
 *   배너   `mode_back/000` 240×84
 *   글자   `main_ui/frames/NNN` 높이 27, 폭은 글자마다 다르다
 *   선택 바 `main_ui/002` 125×15
 *   설명 판 `main_ui/003` 149×63
 *
 * **추정**: 목록의 x·y 와 줄 간격. 원본은 좌표를 코드 안에 들고 있어 아직 못 읽었다 (layout-re 미해독).
 * 그림 치수에서 자연스럽게 나오는 값(가운데 정렬, 배너 아래부터, 글자 높이만큼 내려가기)으로 뒀다.
 */
export const MENU_BANNER = { x: 0, y: 0, width: 240, height: 84 } as const

/** 글자 그림의 공통 높이 */
export const MENU_LABEL_HEIGHT = 27
/** 목록 첫 줄 위치 — 배너 바로 아래 (추정) */
export const MENU_LIST_TOP = 90
/** 줄 간격 — 일곱 줄이 설명 판 위에 들어가도록 잡았다 (추정) */
export const MENU_ROW_STEP = 22
/** 화면 가운데 */
export const SCREEN_CENTER_X = 120

/** 고른 줄 뒤에 까는 바 */
export const MENU_SELECTION_BAR = { frame: 2, width: 125, height: 15 } as const

/** 설명 판 — 목록 아래 가운데 (추정) */
export const MENU_DESCRIPTION_PANEL = { frame: 3, x: 46, y: 250, width: 149, height: 63 } as const

/** 줄 번호 → 글자 그림의 y */
export function menuRowTopOf(index: number): number {
  return MENU_LIST_TOP + index * MENU_ROW_STEP
}

/** 고른 줄의 바 y — 글자 가운데에 오도록 내린다 */
export function selectionBarTopOf(index: number): number {
  return menuRowTopOf(index) + Math.trunc((MENU_LABEL_HEIGHT - MENU_SELECTION_BAR.height) / 2)
}
