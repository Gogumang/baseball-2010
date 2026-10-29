/**
 * **나만의리그 [기록실] — 팝업 0x80 → 상태 124** (2026-10-08 직접 떴다. 장면 0x106 모드 3 · 4 공용).
 *
 * ```
 * 106 칸 4   0x13010 130c2~130dc  팝업 0x80(그리기 0x19448 · 키 0x196ec) 열기 · [장면+0x166] = 0
 * 0x19448    제목 StrMODE[74] 흰 글 (W/2 − 0x54, H/2 − 0x28) · 칸 둘 32×32 (W/2 − 0x38, H/2) · (W/2 + 0x18, H/2)
 *            0x858fd(…, 6 / 10, 고른 칸 아니면 −1) · 칸 아래 h + 4 에 img_text 106 "개인기록" · 360 "순위기록" 가운데
 *            (그림 객체 +8 의 +0x1a8 · +0x5a0), 안 고른 칸 글은 (0xb2, 0xb2, 0xb2) 효과 0xb — 시즌 0xf334 와 같은 꼴
 * 0x196ec    취소 → 닫기 · 좌·우(−3 · −4) · '4' · '6' → +0x166 뒤집기 · 확인(−5 · '5') → +0x164 = (+0x166 ? 1 : 0) · 124 · 닫기
 * 124 진입   0x116d4 = 0x5761c(편집기, +0x164 == 0, [장면+0xcc] ≠ 4(투수편), s8 S[1], [sp] s8 S[0xb3]) → 0x5570d(편집기, +0xfc, +0xf0)
 * 124 키     0x1463c  취소 → 106 · +0x164 == 0 이면 '0' · '*' 를 버리고 0x55864(편집기) · 아니면 0x5787d(쪽 넘기기)
 * 124 그림   0x16778  +0x164 ≠ 0 ? 0x5796c : 0x5cfec · 이어 머리띠 0x7f4ed([장면+0xe0])
 * ```
 *
 * **첫 갈래 = 내 선수의 연도별 기록** (0x5761c 만들기 갈래 57654~57812):
 * 0x1c 바이트 팀(0xb4d05)을 새로 만들어 타자편은 0x1fa8d(저장, i) → 0xb5379 를 i < S[0xb3] 만큼 · 이어 0x1fc21(올해),
 * 투수편은 0x1fa79 → 0xb53a5 · 0x1fbd1 로 넣는다 — 줄 i 가 (i + 1)년차다. 0x5561c(편집기, &팀, **0**, 0, 투수편) — 셋째 0 이라
 * **보기 전용**, 다섯째가 탭(타자편 타자 탭 · 투수편 투수 탭). 0x55798(편집기, **4**, 10) — 보이는 열 4 · 줄 10.
 * 0x557c0(편집기, 탭, &[0x40000000], 1, 표, 8 / 9) — 고정 열 하나(0x5658c "연차" 번호 열) + 넘기는 열 표:
 * 타자 0xd1a08 [0 타율, 0x10 홈런, 1 타석, 2 안타, 4 2루타, 8 3루타, 0x20 타점, 0x40 도루] ·
 * 투수 0xd1a28 [0x100 방어, 0x200 이닝, 0x400 실점, 0x800 승, 0x1000 패, 0x2000 세이브, 0x4000 삼진, 0x8000 투구수, 0x10000 사사구].
 * 열 수(8 · 9)가 보이는 열(4)보다 많아 [편집기+0x337] = 1 — 좌·우가 끝 코드 대신 열을 민다(아래 `pressYearRecordKey`).
 */

export {
  BATTER_YEAR_COLUMNS,
  PITCHER_YEAR_COLUMNS,
  RECORD_ROOM_PICK,
  RECORD_ROOM_PICK_LABEL_FRAMES,
  RECORD_ROOM_PICK_LABELS,
  VISIBLE_YEAR_COLUMNS,
  YEAR_NUMBER_HEADER_FRAME,
  YEAR_SLIDE_OFFSETS,
  batterYearCellNumberOf,
  batterYearCellTextOf,
  batterYearRowsOf,
  pitcherYearCellNumberOf,
  pitcherYearCellTextOf,
  pitcherYearRowsOf,
  yearColumnsOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom/yearColumns'
export type { NariRecordEdition, RecordRoomPick, YearCellNumber, YearRecordColumn } from '@/pages/nari-record-room/lib/nariRecordRoom/yearColumns'
export {
  OPEN_YEAR_RECORD_VIEW,
  advanceYearSlide,
  pressYearRecordKey,
  visibleYearRowCountOf,
  yearSlideOffsetOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom/yearRecordView'
export type { YearRecordKey, YearRecordView } from '@/pages/nari-record-room/lib/nariRecordRoom/yearRecordView'
export {
  YEAR_TABLE_LAYOUT,
  yearArrowBlinkOf,
  yearCellDrawingOf,
  yearCursorIsInsetOf,
  yearLabelOffsetOf,
  yearNumberGlyphsOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom/yearTableDrawing'
export type { YearCellDrawing } from '@/pages/nari-record-room/lib/nariRecordRoom/yearTableDrawing'
export { nariBatterRankingRecordsOf, nariRankingEntriesOf, nariRankingSideOf } from '@/pages/nari-record-room/lib/nariRecordRoom/nariRanking'
