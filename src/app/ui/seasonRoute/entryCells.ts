import type { SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'

/** 엔트리 목록 창 칸 재료 — 저장이 없으면 넘기지 않는다(받는 쪽 기본값) */
export function withEntryCells(cells: SeasonEntryCellSource | undefined): { readonly cells?: SeasonEntryCellSource } {
  return cells === undefined ? {} : { cells }
}
