import { YEAR_SLIDE_OFFSETS } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'
import { ENTRY_VISIBLE_COLUMNS } from '@/widgets/entry-editor/lib/entryListWindow/entryColumns'

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
