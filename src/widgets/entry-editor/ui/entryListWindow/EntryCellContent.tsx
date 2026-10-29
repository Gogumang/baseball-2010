/** 칸 내용 — 열 종류(`EntryColumnKind`)마다 그리는 길이 따로다 (0x5c984 의 열 그리기) */
import type { ReactNode } from 'react'
import { FrameSprite } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  ENTRY_BADGE_CHIP_BASE,
  ENTRY_BADGE_DASH,
  ENTRY_FIELDER_COLORS,
  ENTRY_LIST_LAYOUT,
  ENTRY_TODAY_LABEL_FRAME,
  ENTRY_TODAY_OVERLAY_FRAME,
  entryOrderCellOf,
  entryRotationCellOf,
  entryStaminaLinesOf,
  entryStatCellOf,
  isPitcherColumn,
} from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryColumnKind, PlacedEntryColumn } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListRow } from '@/widgets/entry-editor/ui/entryListWindow/entryListRow'
import { batterPositionBadgeOf, pitcherRoleBadgeOf, yearCellDrawingOf } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'
import { CenteredImgText, CenteredNumber, CenteredText, Rect } from '@/widgets/entry-editor/ui/entryListWindow/entryListAtoms'
import { GAME_UI_FRAMES, NUM, WHITE, pad, pixel } from '@/widgets/entry-editor/ui/entryListWindow/entryListAssets'

export interface CellContentProps {
  readonly placed: PlacedEntryColumn
  readonly row: EntryListRow
  readonly index: number
  readonly y: number
  readonly gameUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly showsNameBars: boolean
}

/** 타자 수비 위치 `+0x1c` 의 낮은 니블 */
const POSITION_MASK = 0xf
/** 투수 체력 줄 색 — 용량 · 지금 */
const STAMINA_CAPACITY_COLOR = '#1C9300'
const STAMINA_CURRENT_COLOR = '#FF3C14'

/** 번호 칸 — 번호가 없으면 "-" */
function numberOrDash(cell: { readonly number: number } | { readonly dash: true }, { placed, y }: CellContentProps): ReactNode {
  const { x, column } = placed
  return 'number' in cell ? <CenteredNumber value={cell.number} x={x} y={y} /> : <CenteredText text="-" x={x} y={y} width={column.width} />
}

function orderCell(props: CellContentProps): ReactNode {
  return numberOrDash(entryOrderCellOf(props.index), props)
}

function rotationCell(props: CellContentProps): ReactNode {
  const cell = entryRotationCellOf(props.index)
  if (!('today' in cell)) return numberOrDash(cell, props)
  const { x, column } = props.placed
  return (
    <>
      <FrameSprite folder={GAME_UI_FRAMES} frame={ENTRY_TODAY_OVERLAY_FRAME} origins={props.gameUi} x={x} y={props.y} />
      <CenteredImgText origins={props.imgText} frame={ENTRY_TODAY_LABEL_FRAME} x={x} y={props.y} width={column.width} />
    </>
  )
}

function yearCell({ placed, index, y }: CellContentProps): ReactNode {
  return <CenteredNumber value={index + 1} x={placed.x} y={y} />
}

function nameCell({ placed, row, y, showsNameBars }: CellContentProps): ReactNode {
  const { x, column } = placed
  return (
    <>
      {/* 0xba2e5(x − 1, y, 54, 15, "!C!cffffff" + 이름, 1, 0, dy 2) — 흰 글 가운데 */}
      <CenteredText text={row.name} x={x - 1} y={y} width={column.width} />
      {showsNameBars && <NameBars row={row} isPitcher={isPitcherColumn(column.word)} x={x} y={y} width={column.width} />}
    </>
  )
}

/** 수비 위치(타자) · 보직(투수) 딱지 — 재료가 없으면 null */
function entryBadgeOf(row: EntryListRow, word: number) {
  if (isPitcherColumn(word)) return row.profileLow === undefined ? null : pitcherRoleBadgeOf(row.profileLow, -1)
  return row.position === undefined ? null : batterPositionBadgeOf(row.position & POSITION_MASK, -1, -1)
}

function badgeCell({ placed, row, y, gameUi, imgText }: CellContentProps): ReactNode {
  const { x, column } = placed
  const badge = entryBadgeOf(row, column.word)
  if (badge === null) return null
  if (badge.chip < 0 || badge.label < 0) {
    return <PixelText style={{ ...pixel, left: x + ENTRY_BADGE_DASH.dx, top: y + ENTRY_BADGE_DASH.dy, color: WHITE }}>-</PixelText>
  }
  return (
    <>
      <FrameSprite folder={GAME_UI_FRAMES} frame={ENTRY_BADGE_CHIP_BASE + badge.chip} origins={gameUi} x={x} y={y} />
      <CenteredImgText origins={imgText} frame={badge.label} x={x} y={y} width={column.width} />
    </>
  )
}

function statCell({ placed, row, y }: CellContentProps): ReactNode {
  const { x, column } = placed
  const number = entryStatCellOf(column.word, row.batterLine, row.pitcherLine)
  if (number === null) return null
  // 0x6aff8(칸 x + 0x18, y + 3, …, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽 기준으로 0x18 을 품고 있다
  const drawing = yearCellDrawingOf(number)
  return (
    <>
      {drawing.glyphs.map((glyph, glyphIndex) => (
        <img key={glyphIndex} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
      ))}
      {drawing.dots.map((dot, dotIndex) => (
        <Rect key={`d${dotIndex}`} x={x + dot.x} y={y + dot.y} width={1} height={2} color={WHITE} />
      ))}
    </>
  )
}

const CELL_CONTENT_OF: Readonly<Record<EntryColumnKind, (props: CellContentProps) => ReactNode>> = {
  타순: orderCell,
  등판순서: rotationCell,
  연차: yearCell,
  이름: nameCell,
  딱지: badgeCell,
  기록: statCell,
}

export function CellContent(props: CellContentProps) {
  return CELL_CONTENT_OF[props.placed.column.kind](props)
}

interface NameBarsProps {
  readonly row: EntryListRow
  readonly isPitcher: boolean
  readonly x: number
  readonly y: number
  readonly width: number
}

/** 0x571d8 — 타자 세로 두 줄(+0xb & 3 색) · 투수 체력 줄 */
function NameBars(props: NameBarsProps) {
  return props.isPitcher ? <PitcherStaminaBars {...props} /> : <BatterProfileBar {...props} />
}

function BatterProfileBar({ row, x, y, width }: NameBarsProps) {
  const color = row.profileLow === undefined ? undefined : ENTRY_FIELDER_COLORS[row.profileLow]
  if (color === undefined) return null
  return <Rect x={x + width - 4} y={y + 1} width={2} height={ENTRY_LIST_LAYOUT.cellHeight - 2} color={color} />
}

function PitcherStaminaBars({ row, x, y, width }: NameBarsProps) {
  if (row.stamina === undefined) return null
  const h = ENTRY_LIST_LAYOUT.cellHeight
  const lines = entryStaminaLinesOf(row.stamina.capacity, row.stamina.percent, width)
  return (
    <>
      <Rect x={x + 3} y={y + h - 2} width={lines.length + 1} height={2} color={STAMINA_CAPACITY_COLOR} />
      <Rect x={x + 3} y={y + h - 2} width={lines.current + 1} height={2} color={STAMINA_CURRENT_COLOR} />
    </>
  )
}
