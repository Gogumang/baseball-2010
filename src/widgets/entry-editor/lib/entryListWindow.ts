import { YEAR_SLIDE_OFFSETS } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearCellNumber } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { EntryBatterLine, EntryPitcherLine } from '@/entities/season-mode/model/entryEditor'

/**
 * **엔트리 목록 창 0x5cfec → 0x5c984** (2026-10-15 r89, unicorn 으로 0x5cfec 를 그대로 돌려 그리기 인자를 받았다 —
 * 0x5c984 · 0x5698d · 0x56721 · 0x573e9 · 0x571d8 · 0x56b5d · 0x54590 · 0x545e8 · 0x56ebd · 0x56dd4 · 0x5650c · 0x55d6c ·
 * 0x56234 · 0x563dc · 0xb9d74 직접 뜸).
 * ```
 * 0x5cfec(ed)  탭 t = [ed+0x33f] ≠ 0 · 윗줄 = [목록+0x14]×[목록+0x30]+[목록+0x2c] · 끝 = 윗줄 + [목록+0x38]
 *              0x5c984(ed, 윗줄, 끝, 고정 열 표 ed+0x344+t·40, s8[ed+0x3e4+t], 넘기는 열 표 ed+0x394+t·40, s8[ed+0x3e6+t])
 * 0x5c984      공용 판 0x55e60(ed, W/2, H/2 + 5, 210, 220, 0, 0x22, 위 띠 0x12, 아래 띠 0, 0, 0)         → (15, 55, 210, 220)
 *              깜빡 = [ed+0x40c] % 8 ≤ 4 ? 2 : 0 · 목록 줄 수 [목록+0x18] > 1 이면
 *                slt_frame 이미지 0x20 ▲ (W/2 − 105 + 99 = 114, H/2 − 115 − 깜빡) · 0x21 ▼ (114, H/2 + 117 + 깜빡)
 *              x = W/2 − 100 = 20 · y = H/2 − 102 = 58 에서 고정 열을 차례로 — 열마다 x += 돌려준 폭 + 3
 *              넘기는 열: 0x55d6c 가 보이는 폭 Σ(36 + 3) × [ed+0x33c] · [ed+0x337] 이면 옆 화살 slt_frame 20(5×8)을
 *                첫 열 [ed+0x335] ≠ 0 이면 (x0 − 깜빡 − 5, y + 4) · 첫 열 + 보이는 열 ≠ 열 수면 뒤집어(0x11) (x0 + 폭 + 깜빡 − 5, y + 4)
 *                (x0 = 고정 열 끝 + s8[ed+0x33e])
 *              자르기 0xbae25(x0, 58, 폭, 221) · 열 i = 첫 열 − 1 … 첫 열 + 보이는 열(열 수 안) 을 x0 + (i − 첫 열)·39 + 밀림 에
 *              밀기 [ed+0x331] ≠ −1 이면 그림마다 표 0xd1bbc [1,3,6,13,25,39] 만큼(방향 [+0x332] 0 왼쪽 · 1 오른쪽), 여섯째 뒤 첫 열 ± 1
 *              자르기 풀기 0xbaf8d → 커서 0x56234(ed, +0x3ec 칸, +0x3f4 칸, 3) → 고른 줄 0x563dc(ed, +0x3fc 칸, +0x404 칸, 3)
 *              → 상세 창 0x5b798(ed, 투수 탭 ? 3 : 2, 커서 선수)
 * ```
 * 열은 표의 32비트 낱말 윗비트로 고른다(5cae4~5cc0c · 5cddc~5cee4):
 * | 비트 | 함수 | 머리 글 img_text | 칸 game_ui | 폭 |
 * |---|---|---|---|---|
 * | 24 | 0x5698d 타순 | 36 "타순" | 0x1b | 25 (크기 0x17) |
 * | 25 · 26 | 0x573e9(…, 0 · 1) 이름 | 27 "이름" | 0x1c | 54 (크기 0x18) |
 * | 28 · 29 | 0x56b5d(…, 0 · 1) 수비 · 보직 딱지 | 28 "보직" | 0x23 | 36 (크기 0x22) |
 * | 27 | 0x56721 등판 순서 | 202 "순서" | 0x1b | 25 |
 * | 30 | 0x5658d 연차 (나리 124) | 391 "연차" | 0x1b | 25 |
 * | 그 밖 | 0x56ebd 기록 (낱말 = 기록 비트) | 0x56dd4 | 0x23 | 36 |
 * 머리 글은 0x5650c 가 칸 크기만 재고(그리지 않음) 0xb9d74(글, x, y − 2, w, 15, 0x22, …, dy 2) 로 — 곧 (x, y, w, 15) 안 가운데.
 * 팔레트는 0x913e5(img_text, 3). 머리 아래 y += 15 + 10, 줄마다 y += 15 + 3.
 */

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

/** `0x55798(ed, 3, 10)` — 보이는 넘기는 열 [ed+0x33c] · 보이는 줄 [ed+0x33d] (모든 엔트리 창이 같다) */
export const ENTRY_VISIBLE_COLUMNS = 3
export const ENTRY_VISIBLE_ROWS = 10

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
  0: 172, 1: 207, 2: 208, 4: 209, 8: 210, 0x10: 61, 0x20: 62, 0x40: 211, 0x80: 212,
  0x100: 171, 0x200: 213, 0x400: 214, 0x800: 215, 0x1000: 216, 0x2000: 217, 0x4000: 181, 0x8000: 218, 0x10000: 219,
}

export function entryColumnOf(word: number): EntryColumn {
  const kind = entryColumnKindOf(word)
  switch (kind) {
    case '타순': return { word, kind, width: 25, headerFrame: 36, cellFrame: 0x1b }
    case '등판순서': return { word, kind, width: 25, headerFrame: 202, cellFrame: 0x1b }
    case '연차': return { word, kind, width: 25, headerFrame: 391, cellFrame: 0x1b }
    case '이름': return { word, kind, width: 54, headerFrame: 27, cellFrame: 0x1c }
    case '딱지': return { word, kind, width: 36, headerFrame: 28, cellFrame: 0x23 }
    case '기록': return { word, kind, width: 36, headerFrame: STAT_HEADER_FRAMES[word] ?? 0, cellFrame: 0x23 }
  }
}

/** 이름 열이 투수 갈래(0x573e9 의 다섯째 인자 1 — 비트 26)인가 / 딱지 열이 보직(비트 29)인가 */
export const isPitcherColumn = (word: number) => ((word >>> 26) & 1) === 1 || ((word >>> 29) & 1) === 1

/** 열 사이 틈 (0x5c984 의 `+ 3`) */
export const ENTRY_COLUMN_GAP = 3

export const ENTRY_LIST_LAYOUT = {
  panel: { x: 15, y: 55, width: 210, height: 220, topBand: 0x12 },
  /** W/2 − 100 · H/2 − 102 */
  originX: 20,
  headerY: 58,
  /** 머리 아래 y += 15 + 10 */
  firstRowY: 83,
  rowStep: 18,
  cellHeight: 15,
  /** ▲▼ slt_frame 이미지 0x20 · 0x21 (13×8) */
  arrowX: 114,
  upArrowY: 45,
  downArrowY: 277,
  upArrowImage: 0x20,
  downArrowImage: 0x21,
  /** 옆 화살 slt_frame 20 (5×8) — y + 4 */
  sideArrowY: 62,
  sideArrowImage: 20,
  sideArrowWidth: 5,
  /** 0xbae25 자르기 높이 */
  clipHeight: 221,
} as const

/** ▲▼ · 옆 화살 깜빡 — [ed+0x40c] % 8 ≤ 4 ? 2 : 0 (5ca52~5ca6c) */
export const entryArrowBlinkOf = (keyPresses: number) => ((((keyPresses % 8) + 8) % 8) <= 4 ? 2 : 0)

/** 커서 꼴 — [ed+0x40c] % 8 ≤ 3 이면 안쪽 반투명 (0x56316~0x56332) */
export const entryCursorIsInsetOf = (keyPresses: number) => ((((keyPresses % 8) + 8) % 8) <= 3)

/** 놓인 열 */
export interface PlacedEntryColumn {
  readonly column: EntryColumn
  /** 넘기는 열의 첨자 (고정 열은 −1) */
  readonly index: number
  readonly x: number
}

export interface EntryListGeometry {
  readonly fixed: readonly PlacedEntryColumn[]
  /** 넘기는 열 가운데 이번 그림에 그리는 것 (자르기 안) */
  readonly scroll: readonly PlacedEntryColumn[]
  /** 자르기 0xbae25 (x0, 58, 폭, 221) */
  readonly clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 옆 화살 — [ed+0x337] 일 때만 */
  readonly leftArrow: { readonly x: number; readonly y: number } | null
  readonly rightArrow: { readonly x: number; readonly y: number } | null
  /** 이름 열 · 첫 넘기는 열(수비·보직 딱지)의 x — 커서 · 고른 줄 칸(+0x3ec · +0x3f4) */
  readonly nameColumn: PlacedEntryColumn | null
}

export interface EntryListGeometryInput {
  readonly table: EntryColumnTable
  /** [ed+0x335] */
  readonly firstColumn: number
  /** 이번 그림의 밀림(px) — 0x5cd60~0x5cd84 */
  readonly slideOffset: number
  readonly keyPresses: number
  /** s8 [ed+0x33e] — 0x5561c 가 0 으로 둔다 (나리 124 만 15) */
  readonly scrollOffsetX?: number
}

export function entryListGeometryOf(input: EntryListGeometryInput): EntryListGeometry {
  const L = ENTRY_LIST_LAYOUT
  const offsetX = input.scrollOffsetX ?? 0
  let x: number = L.originX
  const fixed: PlacedEntryColumn[] = input.table.fixed.map((word) => {
    const column = entryColumnOf(word)
    const placed = { column, index: -1, x }
    x += column.width + ENTRY_COLUMN_GAP
    return placed
  })
  const columns = input.table.scroll.map(entryColumnOf)
  const first = input.firstColumn
  // 0x55d6c — 보이는 열들의 폭 + 3 의 합
  let width = 0
  for (let i = first; i < first + ENTRY_VISIBLE_COLUMNS && i < columns.length; i += 1) width += (columns[i]?.width ?? 0) + ENTRY_COLUMN_GAP
  const clipX = x + offsetX
  const isScrollable = ENTRY_VISIBLE_COLUMNS < columns.length
  const blink = entryArrowBlinkOf(input.keyPresses)
  const scroll: PlacedEntryColumn[] = []
  // 5cd8e: x = x0 + 밀림 − (36 + 3) 에서 첫 열 − 1 부터. 음수 첨자는 자리만 넘긴다
  let columnX = clipX + input.slideOffset - (36 + ENTRY_COLUMN_GAP)
  for (let index = first - 1; index < first + ENTRY_VISIBLE_COLUMNS + 1 && index < columns.length; index += 1) {
    const column = columns[index]
    if (index < 0 || column === undefined) {
      columnX += 36 + ENTRY_COLUMN_GAP
      continue
    }
    scroll.push({ column, index, x: columnX })
    columnX += column.width + ENTRY_COLUMN_GAP
  }
  return {
    fixed,
    scroll,
    clip: { x: clipX, y: L.headerY, width, height: L.clipHeight },
    leftArrow: isScrollable && first !== 0 ? { x: clipX - blink - L.sideArrowWidth, y: L.sideArrowY } : null,
    rightArrow: isScrollable && first + ENTRY_VISIBLE_COLUMNS !== columns.length
      ? { x: clipX + width + blink - L.sideArrowWidth, y: L.sideArrowY }
      : null,
    nameColumn: fixed.find((placed) => placed.column.kind === '이름') ?? null,
  }
}

/** 줄 y — 윗줄 기준 */
export const entryRowYOf = (rowIndex: number, top: number) => ENTRY_LIST_LAYOUT.firstRowY + (rowIndex - top) * ENTRY_LIST_LAYOUT.rowStep

/** 첫 넘기는 열(수비 · 보직 딱지)의 폭 — 커서 둘째 칸 +0x3f8. 그 열은 처음 그림(첫 열 0)에 늘 그려져 칸이 남는다 */
export const ENTRY_BADGE_WIDTH = 36

export interface EntryRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 커서 칸 0x56234(ed, 이름 칸, 딱지 칸, 3) — 하위 탭 s8[ed+0x330]:
 * - 1(수비위치): 딱지 칸 (+0x3f4 x, y, w, h)
 * - 그 밖(0 타순 · −1 보기 전용): 이름 칸 (x, y) · 폭 = 이름 폭 + ([ed+0x438] == 0 ? 딱지 폭 + 3 : 0) · 높이 15
 *   (스페셜 에디트 0x2b2e0 는 편집기를 연 뒤 [skin+0x438] = 1 — 이름 칸만)
 * 딱지 칸은 딱지 열을 그릴 때만 고쳐지고 편집기에 남는다 — 첫 그림은 늘 첫 열 0 이라 그 뒤로는 폭 36 이 남아 있다.
 */
export function entryCursorRectOf(input: {
  readonly geometry: EntryListGeometry
  readonly rowY: number
  readonly subTab: number
  readonly isNameOnly: boolean
  /** 딱지 칸 x — 수비위치 탭(넘기지 않는 표)의 첫 넘기는 열 */
  readonly badgeX: number
}): EntryRect | null {
  const name = input.geometry.nameColumn
  if (input.subTab === 1) return { x: input.badgeX, y: input.rowY, width: ENTRY_BADGE_WIDTH, height: ENTRY_LIST_LAYOUT.cellHeight }
  if (name === null) return null
  const width = name.column.width + (input.isNameOnly ? 0 : ENTRY_BADGE_WIDTH + ENTRY_COLUMN_GAP)
  return { x: name.x, y: input.rowY, width, height: ENTRY_LIST_LAYOUT.cellHeight }
}

/**
 * 커서 그림 — [ed+0x40c] % 8 ≤ 3 이면 둥근 테두리 0x6aa65(x + 1, y + 1, w − 2, h − 2, 1, 0x80FFFF00), 아니면 (x, y, w, h, 1, 0xFFFF00).
 * ([skin+0x2cc] 두 그림 번쩍임은 엔트리 길에서 서지 않는다 — 나리 기록실 머리말)
 */
export function entryCursorBorderOf(rect: EntryRect, keyPresses: number): EntryRect & { readonly color: string } {
  return entryCursorIsInsetOf(keyPresses)
    ? { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2, color: 'rgba(255, 255, 0, 0.502)' }
    : { ...rect, color: '#ffff00' }
}

/**
 * 고른 줄 0x563dc — 하위 탭이 −1 이 아니고 고른 줄 s8[ed+0x418] 이 보이는 줄 안이면, 하위 탭 0 은 (이름 x, y, 이름 폭 + 딱지 폭 + 3, 15),
 * 1 은 딱지 칸을 둥근 칠 0x6b7d5(x + 1, y + 1, w − 2, h − 2, 둥글기 1, 0x80FF0000 반투명 빨강).
 */
export function entryPickedFillOf(input: {
  readonly geometry: EntryListGeometry
  readonly rowY: number
  readonly subTab: number
  readonly badgeX: number
}): EntryRect | null {
  if (input.subTab === -1) return null
  const name = input.geometry.nameColumn
  const rect = input.subTab === 1
    ? { x: input.badgeX, y: input.rowY, width: ENTRY_BADGE_WIDTH, height: ENTRY_LIST_LAYOUT.cellHeight }
    : name === null
      ? null
      : { x: name.x, y: input.rowY, width: name.column.width + ENTRY_BADGE_WIDTH + ENTRY_COLUMN_GAP, height: ENTRY_LIST_LAYOUT.cellHeight }
  if (rect === null) return null
  return { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 }
}

/* ── 줄 칸 ─────────────────────────────────────────────────────────────────── */

export type { EntryBatterLine, EntryPitcherLine }

/** `0xb8e3c` 타율 × 1000 */
export function entryBattingAverageOf(line: Pick<EntryBatterLine, 'atBats' | 'hits'>): number {
  if (line.atBats <= 0) return 0
  return Math.min(1000, Math.trunc((line.hits * 1000) / line.atBats))
}

/** `0xb6ce8` 방어율 × 100 */
export function entryEarnedRunAverageOf(line: Pick<EntryPitcherLine, 'outs' | 'runsAllowed'>): number {
  if (line.outs > 0) return Math.min(9999, Math.trunc((line.runsAllowed * 2700) / line.outs))
  return line.runsAllowed > 0 ? 9999 : 0
}

/**
 * 기록 열 한 칸 — 0x56ebd 의 비트 갈래(56f58~57098)와 0x6aff8 인자: 타율 0xb8e3d 소수(v > 999 ? 3 : 0) ·
 * 방어율 0xb6ce9 소수((v > 100 ? v × 10 : v), 3) · 이닝 0xca7b5(+0x20, 3) · 그 밖 그 칸 값(자릿수 −1).
 * 타자 비트는 [팀+0x18] 배열, 투수 비트는 [팀+0x14] 배열의 같은 줄을 읽는다.
 */
export function entryStatCellOf(
  word: number,
  batter: EntryBatterLine | undefined,
  pitcher: EntryPitcherLine | undefined,
): YearCellNumber | null {
  const plain = (value: number | undefined): YearCellNumber | null =>
    value === undefined ? null : { value, digits: -1, isDecimal: false }
  if (word <= 0x80) {
    if (batter === undefined) return null
    switch (word) {
      case 0: {
        const average = entryBattingAverageOf(batter)
        return { value: average, digits: average > 999 ? 3 : 0, isDecimal: true }
      }
      case 1: return plain(batter.atBats)
      case 2: return plain(batter.hits)
      case 4: return plain(batter.doubles)
      case 8: return plain(batter.triples)
      case 0x10: return plain(batter.homeRuns)
      case 0x20: return plain(batter.runsBattedIn)
      case 0x40: return plain(batter.steals)
      case 0x80: return plain(batter.errors)
      default: return null
    }
  }
  if (pitcher === undefined) return null
  switch (word) {
    case 0x100: {
      const average = entryEarnedRunAverageOf(pitcher)
      return { value: average > 100 ? average * 10 : average, digits: 3, isDecimal: true }
    }
    case 0x200: return plain(Math.trunc(pitcher.outs / 3))
    case 0x400: return plain(pitcher.runsAllowed)
    case 0x800: return plain(pitcher.wins)
    case 0x1000: return plain(pitcher.losses)
    case 0x2000: return plain(pitcher.saves)
    case 0x4000: return plain(pitcher.strikeouts)
    case 0x8000: return plain(pitcher.pitches)
    case 0x10000: return plain(pitcher.walks)
    default: return null
  }
}

/** 타순 열 0x5698d — 줄 ≤ 8 이면 num 0x1e + 숫자로 줄 + 1 을 (x, y + 3, 25) 가운데, 그 밖은 "!C!cffffff-" 를 (x, y, 25, 15) 가운데 */
export function entryOrderCellOf(row: number): { readonly number: number } | { readonly dash: true } {
  return row <= 8 ? { number: row + 1 } : { dash: true }
}

/**
 * 등판 순서 열 0x56721 — 줄 0 은 game_ui 0x17 을 칸 위에 덧칠하고 img_text 53 "등판"(팔레트 0)을 칸 가운데,
 * 줄 1~3 은 숫자 줄 + 1, 그 밖은 "-" (568b0 `cmp r5, #3`).
 */
export function entryRotationCellOf(row: number): { readonly today: true } | { readonly number: number } | { readonly dash: true } {
  if (row === 0) return { today: true }
  return row <= 3 ? { number: row + 1 } : { dash: true }
}

export const ENTRY_TODAY_OVERLAY_FRAME = 0x17
export const ENTRY_TODAY_LABEL_FRAME = 53

/**
 * 딱지 열 0x56b5d — 타자 0x54590(+0x1c & 0xf) · 투수 0x545e8(0xb6ded = +0xb & 3). 칸이 −1 이 아니면 game_ui 0x20 + 칸을 칸 위에,
 * 글 img_text 를 팔레트 0 으로 (x, y − 1, 36, 15) + dy 1 가운데. −1 이면 글꼴 0x9c069 로 "-" 를 (x + 15, y + 3).
 */
export const ENTRY_BADGE_CHIP_BASE = 0x20
export const ENTRY_BADGE_DASH = { dx: 15, dy: 3 } as const

/**
 * 이름 칸 덧그림 0x571d8 — [ed+0x333] ≠ 0 일 때만. 타자: +0xb & 3 색(0 #89DB14 · 1 #FF3C14 · 2 #14B3DB)으로
 * (x + w − 4 · x + w − 3, y + 1)~(…, y + h − 2) 세로 두 줄. 투수: M = 0x66e44(팀, rec, 0) ·
 * S = [ed+0x334] ∈ {1, 2, 3, 4, 8, 9}(0x31e) ? trunc(+0x2c / 100) : 100 · L = trunc(trunc(M × (w × 100 − 400) / 1249) / 100) ·
 * 녹 (0x1c, 0x93, 0) (x + 3, y + h − 2)~(x + 3 + L) 두 줄 위에 빨 (0xff, 0x3c, 0x14) (x + 3)~(x + 3 + trunc(S × L / 100)) 두 줄.
 */
export const ENTRY_FIELDER_COLORS: readonly string[] = ['#89DB14', '#FF3C14', '#14B3DB']

export function entryStaminaLinesOf(capacity: number, percent: number, cellWidth = 54): { readonly length: number; readonly current: number } {
  const length = Math.trunc(Math.trunc((capacity * (cellWidth * 100 - 400)) / 0x4e1) / 100)
  return { length, current: Math.trunc((percent * length) / 100) }
}

/** [ed+0x334] 가 이 모드들이면 +0x2c 를 읽는다 (0x572a4 `0x31e` 비트표) */
export function entryStaminaPercentOf(mode: number, stamina: number): number {
  return mode >= 0 && mode <= 9 && ((0x31e >> mode) & 1) === 1 ? Math.trunc(stamina / 100) : 100
}

/* ── 열 밀기 ─────────────────────────────────────────────────────────────── */

/** 열 밀기 — [ed+0x331] 단계 · [ed+0x332] 방향 (0 오른 키 → 다음 열 · 1 왼 키 → 앞 열) */
export interface EntrySlide {
  readonly step: number
  readonly direction: 'next' | 'previous'
}

/** 0x5ccea~0x5cd1e — 다음 열: 첫 열 + 보이는 열 < 열 수 · 앞 열: 첫 열 > 0 */
export function canSlideEntryColumns(slide: EntrySlide, firstColumn: number, columnCount: number): boolean {
  return slide.direction === 'next' ? firstColumn + ENTRY_VISIBLE_COLUMNS < columnCount : firstColumn > 0
}

/** 그림 한 번의 밀림 — 밀 수 없으면 0 (그 그림에서 그만둔다) */
export function entrySlideOffsetOf(slide: EntrySlide | null, firstColumn: number, columnCount: number): number {
  if (slide === null || !canSlideEntryColumns(slide, firstColumn, columnCount)) return 0
  const offset = YEAR_SLIDE_OFFSETS[slide.step] ?? 0
  return slide.direction === 'next' ? -offset : offset
}
