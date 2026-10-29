import { CommonPanel, RawScreen, useImgTextPalette3 } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import {
  VISIBLE_YEAR_COLUMNS,
  YEAR_NUMBER_HEADER_FRAME,
  YEAR_TABLE_LAYOUT,
  visibleYearRowCountOf,
  yearArrowBlinkOf,
  yearColumnsOf,
  yearSlideOffsetOf,
} from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { NariRecordEdition } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearRow } from '@/pages/nari-record-room/ui/nariRecordRoom/yearRecordConstants'
import { useYearRecordView } from '@/pages/nari-record-room/ui/nariRecordRoom/useYearRecordView'
import { YearCursor, YearLabel, YearNumberRows } from '@/pages/nari-record-room/ui/nariRecordRoom/yearTableParts'
import { YearPressAreas, YearSideArrows, YearUpDownArrows } from '@/pages/nari-record-room/ui/nariRecordRoom/yearArrows'
import { YearStatColumns } from '@/pages/nari-record-room/ui/nariRecordRoom/yearStatColumns'
import { SkinBackdrop } from '@/pages/nari-record-room/ui/nariRecordRoom/otherSlices'

interface YearRecordScreenProps {
  readonly edition: NariRecordEdition
  readonly rows: readonly YearRow[]
  readonly title: '나만의리그타자편' | '나만의리그투수편'
  readonly gamePoint: number
  readonly onBack: () => void
}

/** 124 첫 갈래 — 0x5cfec → 0x5c984 (고정 "연차" 열 0x5658c + 넘기는 열 0x56ebc 넷). 배치는 `YEAR_TABLE_LAYOUT` 머리말 */
export function YearRecordScreen({ edition, rows, title, gamePoint, onBack }: YearRecordScreenProps) {
  const columns = yearColumnsOf(edition)
  const view = useYearRecordView(rows.length, columns.length, onBack)
  const layout = YEAR_TABLE_LAYOUT
  const visibleCount = visibleYearRowCountOf(rows.length)
  const visibleRows = rows.slice(view.top, view.top + visibleCount)
  const blink = yearArrowBlinkOf(view)
  const palette3 = useImgTextPalette3()

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`개인기록 ${edition}`}>
        {palette3.definition}
        {/* 5ca4e 공용 판 0x55e60(편집기, W/2, H/2 + 5, 210, 220, 0, 0x22, 위 띠 0x12, 아래 띠, 0, 0) — 아래 띠는
            (s8)[편집기+0x3e8] == 1 이면 0x12, 아니면 0 (5ca00~5ca10). [편집기+0x3e8] 에 쓰는 곳은 편집기 초기화 0x5561c 의
            556a0 `strb 0` 하나뿐이다(binary.mod 전체에서 +0x3e8 쓰기를 상수 추적으로 찾았다 — 읽는 곳도 5ca04 하나). 124 진입
            0x116d4 → 0x5761c → 0x5561c 가 늘 먼저 돌므로 아래 띠는 **늘 0** 이다 — 원본에서도 그려지지 않는 죽은 갈래 */}
        <CommonPanel
          x={layout.panel.x}
          y={layout.panel.y}
          width={layout.panel.width}
          height={layout.panel.height}
          topBand={0x12}
          testId="개인기록-판"
        />
        {rows.length > 1 && <YearUpDownArrows blink={blink} />}
        <YearLabel frame={YEAR_NUMBER_HEADER_FRAME} x={layout.numberX} width={layout.numberWidth} alt="연차" palette={palette3.style} />
        <YearNumberRows top={view.top} count={visibleRows.length} />
        <YearPressAreas hasRows={rows.length > 1} hasColumns={columns.length > VISIBLE_YEAR_COLUMNS} />
        <YearSideArrows firstColumn={view.firstColumn} columnCount={columns.length} blink={blink} />
        <YearStatColumns columns={columns} rows={visibleRows} view={view} offset={yearSlideOffsetOf(view, columns.length)} palette={palette3.style} />
        <YearCursor view={view} visibleCount={visibleCount} />
      </div>
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
    </RawScreen>
  )
}
