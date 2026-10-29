import { ENTRY_COLUMN_GAP } from '@/widgets/entry-editor/lib/entryListWindow/entryColumns'
import type { EntryListGeometry } from '@/widgets/entry-editor/lib/entryListWindow/entryListGeometry'
import { ENTRY_BADGE_WIDTH, ENTRY_LIST_LAYOUT, entryCursorIsInsetOf } from '@/widgets/entry-editor/lib/entryListWindow/entryListLayout'

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
  const rect = pickedRowRectOf(input)
  if (rect === null) return null
  return { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 }
}

/** 고른 줄 칠 칸 — 하위 탭 1 은 딱지 칸, 그 밖은 이름 칸 + 딱지 칸 (이름 열이 없으면 null) */
function pickedRowRectOf(input: Parameters<typeof entryPickedFillOf>[0]): EntryRect | null {
  if (input.subTab === 1) return { x: input.badgeX, y: input.rowY, width: ENTRY_BADGE_WIDTH, height: ENTRY_LIST_LAYOUT.cellHeight }
  const name = input.geometry.nameColumn
  if (name === null) return null
  return { x: name.x, y: input.rowY, width: name.column.width + ENTRY_BADGE_WIDTH + ENTRY_COLUMN_GAP, height: ENTRY_LIST_LAYOUT.cellHeight }
}
