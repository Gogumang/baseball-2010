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

export {
  ENTRY_COLUMN,
  ENTRY_TABLES_BASIC,
  ENTRY_TABLES_WIDE,
  ENTRY_VISIBLE_COLUMNS,
  entryColumnKindOf,
  entryColumnOf,
  isPitcherColumn,
  ENTRY_COLUMN_GAP,
} from '@/widgets/entry-editor/lib/entryListWindow/entryColumns'
export type { EntryColumnTable, EntryColumnTables, EntryColumnKind } from '@/widgets/entry-editor/lib/entryListWindow/entryColumns'
export {
  ENTRY_LIST_LAYOUT,
  entryArrowBlinkOf,
  entryCursorIsInsetOf,
  entryRowYOf,
  ENTRY_BADGE_WIDTH,
} from '@/widgets/entry-editor/lib/entryListWindow/entryListLayout'
export { entryListGeometryOf } from '@/widgets/entry-editor/lib/entryListWindow/entryListGeometry'
export type { PlacedEntryColumn, EntryListGeometry } from '@/widgets/entry-editor/lib/entryListWindow/entryListGeometry'
export { entryCursorRectOf, entryCursorBorderOf, entryPickedFillOf } from '@/widgets/entry-editor/lib/entryListWindow/entryCursor'
export type { EntryRect } from '@/widgets/entry-editor/lib/entryListWindow/entryCursor'
export { entryBattingAverageOf, entryEarnedRunAverageOf, entryStatCellOf } from '@/widgets/entry-editor/lib/entryListWindow/entryStatCell'
export {
  entryOrderCellOf,
  entryRotationCellOf,
  ENTRY_TODAY_OVERLAY_FRAME,
  ENTRY_TODAY_LABEL_FRAME,
  ENTRY_BADGE_CHIP_BASE,
  ENTRY_BADGE_DASH,
  ENTRY_FIELDER_COLORS,
  entryStaminaLinesOf,
  entryStaminaPercentOf,
} from '@/widgets/entry-editor/lib/entryListWindow/entryRowCells'
export { canSlideEntryColumns, entrySlideOffsetOf } from '@/widgets/entry-editor/lib/entryListWindow/entrySlide'
export type { EntryBatterLine, EntryPitcherLine } from '@/entities/season-mode/model/entryEditor'
