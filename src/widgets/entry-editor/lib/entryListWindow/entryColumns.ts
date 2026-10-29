/** 표의 열 낱말 */
export const ENTRY_COLUMN = {
  타순: 0x1000000,
  타자이름: 0x2000000,
  투수이름: 0x4000000,
  등판순서: 0x8000000,
  수비: 0x10000000,
  보직: 0x20000000,
} as const

export interface EntryColumnTable {
  readonly fixed: readonly number[]
  readonly scroll: readonly number[]
}

export interface EntryColumnTables {
  readonly batter: EntryColumnTable
  readonly pitcher: EntryColumnTable
}

/**
 * 기본 표 — 일반모드 상태 23 진입 0x2648c(0xceb3c · 0xceb44 · 0xceb50 · 0xceb58) · 시즌 0xe0(0x63dc) · 0xe5(0x5cd0) · 0xe6(0x5b28) ·
 * 0xe8(0x5870)(0xcbd74 · 0xcbd7c · 0xcbd88 · 0xcbd90 — 같은 값). 넘기는 열 셋 = 보이는 열 셋이라 [ed+0x337] = 0.
 */
export const ENTRY_TABLES_BASIC: EntryColumnTables = {
  batter: { fixed: [ENTRY_COLUMN.타순, ENTRY_COLUMN.타자이름], scroll: [ENTRY_COLUMN.수비, 0, 0x10] },
  pitcher: { fixed: [ENTRY_COLUMN.등판순서, ENTRY_COLUMN.투수이름], scroll: [ENTRY_COLUMN.보직, 0x100, 0x4000] },
}

/**
 * 넓은 표 — 시즌 선수 고르기 0xdf(0x5980: 0xcbd9c · 0xcbdc4) · 스페셜 에디트(0x2b2e0: 0xcec28 · 0xcec50, 같은 값).
 * 넘기는 열 열 개 > 보이는 열 셋이라 [ed+0x337] = 1 — 좌·우가 열을 민다.
 */
export const ENTRY_TABLES_WIDE: EntryColumnTables = {
  batter: { fixed: [ENTRY_COLUMN.타순, ENTRY_COLUMN.타자이름], scroll: [ENTRY_COLUMN.수비, 0, 0x10, 1, 2, 4, 8, 0x20, 0x40, 0x80] },
  pitcher: {
    fixed: [ENTRY_COLUMN.등판순서, ENTRY_COLUMN.투수이름],
    scroll: [ENTRY_COLUMN.보직, 0x100, 0x4000, 0x200, 0x400, 0x800, 0x1000, 0x2000, 0x8000, 0x10000],
  },
}

/**
 * `0x55798(ed, 3, 10)` — 보이는 넘기는 열 [ed+0x33c] = 3 (모든 엔트리 창이 같다). 보이는 줄 [ed+0x33d] = 10 은 편집기 상태의 `ENTRY_VISIBLE_LIST_ROWS`
 * (`entities/season-mode/model/entryEditor`)가 센다 — 이 창은 윗줄 · 끝 줄을 받아 그린다.
 */
export const ENTRY_VISIBLE_COLUMNS = 3

export type EntryColumnKind = '타순' | '등판순서' | '이름' | '딱지' | '기록' | '연차'

export interface EntryColumn {
  readonly word: number
  readonly kind: EntryColumnKind
  readonly width: number
  /** 머리 글 img_text 프레임 */
  readonly headerFrame: number
  /** 줄 칸 game_ui 프레임 */
  readonly cellFrame: number
}

/** 0x5c984 의 비트 차례 — 24 · 25 · 28 · 26 · 29 · 27 · 30 · 그 밖 (5cae4~5cbe8) */
export function entryColumnKindOf(word: number): EntryColumnKind {
  const bit = (n: number) => ((word >>> n) & 1) === 1
  if (bit(24)) return '타순'
  if (bit(25) || bit(26)) return '이름'
  if (bit(28) || bit(29)) return '딱지'
  if (bit(27)) return '등판순서'
  if (bit(30)) return '연차'
  return '기록'
}

/** 기록 열 머리 글 0x56dd4 — 기록 비트 → img_text */
const STAT_HEADER_FRAMES: Readonly<Record<number, number>> = {
  0: 172,
  1: 207,
  2: 208,
  4: 209,
  8: 210,
  0x10: 61,
  0x20: 62,
  0x40: 211,
  0x80: 212,
  0x100: 171,
  0x200: 213,
  0x400: 214,
  0x800: 215,
  0x1000: 216,
  0x2000: 217,
  0x4000: 181,
  0x8000: 218,
  0x10000: 219,
}

export function entryColumnOf(word: number): EntryColumn {
  const kind = entryColumnKindOf(word)
  switch (kind) {
    case '타순':
      return { word, kind, width: 25, headerFrame: 36, cellFrame: 0x1b }
    case '등판순서':
      return { word, kind, width: 25, headerFrame: 202, cellFrame: 0x1b }
    case '연차':
      return { word, kind, width: 25, headerFrame: 391, cellFrame: 0x1b }
    case '이름':
      return { word, kind, width: 54, headerFrame: 27, cellFrame: 0x1c }
    case '딱지':
      return { word, kind, width: 36, headerFrame: 28, cellFrame: 0x23 }
    case '기록':
      return { word, kind, width: 36, headerFrame: STAT_HEADER_FRAMES[word] ?? 0, cellFrame: 0x23 }
  }
}

/** 이름 열이 투수 갈래(0x573e9 의 다섯째 인자 1 — 비트 26)인가 / 딱지 열이 보직(비트 29)인가 */
export const isPitcherColumn = (word: number) => ((word >>> 26) & 1) === 1 || ((word >>> 29) & 1) === 1

/** 열 사이 틈 (0x5c984 의 `+ 3`) */
export const ENTRY_COLUMN_GAP = 3
