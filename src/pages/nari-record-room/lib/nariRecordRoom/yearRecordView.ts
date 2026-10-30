/** 124 목록의 커서 · 열 밀기 상태 — 키 0x55864 · 그림 0x5c984 */
import { VISIBLE_YEAR_COLUMNS, VISIBLE_YEAR_ROWS, YEAR_SLIDE_OFFSETS } from '@/pages/nari-record-room/lib/nariRecordRoom/yearColumns'

/** 열 밀기 — [편집기+0x331] 단계(−1 = 안 밂) · [+0x332] 방향(0 오른 키 → 다음 열 · 1 왼 키 → 앞 열) */
export interface YearSlide {
  readonly step: number
  readonly direction: 'next' | 'previous'
}

export interface YearRecordView {
  /** 목록 객체 [편집기+0x41c] 의 커서 줄 (+0x10) */
  readonly cursor: number
  /** 목록 객체의 윗줄 (+0x30) — 커서가 보이는 줄을 벗어날 때만 옮긴다 (`0x6c2bd`) */
  readonly top: number
  /** [편집기+0x335] — 보이는 첫 넘기는 열 */
  readonly firstColumn: number
  readonly slide: YearSlide | null
  /**
   * [편집기+0x40c] — 키 0x55864 가 **불릴 때마다** +1 (55868~55874, 미는 동안에도). 0x5561c 가 0 으로 연다.
   * 124 는 갱신 함수가 없어(상태 표 0xcc728 은 진입 0x116d4 뿐) 키가 들어올 때만 오른다 — 화살 · 커서 깜빡임이 키 수를 따른다.
   */
  readonly keyPresses: number
}

/** 0x5561c 가 +0x335 = 0 · +0x331 = −1 · +0x40c = 0, 0x55724 가 목록 커서 (0, 0) · 윗줄 0 으로 연다 */
export const OPEN_YEAR_RECORD_VIEW: YearRecordView = { cursor: 0, top: 0, firstColumn: 0, slide: null, keyPresses: 0 }

/** '기타' = 0x55864 까지 가지만 보기 전용이라 아무 일도 없는 키(확인 · 숫자 등) — [+0x40c] 만 센다 */
export type YearRecordKey = '위' | '아래' | '왼' | '오른' | '기타'

/**
 * 키 0x1463c → 0x55864 (취소는 부르는 쪽이 106 으로, '0' · '*' 는 0x1463c 가 버려 여기 안 온다).
 * - 0x55864 머리가 [+0x40c] 를 +1 한다 — 어떤 키든, 미는 동안이든.
 * - 밀고 있는 동안([+0x331] ≠ −1)은 0x5587c 가 나머지를 통째로 건너뛴다.
 * - 왼(55a1a · 55a5a) · 오른(55a90): [+0x337] 이 켜져 있어(열 8 · 9 > 4) 끝 코드 대신 +0x331 = 0 · +0x332 = 1 / 0.
 * - 위 · 아래: 목록 객체 vt+0x18 = 0x6c299 → 0x6c521 → 0x6c031. 목록 모양은 0x55724 의 vt+0x1c(1열, 줄 수, 1, 꼴 **0x20**) —
 *   세로로 넘치면 **감는다**((y ± 1 + 줄 수) % 줄 수). 이어 vt+0x20 = 0x6c2bd 가 윗줄을 고친다: 커서가 [윗줄, 윗줄 + 보이는 줄)
 *   밖이면 아래로 벗어났을 때 커서 − 보이는 줄 + 1, 위로 벗어났을 때 커서. 보이는 줄 [+0x38] = min(10, 줄 수)(0x55784).
 */
export function pressYearRecordKey(view: YearRecordView, key: YearRecordKey, rowCount: number): YearRecordView {
  const counted = { ...view, keyPresses: view.keyPresses + 1 }
  if (view.slide !== null) return counted
  switch (key) {
    case '위':
      return withCursor(counted, rowCount, -1)
    case '아래':
      return withCursor(counted, rowCount, 1)
    case '왼':
      return { ...counted, slide: { step: 0, direction: 'previous' } }
    case '오른':
      return { ...counted, slide: { step: 0, direction: 'next' } }
    case '기타':
      return counted
  }
}

/** 0x6be71 → 0x6bead(꼴 0x20 세로 감기) · 0x6c2bd(윗줄) */
function withCursor(view: YearRecordView, rowCount: number, dy: number): YearRecordView {
  if (rowCount <= 0) return view
  const cursor = (view.cursor + dy + rowCount) % rowCount
  const visible = visibleYearRowCountOf(rowCount)
  if (cursor >= view.top && cursor < view.top + visible) return { ...view, cursor }
  const top = cursor - view.top > 0 ? cursor - visible + 1 : cursor
  return { ...view, cursor, top }
}

/** 목록 +0x38 = min([편집기+0x33d] 10, 줄 수) (0x55784~0x5578e) */
export function visibleYearRowCountOf(rowCount: number): number {
  return Math.min(VISIBLE_YEAR_ROWS, rowCount)
}

/**
 * 그림 한 번의 넘기는 열 밀림(px) — 0x5c984 5ccde~5cd8c. 밀 수 없는 쪽이면 0(그 그림에서 +0x331 = −1 로 그만둔다).
 * 방향 'next'(0)는 왼쪽으로(x − 표[단계]), 'previous'(1)는 오른쪽으로(x + 표[단계]).
 */
export function yearSlideOffsetOf(view: YearRecordView, columnCount: number): number {
  if (view.slide === null || !canSlide(view, columnCount)) return 0
  const offset = YEAR_SLIDE_OFFSETS[view.slide.step] ?? 0
  return view.slide.direction === 'next' ? -offset : offset
}

/** 그림 한 번이 끝난 뒤 — 단계 + 1, 여섯이면 그만두고 첫 열 ± 1 (5cefa~5cf50). 밀 수 없으면 곧장 그만둔다 */
export function advanceYearSlide(view: YearRecordView, columnCount: number): YearRecordView {
  if (view.slide === null) return view
  if (!canSlide(view, columnCount)) return { ...view, slide: null }
  const step = view.slide.step + 1
  if (step < YEAR_SLIDE_OFFSETS.length) return { ...view, slide: { ...view.slide, step } }
  const firstColumn = view.slide.direction === 'next' ? view.firstColumn + 1 : view.firstColumn - 1
  return { ...view, firstColumn, slide: null }
}

/** 0x5ccea~0x5cd1e — 다음 열: 첫 열 + 보이는 열 < 열 수 · 앞 열: 첫 열 > 0 */
function canSlide(view: YearRecordView, columnCount: number): boolean {
  if (view.slide === null) return false
  return view.slide.direction === 'next' ? view.firstColumn + VISIBLE_YEAR_COLUMNS < columnCount : view.firstColumn > 0
}
