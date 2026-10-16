/**
 * 시즌모드(장면 0x105) 화면들이 함께 쓰는 배치.
 *
 * 근거: `docs/re/P6-screens.md` 1·3 절 · `docs/re/F-ui-layout.md` 6 절 · `docs/re/S3-stadium-items.md`.
 *
 * ⚠️ **시즌 관리 메뉴·구단관리 메뉴·선수영입·목표 화면의 원본 배치는 아직 안 풀렸다.**
 * P6 22절이 "시즌 끝 요약 화면(대진표 밖)의 그리기 함수" 를 남은 것으로 적어 두었고,
 * F 6절도 시즌 쪽 줄 좌표를 못 찾았다고 적었다. 그래서 이 파일에서 **확정**인 것은
 *   - 공용 판 (24, 54, 192, 212)
 * 하나뿐이고, 나머지 줄·글 자리는 전부 **근사**다. 근사한 값에는 하나하나 표시해 두었다.
 * (구장 아이템 창은 0x83378 종류 4 를 직접 떠 `pages/season/lib/stadiumItemWindow` 로 옮겼다.)
 */

/** 원본 화면 한 장 */
export const SCREEN = { width: 240, height: 320 } as const

export interface SeasonBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 공용 판 — `0x55e61(skin, 120, 160, 192, 212, 정렬 0x22)` → **(24, 54, 192, 212)** (확정).
 * P6 2f·5절과 F 6절이 같은 값을 적었다(x0 = W/2 − 96 = 24, y0 = H/2 − 106 = 54).
 */
export const SEASON_WINDOW: SeasonBox = { x: 24, y: 54, width: 192, height: 212 }

/** 판 안쪽 여백 (**원본 배치 미해독 — 근사**, 아이템 창 0x81dc0 의 박스 여백 8~9px 을 따랐다) */
export const WINDOW_INSET = 8

/** 제목 줄 (**근사**) — 판 위쪽 안쪽에 한 줄 */
export const TITLE_BOX: SeasonBox = {
  x: SEASON_WINDOW.x + WINDOW_INSET,
  y: SEASON_WINDOW.y + 6,
  width: SEASON_WINDOW.width - WINDOW_INSET * 2,
  height: 15,
}

/** 목록 첫 줄의 왼쪽 위 (**근사**) */
export const LIST_ORIGIN = { x: SEASON_WINDOW.x + WINDOW_INSET, y: SEASON_WINDOW.y + 26 } as const
/** 줄 높이·간격 — 순위표(0x7f070)의 18px 줄 관례를 그대로 따랐다 (**근사**) */
export const ROW_STEP = 18
export const ROW_HEIGHT = 15
export const ROW_WIDTH = SEASON_WINDOW.width - WINDOW_INSET * 2
/** 판 안에 들어가는 줄 수 — (212 − 26 − 6) / 18 = 10 (**근사**) */
export const VISIBLE_ROWS = 10

/**
 * 아래 설명 줄이 차지하는 높이 — 두 줄치 (**근사**).
 *
 * ⚠️ 예전에는 `FOOTER_BOX` 를 판 **안쪽** 목록 열 줄 바로 아래에 두었는데, 그러면 높이가
 * `266 − 260 − 4 = 2px` 밖에 안 남아 설명 글이 판 밖으로 넘쳐 **상태바와 겹쳤다**.
 * 설명 줄을 쓰는 화면이 열 곳이라 모두 같은 증상이었다 (코치채용이 제일 심했다).
 * 목록 열 줄을 그대로 두려고 설명 줄을 **판 아래 빈 띠**로 내리고 상태바를 화면 맨 아래로
 * 옮겼다. 원본 배치(0xaa24·0x5cfec·0xd4e8)는 미해독이라 어느 쪽이든 근사다.
 * (그 근사 상태바는 걷었다 — 상태판은 원본 0x7d34c 그대로 `pages/season/ui/SeasonStatusPanel` 이 화면 원점에 그린다.)
 */
export const FOOTER_HEIGHT = 26

export function rowBoxOf(index: number): SeasonBox {
  return { x: LIST_ORIGIN.x, y: LIST_ORIGIN.y + ROW_STEP * index, width: ROW_WIDTH, height: ROW_HEIGHT }
}

/** 판 아래 빈 띠의 설명 줄 (**근사**) — 판 바닥 266 아래 */
export const FOOTER_BOX: SeasonBox = {
  x: SEASON_WINDOW.x + WINDOW_INSET,
  y: SEASON_WINDOW.y + SEASON_WINDOW.height + 2,
  width: ROW_WIDTH,
  height: FOOTER_HEIGHT,
}

/** 창 안 글자 규격 — 이 저장소의 다른 창(ShopWindow)과 같은 11px 글·13px 줄 */
export const TEXT = { size: 11, lineHeight: 13, smallSize: 11, smallLineHeight: 13 } as const

/**
 * 시즌 금액 글 — 시즌 소지금·가격은 **100만 원 단위**다 (SR+2, S3 3절).
 * 원본 확인 팝업은 `0x55cf5(g, 값 × 100)` 로 **만원 단위** 서식(0x55cf4)에 넘긴다.
 * 그 서식은 이미 `features/shop` 에 옮겨져 있어 그대로 쓴다 (두 번 적지 않으려는 것).
 */
export const MILLION_TO_TEN_THOUSAND = 100
