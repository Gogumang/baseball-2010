/**
 * 경기진행 설정 창의 배치.
 *
 * ⚠️ **원본 배치 미해독 — 근사**. R4 4절은 그리기 함수가 `0x6042c` 라는 것과
 * 어떤 그림·문구가 나오는지만 적었고 **좌표는 적지 않았다**. 그래서
 * 확정인 것은 이 저장소의 다른 창들과 같은 **공용 판 (24, 54, 192, 212)**(0x55e61) 하나뿐이고,
 * 줄 간격·칸 크기·글 자리는 전부 근사다. 근사한 값에는 하나하나 표시해 두었다.
 */

export interface SettingsBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 공용 판 0x55e61 → (24, 54, 192, 212) — **확정** (P6 2f·5절 · F 6절) */
export const WINDOW: SettingsBox = { x: 24, y: 54, width: 192, height: 212 }

/** 판 안쪽 여백 (**근사** — 다른 창들과 같은 8px) */
export const INSET = 8

/** 판 위 제목 줄 (**근사**) — 단계 1 에서 지금 고른 종류 이름 그림이 앉는다 */
export const TITLE_BOX: SettingsBox = {
  x: WINDOW.x + INSET,
  y: WINDOW.y + 8,
  width: WINDOW.width - INSET * 2,
  height: 14,
}

/** 목록 첫 줄 (**근사**) */
export const LIST_ORIGIN = { x: WINDOW.x + INSET, y: WINDOW.y + 32 } as const
/** 종류·값 줄 크기 (**근사**) */
export const ROW = { width: WINDOW.width - INSET * 2, height: 20, step: 26 } as const

/** 종류 세 줄 / 값 줄의 Y (**근사**) */
export function rowTopOf(index: number): number {
  return LIST_ORIGIN.y + ROW.step * index
}

/**
 * 찬스 두 줄 (**근사**) — 찬스 값에는 이름 그림이 없어 설명 문구를 두 줄로 그린다.
 * 그래서 다른 줄보다 높다.
 */
export const CHANCE_ROW = { width: WINDOW.width - INSET * 2, height: 34, step: 42 } as const

export function chanceRowTopOf(index: number): number {
  return LIST_ORIGIN.y + CHANCE_ROW.step * index
}

/** 상세 다섯 줄 (**근사**) — 줄 넷 + 확인 줄 */
export const DETAIL_ROW_BOX = { height: 16, step: 20 } as const
/** 상세 줄 이름 칸 (**근사**) */
export const DETAIL_LABEL = { x: WINDOW.x + INSET, width: 44 } as const
/** 상세 칸 (**근사**) — 9칸이 판 안에 들어가도록 12px + 2px 사이 */
export const DETAIL_CELL = { x: WINDOW.x + INSET + DETAIL_LABEL.width, size: 12, gap: 2 } as const

export function detailRowTopOf(row: number): number {
  return LIST_ORIGIN.y + DETAIL_ROW_BOX.step * row
}

export function detailCellLeftOf(cell: number): number {
  return DETAIL_CELL.x + (DETAIL_CELL.size + DETAIL_CELL.gap) * cell
}

/** 판 아래 설명 글 (**근사**) — 원본도 고른 칸의 설명을 창 안에 보여 준다 */
export const DESCRIPTION_BOX: SettingsBox = {
  x: WINDOW.x + INSET,
  y: WINDOW.y + 150,
  width: WINDOW.width - INSET * 2,
  height: 40,
}

/** 되돌아가기 — 원본은 CLR 키가 맡는다. 마우스용으로만 둔다 (**웹판 추가**) */
export const BACK_BUTTON: SettingsBox = {
  x: WINDOW.x + INSET,
  y: WINDOW.y + WINDOW.height - 22,
  width: 60,
  height: 14,
}

/** 창 안 글자 규격 — 다른 창들과 같은 11px 글·13px 줄 (**근사**) */
export const TEXT = { size: 11, lineHeight: 13, smallSize: 11, smallLineHeight: 13 } as const
