import type { CSSProperties } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useMirrorSkinStepCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { useMarkSkinNameBars } from '@/shared/lib/skinNameBars/skinNameBars'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { CommonPanel, FrameSprite, PressArea, useImgTextPalette3 } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { yearCellDrawingOf, yearLabelOffsetOf, yearNumberGlyphsOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { batterPositionBadgeOf, pitcherRoleBadgeOf, roundFillRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import {
  ENTRY_BADGE_CHIP_BASE, ENTRY_BADGE_DASH, ENTRY_FIELDER_COLORS, ENTRY_LIST_LAYOUT, ENTRY_TODAY_LABEL_FRAME,
  ENTRY_TODAY_OVERLAY_FRAME, entryArrowBlinkOf, entryCursorBorderOf, entryCursorRectOf, entryListGeometryOf, entryOrderCellOf,
  entryPickedFillOf, entryRotationCellOf, entryRowYOf, entryStaminaLinesOf, entryStatCellOf, isPitcherColumn,
} from '@/widgets/entry-editor/lib/entryListWindow'
import type {
  EntryBatterLine, EntryColumnTable, EntryListGeometry, EntryPitcherLine, EntryRect, PlacedEntryColumn,
} from '@/widgets/entry-editor/lib/entryListWindow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const SLT_FRAME = assetUrl('./sprites/slt_frame')
const NUM = assetUrl('./sprites/num')
const pad = (index: number) => String(index).padStart(3, '0')
const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }
const WHITE = ORIGINAL_COLORS.text

/** 목록 한 줄이 칸에 그릴 재료 — 없는 칸은 비운다 */
export interface EntryListRow {
  readonly name: string
  /** 타자 수비 위치 `+0x1c & 0xf` (0x54590) */
  readonly position?: number
  /** 레코드 `+0xb & 3` — 타자 이름 칸 세로 줄 색(0x571d8) · 투수 보직(0xb6ded → 0x545e8) */
  readonly profileLow?: number
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
  /** 투수 체력 줄 — 용량 `0x66e44(팀, rec, 0)` · 퍼센트 S (0x571d8) */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
}

export interface EntryListWindowProps {
  readonly rows: readonly EntryListRow[]
  /** 그 탭의 열 표 (고정 열 · 넘기는 열) */
  readonly table: EntryColumnTable
  readonly cursor: number
  /** 목록 윗줄 [목록+0x30] */
  readonly top: number
  /** [ed+0x335] */
  readonly firstColumn: number
  /** 이번 그림의 열 밀림 (px) */
  readonly slideOffset: number
  /** [ed+0x40c] */
  readonly keyPresses: number
  /** s8 [ed+0x330] — 0 타순 · 1 수비위치 · −1 보기 전용 */
  readonly subTab: number
  /** s8 [ed+0x418] — −1 없음 */
  readonly picked: number
  /** [ed+0x333] — 이름 칸 덧그림(0x571d8) */
  readonly showsNameBars: boolean
  /** [ed+0x438] — 커서가 이름 칸만 (스페셜 에디트) */
  readonly isCursorNameOnly?: boolean
  /** 웹 전용 — 줄 누름 칸 (커서 줄이면 확인, 아니면 커서 옮김 — 부르는 쪽이 정한다) */
  readonly onPressRow?: (index: number) => void
  /** 웹 전용 — ▲▼ · 옆 화살 그림 자리 누름 칸 */
  readonly onPressArrow?: (direction: '위' | '아래' | '왼' | '오른') => void
  readonly testId?: string
}

/**
 * **엔트리 목록 창 0x5cfec → 0x5c984** — 배치 근거는 `lib/entryListWindow` 머리말(직접 떴다).
 * 그림 차례: 판 → ▲▼ → 고정 열 → 옆 화살 → 자르기 안 넘기는 열 → 커서 0x56234 → 고른 줄 0x563dc.
 */
export function EntryListWindow({
  rows, table, cursor, top, firstColumn, slideOffset, keyPresses, subTab, picked, showsNameBars, isCursorNameOnly = false,
  onPressRow, onPressArrow, testId = '엔트리-목록',
}: EntryListWindowProps) {
  const gameUi = useFrameOrigins(GAME_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const L = ENTRY_LIST_LAYOUT
  // [ed+0x40c] 는 전역 스킨 칸이다 — 편집기가 0x5561c 의 0 에서 센 값을 그대로 옮겨 다음 화면(경기설정 창 · 순위 판 · 명전)이 잇게 한다
  useMirrorSkinStepCounter(keyPresses)
  // [ed+0x333] 도 전역 스킨 칸 — 이 창을 1 로 세우는 진입(시즌 0x5870 … · 0x16af8 · 0x2648c)이 적은 값을 다음 화면(스페셜 에디트)이 본다
  useMarkSkinNameBars(showsNameBars)
  const geometry = entryListGeometryOf({ table, firstColumn, slideOffset, keyPresses })
  const visibleCount = Math.min(10, rows.length)
  const visibleRows = rows.slice(top, top + visibleCount)
  const blink = entryArrowBlinkOf(keyPresses)
  const badgeX = geometry.scroll.find((placed) => placed.index === 0)?.x ?? geometry.clip.x
  const cursorRect = cursor >= top && cursor < top + visibleCount
    ? entryCursorRectOf({ geometry, rowY: entryRowYOf(cursor, top), subTab, isNameOnly: isCursorNameOnly, badgeX })
    : null
  const pickedRect = picked >= top && picked < top + visibleCount
    ? entryPickedFillOf({ geometry, rowY: entryRowYOf(picked, top), subTab, badgeX })
    : null

  const columnProps = { rows: visibleRows, top, gameUi, imgText, palette3: palette3.style, showsNameBars }
  return (
    <div role="group" aria-label="엔트리 목록" data-testid={testId}>
      {palette3.definition}
      {/* 5ca4e 공용 판 — 아래 띠 (s8)[ed+0x3e8] 은 0x5561c 가 늘 0 으로 둔다 */}
      <CommonPanel x={L.panel.x} y={L.panel.y} width={L.panel.width} height={L.panel.height} topBand={L.panel.topBand}
        testId="엔트리-판" />
      {rows.length > 1 && (
        <>
          <img alt="" src={`${SLT_FRAME}/${pad(L.upArrowImage)}.png`} style={{ ...pixel, left: L.arrowX, top: L.upArrowY - blink }} />
          <img alt="" src={`${SLT_FRAME}/${pad(L.downArrowImage)}.png`} style={{ ...pixel, left: L.arrowX, top: L.downArrowY + blink }} />
        </>
      )}
      {geometry.fixed.map((placed) => <EntryColumnCells key={placed.column.word} placed={placed} {...columnProps} />)}
      {geometry.leftArrow !== null && (
        <img alt="" src={`${SLT_FRAME}/${pad(L.sideArrowImage)}.png`} style={{ ...pixel, left: geometry.leftArrow.x, top: geometry.leftArrow.y }} />
      )}
      {geometry.rightArrow !== null && (
        <img alt="" src={`${SLT_FRAME}/${pad(L.sideArrowImage)}.png`}
          style={{ ...pixel, left: geometry.rightArrow.x, top: geometry.rightArrow.y, transform: 'scaleX(-1)' }} />
      )}
      <div style={{ ...pixel, left: geometry.clip.x, top: geometry.clip.y, width: geometry.clip.width, height: geometry.clip.height,
        overflow: 'hidden' }} data-testid={`${testId}-넘기는-열`}>
        <div style={{ ...pixel, left: -geometry.clip.x, top: -geometry.clip.y }}>
          {geometry.scroll.map((placed) => <EntryColumnCells key={placed.index} placed={placed} {...columnProps} />)}
        </div>
      </div>
      {cursorRect !== null && <CursorBorder rect={cursorRect} keyPresses={keyPresses} />}
      {pickedRect !== null && (
        <div data-testid={`${testId}-고른줄`}>
          {roundFillRectsOf({ ...pickedRect, round: 1 }).map((rect, index) => (
            <Rect key={index} {...rect} color="rgba(255, 0, 0, 0.502)" />
          ))}
        </div>
      )}
      <EntryListPresses geometry={geometry} rows={visibleRows} top={top} cursor={cursor} onPressRow={onPressRow}
        onPressArrow={onPressArrow} hasVerticalArrows={rows.length > 1} />
    </div>
  )
}

function EntryListPresses({ geometry, rows, top, cursor, onPressRow, onPressArrow, hasVerticalArrows }: {
  readonly geometry: EntryListGeometry; readonly rows: readonly EntryListRow[]; readonly top: number; readonly cursor: number
  readonly onPressRow: ((index: number) => void) | undefined
  readonly onPressArrow: ((direction: '위' | '아래' | '왼' | '오른') => void) | undefined
  readonly hasVerticalArrows: boolean
}) {
  const L = ENTRY_LIST_LAYOUT
  const rowLeft = L.originX
  const rowWidth = geometry.clip.x + geometry.clip.width - rowLeft
  return (
    <>
      {onPressRow !== undefined && rows.map((row, offset) => {
        const index = top + offset
        return (
          <PressArea key={index} label={row.name} testId={`엔트리-줄-${index}`}
            option={{ isSelected: index === cursor }}
            rect={{ x: rowLeft, y: entryRowYOf(index, top), width: rowWidth, height: L.cellHeight }}
            onPress={() => onPressRow(index)} />
        )
      })}
      {onPressArrow !== undefined && hasVerticalArrows && (
        <>
          <PressArea label="위" rect={{ x: L.arrowX - 2, y: L.upArrowY - 4, width: 17, height: 12 }} onPress={() => onPressArrow('위')} />
          <PressArea label="아래" rect={{ x: L.arrowX - 2, y: L.downArrowY, width: 17, height: 12 }} onPress={() => onPressArrow('아래')} />
        </>
      )}
      {onPressArrow !== undefined && geometry.leftArrow !== null && (
        <PressArea label="앞 열" rect={{ x: geometry.leftArrow.x - 3, y: geometry.leftArrow.y - 2, width: 9, height: 12 }}
          onPress={() => onPressArrow('왼')} />
      )}
      {onPressArrow !== undefined && geometry.rightArrow !== null && (
        <PressArea label="다음 열" rect={{ x: geometry.rightArrow.x - 1, y: geometry.rightArrow.y - 2, width: 9, height: 12 }}
          onPress={() => onPressArrow('오른')} />
      )}
    </>
  )
}

interface ColumnCellsProps {
  readonly placed: PlacedEntryColumn
  readonly rows: readonly EntryListRow[]
  readonly top: number
  readonly gameUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly palette3: CSSProperties
  readonly showsNameBars: boolean
}

/** 한 열 — 머리 글(팔레트 3) · 줄마다 칸과 내용 */
function EntryColumnCells({ placed, rows, top, gameUi, imgText, palette3, showsNameBars }: ColumnCellsProps) {
  const { column, x } = placed
  const L = ENTRY_LIST_LAYOUT
  return (
    <div data-testid={`엔트리-열-${column.kind}-${column.word.toString(16)}`}>
      <CenteredImgText origins={imgText} frame={column.headerFrame} x={x} y={L.headerY} width={column.width} style={palette3} />
      {rows.map((row, offset) => {
        const index = top + offset
        const y = entryRowYOf(index, top)
        return (
          <div key={index} data-testid={`엔트리-칸-${index}-${column.kind}`} aria-label={row.name}>
            <FrameSprite folder={GAME_UI_FRAMES} frame={column.cellFrame} origins={gameUi} x={x} y={y} />
            <CellContent placed={placed} row={row} index={index} y={y} gameUi={gameUi} imgText={imgText} showsNameBars={showsNameBars} />
          </div>
        )
      })}
    </div>
  )
}

function CellContent({ placed, row, index, y, gameUi, imgText, showsNameBars }: {
  readonly placed: PlacedEntryColumn; readonly row: EntryListRow; readonly index: number; readonly y: number
  readonly gameUi: FrameOrigins | null; readonly imgText: FrameOrigins | null; readonly showsNameBars: boolean
}) {
  const { column, x } = placed
  switch (column.kind) {
    case '타순': {
      const cell = entryOrderCellOf(index)
      return 'number' in cell ? <CenteredNumber value={cell.number} x={x} y={y} /> : <CenteredText text="-" x={x} y={y} width={column.width} />
    }
    case '등판순서': {
      const cell = entryRotationCellOf(index)
      if ('today' in cell) {
        return (
          <>
            <FrameSprite folder={GAME_UI_FRAMES} frame={ENTRY_TODAY_OVERLAY_FRAME} origins={gameUi} x={x} y={y} />
            <CenteredImgText origins={imgText} frame={ENTRY_TODAY_LABEL_FRAME} x={x} y={y} width={column.width} />
          </>
        )
      }
      return 'number' in cell ? <CenteredNumber value={cell.number} x={x} y={y} /> : <CenteredText text="-" x={x} y={y} width={column.width} />
    }
    case '연차':
      return <CenteredNumber value={index + 1} x={x} y={y} />
    case '이름':
      return (
        <>
          {/* 0xba2e5(x − 1, y, 54, 15, "!C!cffffff" + 이름, 1, 0, dy 2) — 흰 글 가운데 */}
          <CenteredText text={row.name} x={x - 1} y={y} width={column.width} />
          {showsNameBars && <NameBars row={row} isPitcher={isPitcherColumn(column.word)} x={x} y={y} width={column.width} />}
        </>
      )
    case '딱지': {
      const badge = isPitcherColumn(column.word)
        ? (row.profileLow === undefined ? null : pitcherRoleBadgeOf(row.profileLow, -1))
        : (row.position === undefined ? null : batterPositionBadgeOf(row.position & 0xf, -1, -1))
      if (badge === null) return null
      if (badge.chip < 0 || badge.label < 0) {
        return (
          <PixelText style={{ ...pixel, left: x + ENTRY_BADGE_DASH.dx, top: y + ENTRY_BADGE_DASH.dy, color: WHITE }}>-</PixelText>
        )
      }
      return (
        <>
          <FrameSprite folder={GAME_UI_FRAMES} frame={ENTRY_BADGE_CHIP_BASE + badge.chip} origins={gameUi} x={x} y={y} />
          <CenteredImgText origins={imgText} frame={badge.label} x={x} y={y} width={column.width} />
        </>
      )
    }
    case '기록': {
      const number = entryStatCellOf(column.word, row.batterLine, row.pitcherLine)
      if (number === null) return null
      // 0x6aff8(칸 x + 0x18, y + 3, …, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽 기준으로 0x18 을 품고 있다
      const drawing = yearCellDrawingOf(number)
      return (
        <>
          {drawing.glyphs.map((glyph, glyphIndex) => (
            <img key={glyphIndex} alt="" src={`${NUM}/${pad(glyph.frame)}.png`}
              style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
          ))}
          {drawing.dots.map((dot, dotIndex) => (
            <Rect key={`d${dotIndex}`} x={x + dot.x} y={y + dot.y} width={1} height={2} color={WHITE} />
          ))}
        </>
      )
    }
  }
}

/** 0x571d8 — 타자 세로 두 줄(+0xb & 3 색) · 투수 체력 줄 */
function NameBars({ row, isPitcher, x, y, width }: {
  readonly row: EntryListRow; readonly isPitcher: boolean; readonly x: number; readonly y: number; readonly width: number
}) {
  const h = ENTRY_LIST_LAYOUT.cellHeight
  if (!isPitcher) {
    const color = row.profileLow === undefined ? undefined : ENTRY_FIELDER_COLORS[row.profileLow]
    if (color === undefined) return null
    return <Rect x={x + width - 4} y={y + 1} width={2} height={h - 2} color={color} />
  }
  if (row.stamina === undefined) return null
  const lines = entryStaminaLinesOf(row.stamina.capacity, row.stamina.percent, width)
  return (
    <>
      <Rect x={x + 3} y={y + h - 2} width={lines.length + 1} height={2} color="#1C9300" />
      <Rect x={x + 3} y={y + h - 2} width={lines.current + 1} height={2} color="#FF3C14" />
    </>
  )
}

/** 0x5650c · 0xb9d74 꼴 0x22 — (x, y, 폭, 15) 안 가운데 (박스 y − 2 · dy 2 / y − 1 · dy 1 은 결국 y) */
function CenteredImgText({ origins, frame, x, y, width, style }: {
  readonly origins: FrameOrigins | null; readonly frame: number; readonly x: number; readonly y: number; readonly width: number
  readonly style?: CSSProperties
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const offset = yearLabelOffsetOf(width, origin.width, origin.height)
  return (
    <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`}
      style={{ ...pixel, ...style, left: x + offset.x + origin.x, top: y + offset.y + origin.y }} />
  )
}

/** "!C!cffffff…" 글상자 — 폭 안 가운데 · dy 2 */
function CenteredText({ text, x, y, width }: { readonly text: string; readonly x: number; readonly y: number; readonly width: number }) {
  const textWidth = measurePixelTextWidth(text)
  return <PixelText style={{ ...pixel, left: x + ((width - textWidth) >> 1), top: y + 2, color: WHITE }}>{text}</PixelText>
}

/** 0xba51c(x, y + 3, 25, 15, 틈 0, 값, num 0x1e + 숫자, 꼴 2) — 가로 가운데 */
function CenteredNumber({ value, x, y }: { readonly value: number; readonly x: number; readonly y: number }) {
  return (
    <>
      {yearNumberGlyphsOf(value).map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
      ))}
    </>
  )
}

function CursorBorder({ rect, keyPresses }: { readonly rect: EntryRect; readonly keyPresses: number }) {
  const border = entryCursorBorderOf(rect, keyPresses)
  const { x, width: w, height: h } = border
  return (
    <div data-testid="엔트리-커서">
      <Rect x={x + 1} y={border.y} width={w - 1} height={1} color={border.color} />
      <Rect x={x + 1} y={border.y + h} width={w - 1} height={1} color={border.color} />
      <Rect x={x} y={border.y + 1} width={1} height={h - 1} color={border.color} />
      <Rect x={x + w} y={border.y + 1} width={1} height={h - 1} color={border.color} />
    </div>
  )
}

function Rect({ x, y, width, height, color }: {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string
}) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color }} />
}
