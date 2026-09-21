/**
 * 시즌모드(장면 0x105) 화면들이 함께 쓰는 배치.
 *
 * 근거: `docs/re/P6-screens.md` 1·3 절 · `docs/re/F-ui-layout.md` 6 절 · `docs/re/S3-stadium-items.md`.
 *
 * ⚠️ **시즌 관리 메뉴·구단관리 메뉴·선수영입·목표 화면의 원본 배치는 아직 안 풀렸다.**
 * P6 22절이 "시즌 끝 요약 화면(대진표 밖)의 그리기 함수" 를 남은 것으로 적어 두었고,
 * F 6절도 시즌 쪽 줄 좌표를 못 찾았다고 적었다. 그래서 이 파일에서 **확정**인 것은
 *   - 공용 판 (24, 54, 192, 212)
 *   - 구장 아이템 창 mode_ui 프레임 32 의 박스 7개
 * 둘뿐이고, 나머지 줄·글 자리는 전부 **근사**다. 근사한 값에는 하나하나 표시해 두었다.
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
 */
export const FOOTER_HEIGHT = 26

export function rowBoxOf(index: number): SeasonBox {
  return { x: LIST_ORIGIN.x, y: LIST_ORIGIN.y + ROW_STEP * index, width: ROW_WIDTH, height: ROW_HEIGHT }
}

/** 판 아래 빈 띠의 설명 줄 (**근사**) — 판(바닥 266)과 상태바(296) 사이 */
export const FOOTER_BOX: SeasonBox = {
  x: SEASON_WINDOW.x + WINDOW_INSET,
  y: SEASON_WINDOW.y + SEASON_WINDOW.height + 2,
  width: ROW_WIDTH,
  height: FOOTER_HEIGHT,
}

/** 상태바 줄 — 화면 맨 아래 (**근사**). 설명 줄 아래로 내려 겹치지 않게 한다 */
export const STATUS_BAR_Y = SCREEN.height - 24

/**
 * 구장 아이템 창 `0x83378` — mode_ui **프레임 32 의 박스 0~6** (P6 3절 확정).
 *
 * 같은 값이 `src/pages/shop/lib/shopLayout.ts` 의 `STADIUM_BOXES` 에도 있다.
 * 그 파일은 pages 층이라 여기(widgets)에서 끌어다 쓸 수 없어 옮겨 적었다 — 값이 바뀌면 둘 다 고쳐야 한다.
 */
export const STADIUM_BOXES = {
  /** 0 수치 칸 (판 위에 붙는 작은 칸) */
  value: { x: 134, y: 164, width: 19, height: 13 },
  /** 1 왼쪽 머리칸 */
  kindHead: { x: 26, y: 180, width: 37, height: 15 },
  /** 2 가운데 머리칸 */
  nameHead: { x: 64, y: 180, width: 63, height: 15 },
  /** 3 오른쪽 머리칸 = 칸 목록의 머리 */
  slotHead: { x: 134, y: 180, width: 70, height: 15 },
  /** 4 설명 */
  description: { x: 27, y: 217, width: 100, height: 53 },
  /** 5 스크롤 막대 */
  scroll: { x: 207, y: 185, width: 7, height: 73 },
  /** 6 판 */
  panel: { x: 18, y: 176, width: 203, height: 90 },
} as const satisfies Readonly<Record<string, SeasonBox>>

/**
 * 구장 아이템 창의 **안쪽** 자리는 문서에 없다 (**근사**).
 *
 * 원본 프레임 32 는 "그림 54조각(관중석·전광판·잔디 아이콘, **파란 막대 7개**, ▲▼)" 이고,
 * 키 처리 `0x957c` 가 목록 둘(`[win+0x198]` 종류 = 행 · `[win+0x19c]` 칸)을 읽는다 (S3 4절).
 * 그래서 **종류 아이콘 3칸 + 칸 막대 7줄** 로 읽고 그렇게 놓았다 — 막대 7개와도 맞는다.
 *
 * 자리는 박스들이 비워 둔 곳에 맞췄다: 왼쪽 아래는 설명 박스 4(27, 217, 100, 53)가 쓰므로
 * 종류 3칸은 그 위 (27, 196) 에 가로로, 칸 7줄은 머리칸 박스 3(134, 180, 70, 15) 아래
 * 스크롤 막대 박스 5(207, …) 왼쪽에 세로로 놓는다.
 */
export const STADIUM_KIND_ROW = { x: 27, y: 196, width: 32, height: 18, step: 34 } as const
/**
 * 칸 막대 — 글꼴이 11px 이 되면서 8px 짜리 줄에 글자가 안 들어간다.
 * 줄을 13px 로 키우면 스크롤 막대 자리(185~258) 안에 **넉 줄**만 선다.
 * 원본 프레임 32 에 **스크롤 막대와 ▲▼ 가 들어 있으므로** 목록이 굴러가는 것이 원본에 가깝다 —
 * 일곱 줄을 한 번에 다 보여 주던 웹판 쪽이 오히려 임의였다. 몇 줄이 보이는지는 **근사다**.
 */
export const STADIUM_SLOT_ROW = {
  x: STADIUM_BOXES.slotHead.x,
  y: 196,
  width: STADIUM_BOXES.slotHead.width,
  height: 13,
  step: 14,
  /** 한 번에 보이는 줄 수 — 196 + 14×4 = 252 로 스크롤 막대 아래끝(258) 안이다 */
  visible: 4,
} as const

/** 커서가 늘 보이도록 굴린 목록의 첫 줄 번호 (커서가 아래로 가면 그만큼 밀어 올린다) */
export function stadiumSlotWindowStartOf(slot: number, count: number): number {
  const lastStart = Math.max(0, count - STADIUM_SLOT_ROW.visible)
  return Math.min(Math.max(0, slot - STADIUM_SLOT_ROW.visible + 1), lastStart)
}

/** 창 안 글자 규격 — 이 저장소의 다른 창(ShopWindow)과 같은 11px 글·13px 줄 */
export const TEXT = { size: 11, lineHeight: 13, smallSize: 11, smallLineHeight: 13 } as const

/**
 * 시즌 금액 글 — 시즌 소지금·가격은 **100만 원 단위**다 (SR+2, S3 3절).
 * 원본 확인 팝업은 `0x55cf5(g, 값 × 100)` 로 **만원 단위** 서식(0x55cf4)에 넘긴다.
 * 그 서식은 이미 `features/shop` 에 옮겨져 있어 그대로 쓴다 (두 번 적지 않으려는 것).
 */
export const MILLION_TO_TEN_THOUSAND = 100
