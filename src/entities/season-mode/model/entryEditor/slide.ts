import { ENTRY_SLIDE_STEPS, ENTRY_VISIBLE_SCROLL_COLUMNS } from '@/entities/season-mode/model/entryEditor/codes'
import type { EntryColumnSlide, EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'

/** 0x5ccea~0x5cd1e — 다음 열: 첫 열 + 보이는 열 < 열 수 · 앞 열: 첫 열 > 0 */
function canSlide(state: EntryEditorState, slide: EntryColumnSlide): boolean {
  return slide.direction === 'next' ? state.firstColumn + ENTRY_VISIBLE_SCROLL_COLUMNS < state.scrollColumnCount : state.firstColumn > 0
}

/**
 * 그림 한 번이 끝난 뒤의 밀기 (5cefa~5cf50) — 단계 + 1, 여섯이면 그만두고 첫 열 ± 1. 밀 수 없는 쪽이면 그 그림에서 곧장 그만둔다
 * (5cd20 `+0x331 = −1`).
 */
export function advanceEntrySlide(state: EntryEditorState): EntryEditorState {
  const { slide } = state
  if (slide === null) return state
  if (!canSlide(state, slide)) return { ...state, slide: null }
  const step = slide.step + 1
  if (step < ENTRY_SLIDE_STEPS) return { ...state, slide: { ...slide, step } }
  return { ...state, firstColumn: state.firstColumn + (slide.direction === 'next' ? 1 : -1), slide: null }
}
