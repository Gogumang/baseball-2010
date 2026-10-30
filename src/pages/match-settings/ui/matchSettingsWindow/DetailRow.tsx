import type { ReactNode } from 'react'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { detailBitsOf, detailCellCountOf } from '@/pages/match-settings/lib/matchSettingsMenu'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import {
  BASE_LABEL_FRAME,
  DETAIL_CELL_SHAPES,
  DETAIL_LABEL,
  DETAIL_LABEL_FRAMES,
  DETAIL_MARK,
  DETAIL_NUMBER_COLOR,
  DETAIL_ROW_Y,
  IMG_TEXT_PALETTE,
  OUTLINE_COLOR,
  baseLabelPointOf,
  detailCellBoxOf,
  detailCellOutlineOf,
  detailNumberCenterOf,
} from '@/pages/match-settings/lib/matchSettingsLayout'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { cellLabelOf } from '@/pages/match-settings/lib/matchSettingsDescription'
import { SLT_FRAMES, SLT_IMAGES, pngOf } from '@/pages/match-settings/ui/matchSettingsWindow/settingsAssets'
import { OriginSprite } from '@/pages/match-settings/ui/matchSettingsWindow/OriginSprite'
import { TintedDigit } from '@/pages/match-settings/ui/matchSettingsWindow/TintedDigit'
import { Outline } from '@/pages/match-settings/ui/matchSettingsWindow/Outline'

interface DetailRowProps {
  readonly row: number
  readonly label: string
  readonly state: MatchSettingsWindowState
  readonly isBlinkOn: boolean
  readonly text: (frame: number, x: number, y: number, palette?: number, key?: string) => ReactNode
  readonly sltOrigins: FrameOrigins | null
  readonly onPress: (cell: number) => void
}

/** 상세 한 줄 — 네모 · 이름 두 장 · 칸들 · 켜진 칸 하늘 테 · 깜빡이는 노랑 커서 (0x60fee~0x61ae0) */
export function DetailRow({ row, label, state, isBlinkOn, text, sltOrigins, onPress }: DetailRowProps) {
  const rowY = DETAIL_ROW_Y[row] ?? 0
  const shape = DETAIL_CELL_SHAPES[row]
  const isCurrentRow = state.detailRow === row
  const bits = detailBitsOf(state.settings, row)
  const frames = DETAIL_LABEL_FRAMES[row] ?? []
  if (shape === undefined) return null
  return (
    <>
      <img
        className={styles.layer}
        alt=""
        src={pngOf(SLT_IMAGES, isCurrentRow ? DETAIL_MARK.current : DETAIL_MARK.other)}
        style={{ left: DETAIL_MARK.x, top: rowY + DETAIL_MARK.dy }}
      />
      {frames.map((frame, index) => text(frame, DETAIL_LABEL.x[index] ?? 0, rowY + DETAIL_LABEL.dy, IMG_TEXT_PALETTE.흰, `l${row}-${index}`))}
      {Array.from({ length: detailCellCountOf(row) }, (_unused, cell) => {
        const isOn = ((bits >> cell) & 1) !== 0
        const box = detailCellBoxOf(row, cell)
        const center = detailNumberCenterOf(row, cell)
        const base = baseLabelPointOf(row, cell)
        const isCursor = isCurrentRow && cell === state.detailCell
        const cellFrame = isOn ? shape.onFrame : shape.offFrame
        return (
          <span key={cell}>
            <OriginSprite folder={SLT_FRAMES} frame={cellFrame} origins={sltOrigins} x={box.x} y={box.y} />
            <TintedDigit digit={cell + 1} centerX={center.x} centerY={center.y} color={isOn ? DETAIL_NUMBER_COLOR.on : DETAIL_NUMBER_COLOR.off} />
            {shape.hasBaseLabel && text(BASE_LABEL_FRAME, base.x, base.y, isOn ? IMG_TEXT_PALETTE.흰 : IMG_TEXT_PALETTE.회색, `b${row}-${cell}`)}
            {/* 61158: 켜진 칸은 하늘 테 — 지금 줄의 지금 칸만 건너뛴다(그 칸은 노랑 커서 자리) */}
            {isOn && !isCursor && <Outline outline={detailCellOutlineOf(row, cell, OUTLINE_COLOR.켜짐)} />}
            <button
              type="button"
              className={styles.hitArea}
              aria-label={`${label} ${cellLabelOf(row, cell)}`}
              aria-pressed={isOn}
              data-frame={cellFrame}
              style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
              onClick={() => onPress(cell)}
            />
          </span>
        )
      })}
      {isCurrentRow && isBlinkOn && state.detailCell < detailCellCountOf(row) && (
        <Outline outline={detailCellOutlineOf(row, state.detailCell, OUTLINE_COLOR.커서)} />
      )}
    </>
  )
}
