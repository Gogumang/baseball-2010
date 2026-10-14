import { useEffect, useId } from 'react'
import type { CSSProperties } from 'react'
import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import type { ShopBox } from '@/pages/shop/lib/shopLayout'
import {
  ABILITY_LABEL_BASE, ABILITY_LABEL_PALETTE, DESCRIPTION_INSET, EQUIPMENT_BOXES, EQUIPMENT_COLORS, EQUIPMENT_FRAME,
  EQUIPMENT_LABEL_FRAMES, EQUIPMENT_MODE_UI_FRAME, EQUIPMENT_PART_COUNT, EQUIPMENT_TAB_STEP, EQUIPMENT_VISIBLE_ROWS,
  PLUS_FRAME, VALUE_RIGHT_INSET, alignedPositionOf, boardRectsOf, descriptionPanelRectsOf, effectOffsetsOf, rowBoxOf,
  scrollBarRectsOf, tabCursorBoxOf, tabSeparatorRectsOf,
} from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentEdition, PixelRect } from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import { equipmentKeyOf, equipmentWindowKeyOf } from '@/pages/shop/lib/equipmentWindowState'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import * as styles from '@/pages/shop/ui/EquipmentWindow.css'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const NUM = './sprites/num'
const pad = (frame: number) => String(frame).padStart(3, '0')

/** 0xca911(틱, 10) ≠ 0 — 열 번에 아홉 번 켜진다 (탭 커서 · 줄 테두리) */
const BLINK_PERIOD = 10

/** 흰 글자(R=G=B: 255 · 239) → img_text 팔레트 1 두 색(#FFE352 · #FFB229) 이 되는 1차식 */
const PALETTE_ONE_MATRIX = '0 0 0 0 1  0 3.0625 0 0 -2.172304  0 0 2.5625 0 -2.240931  0 0 0 1 0'

interface EquipmentWindowProps {
  readonly edition: EquipmentEdition
  readonly rows: readonly EquipmentRow[]
  readonly state: EquipmentWindowState
  readonly onStateChange: (state: EquipmentWindowState) => void
  /** 줄 초점의 확인 — 상점 구매(0x13460) · 장비착용(0x17ad0) */
  readonly onSelect: (row: EquipmentRow) => void
  /** 탭 초점의 취소 */
  readonly onExit: () => void
  /** 소지금 (만원) — 선수 +2 × 100 */
  readonly money: number
  /** 상점(상태 111) 이면 가진 줄에 흰 막대를 깐다 — 장비착용(121)은 안 깐다 (0x83914 `cmp r3,#0x6f`) */
  readonly isShop: boolean
  readonly isKeyEnabled: boolean
}

/** 장비 창 0x83378 — 머리말은 `lib/equipmentWindowLayout.ts` */
export function EquipmentWindow({
  edition, rows, state, onStateChange, onSelect, onExit, money, isShop, isKeyEnabled,
}: EquipmentWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const update = useUpdateCounter()
  const isBlinkOn = update % BLINK_PERIOD !== 0
  const paletteFilterId = `equipment-palette1-${useId().replace(/:/g, '')}`
  const isListFocused = state.focus === '줄'

  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const key = equipmentKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const result = equipmentWindowKeyOf(state, key, rows.length)
      if (result.kind === '나가기') return onExit()
      if (result.kind === '고르기') {
        const row = rows[result.cursor]
        if (row !== undefined) onSelect(row)
        return
      }
      if (result.state !== state) onStateChange(result.state)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const visibleRows = rows.slice(state.top, state.top + EQUIPMENT_VISIBLE_ROWS)
  const selected = isListFocused ? rows[state.cursor] : undefined
  const { label: labelBox, value: valueBox, row: rowBox, description: descriptionBox } = EQUIPMENT_BOXES

  return (
    <>
      <PixelRects rects={[
        ...boardRectsOf(EQUIPMENT_BOXES.board, true),
        ...tabSeparatorRectsOf(EQUIPMENT_BOXES.tab),
        ...descriptionPanelRectsOf(descriptionBox),
      ]} />

      {/* 프레임 그림 — 부위 아이콘 넷 · 왼쪽 막대 셋 · 오른쪽 막대 다섯 · ▲▼ (0x8360a vt+0x10) */}
      <FramePicture folder={MODE_UI} frame={EQUIPMENT_FRAME[edition]} origins={modeUiOrigins} x={0} y={0} />

      {/* 이름표 셋 — 소지금 · 가격 · 효과 (팔레트 0, 정렬 0x24, ox −2) */}
      {EQUIPMENT_LABEL_FRAMES.map((frame, index) => (
        <AlignedFrame key={frame} folder={IMG_TEXT} frame={frame} origins={textOrigins}
          target={rowBoxOf(labelBox, index)} align={0x24} ox={-VALUE_RIGHT_INSET} />
      ))}

      {/* 소지금 — 박스 2 줄 0 */}
      <SpriteNumber glyphs={moneyGlyphsOf(money)} right={valueBox.x + valueBox.width - VALUE_RIGHT_INSET}
        boxTop={valueBox.y} boxHeight={valueBox.height} />

      {/* 부위 탭 커서 — 목록 초점이면 늘, 탭 초점이면 깜박인다 */}
      {(isListFocused || isBlinkOn) && (
        <AlignedFrame folder={MODE_UI} frame={EQUIPMENT_MODE_UI_FRAME.tabCursor} origins={modeUiOrigins}
          target={tabCursorBoxOf(state.part)} align={0x22} testId="장비-탭커서" />
      )}
      {Array.from({ length: EQUIPMENT_PART_COUNT }, (_unused, part) => (
        <button key={part} type="button" aria-label={`부위 ${part + 1}`} className={styles.tabButton}
          aria-pressed={part === state.part}
          style={{
            left: EQUIPMENT_BOXES.tab.x + EQUIPMENT_TAB_STEP * part, top: EQUIPMENT_BOXES.tab.y,
            width: EQUIPMENT_BOXES.tab.width, height: EQUIPMENT_BOXES.tab.height,
          }}
          onClick={() => onStateChange({ focus: '탭', part, cursor: 0, top: 0 })} />
      ))}

      {/* 목록 다섯 줄 */}
      {visibleRows.map((row, offset) => {
        const index = state.top + offset
        const target = rowBoxOf(rowBox, offset)
        const bar = row.isEquipped
          ? EQUIPMENT_MODE_UI_FRAME.equippedBar
          : isShop && row.isOwned ? EQUIPMENT_MODE_UI_FRAME.ownedBar : null
        const color = row.isEquipped
          ? EQUIPMENT_COLORS.equippedText
          : isShop && row.isOwned ? EQUIPMENT_COLORS.ownedText : EQUIPMENT_COLORS.rowText
        return (
          <span key={row.id}>
            {bar !== null && (
              <AlignedFrame folder={MODE_UI} frame={bar} origins={modeUiOrigins} target={target} align={0x22} />
            )}
            <button type="button" className={styles.rowButton} data-testid={`장비줄-${row.level}`}
              style={{ left: target.x, top: target.y, width: target.width, height: target.height, color }}
              onClick={() => (isListFocused && state.cursor === index
                ? onSelect(row)
                : onStateChange({ ...state, focus: '줄', cursor: index }))}>
              {row.name}
            </button>
          </span>
        )
      })}

      {selected !== undefined && (
        <SelectedDetails row={selected} edition={edition} part={state.part}
          cursorBox={rowBoxOf(rowBox, state.cursor - state.top)} isBlinkOn={isBlinkOn}
          textOrigins={textOrigins} paletteFilterId={paletteFilterId} />
      )}

      <PixelRects rects={scrollBarRectsOf(EQUIPMENT_BOXES.scrollBar, rows.length, state.top, EQUIPMENT_VISIBLE_ROWS)} />

      <svg className={styles.hiddenSvg} aria-hidden>
        <filter id={paletteFilterId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={PALETTE_ONE_MATRIX} />
        </filter>
      </svg>
    </>
  )
}

/** 고른 줄의 노랑 테두리 · 가격 · 효과 · 설명 (0x83c02~0x84334) */
function SelectedDetails({ row, edition, part, cursorBox, isBlinkOn, textOrigins, paletteFilterId }: {
  readonly row: EquipmentRow
  readonly edition: EquipmentEdition
  readonly part: number
  readonly cursorBox: ShopBox
  readonly isBlinkOn: boolean
  readonly textOrigins: FrameOrigins | null
  readonly paletteFilterId: string
}) {
  const { value: valueBox, description: descriptionBox } = EQUIPMENT_BOXES
  const priceBox = rowBoxOf(valueBox, 1)
  const effectBox = rowBoxOf(valueBox, 2)
  const offsets = effectOffsetsOf(row.bonus)
  const lines = parseGameMarkup(row.description)
  return (
    <>
      {/* 0xb9ed5 노랑 사각 테두리 — 0x6a978 이 폭·높이에 1 을 더해 플랫폼 0x14006d8 에 넘겨 (w + 1) × (h + 1) 칸을 덮는다(U-113 확정 — 플랫폼은 받은 폭 · 높이를 칸 수로 본다) */}
      {isBlinkOn && (
        <svg className={styles.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges"
          data-testid="장비-줄테두리">
          <rect x={cursorBox.x + 0.5} y={cursorBox.y + 0.5} width={cursorBox.width} height={cursorBox.height}
            fill="none" stroke={EQUIPMENT_COLORS.cursor} strokeWidth={1} />
        </svg>
      )}

      {/* 가격 — 박스 2 줄 1 */}
      <SpriteNumber glyphs={moneyGlyphsOf(row.price)} right={priceBox.x + priceBox.width - VALUE_RIGHT_INSET}
        boxTop={priceBox.y} boxHeight={priceBox.height} />

      {/* 효과 — 능력치 이름(팔레트 1) · "+" · 보너스 (박스 2 줄 2) */}
      <span data-testid="장비-효과" data-bonus={row.bonus}>
        <AlignedFrame folder={IMG_TEXT} frame={ABILITY_LABEL_BASE[edition] + part} origins={textOrigins}
          target={effectBox} align={0x24} ox={offsets.labelOx} style={{ filter: `url(#${paletteFilterId})` }}
          paletteIndex={ABILITY_LABEL_PALETTE} />
        <PlusSign target={effectBox} ox={offsets.plusOx} />
        <SpriteNumber glyphs={numberGlyphsOf(row.bonus)} right={effectBox.x + effectBox.width - VALUE_RIGHT_INSET}
          boxTop={effectBox.y} boxHeight={effectBox.height} />
      </span>

      {/* 설명 — 박스 4, 정렬 0x11, (5, 5) */}
      <div className={styles.description} data-testid="장비-설명"
        style={{ left: descriptionBox.x + DESCRIPTION_INSET, top: descriptionBox.y + DESCRIPTION_INSET }}>
        {lines.map((line, lineIndex) => (
          <p key={lineIndex} className={styles.descriptionLine}
            style={line.isCentered ? { textAlign: 'center' } : undefined}>
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
                {segment.text}
              </span>
            ))}
          </p>
        ))}
      </div>
    </>
  )
}

/** num "+" (6×6) — 0xb9d35 정렬 0x24 · 세로 가운데 내림 · oy 1 */
const PLUS_SIZE = { width: 6, height: 6 } as const
function PlusSign({ target, ox }: { readonly target: ShopBox; readonly ox: number }) {
  const { x, y } = alignedPositionOf(target, PLUS_SIZE.width, PLUS_SIZE.height, 0x24, ox, 1, true)
  return <img className={styles.layer} alt="" src={`${NUM}/${pad(PLUS_FRAME)}.png`} style={{ left: x, top: y }} />
}

function FramePicture({ folder, frame, origins, x, y }: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  return <img className={styles.layer} alt="" src={`${folder}/${pad(frame)}.png`} style={{ left: x + origin.x, top: y + origin.y }} />
}

/** 0xb9e05 — 프레임을 박스에 정렬해 놓는다 (원점이 0 이 아닌 프레임은 원점만큼 더 민다) */
function AlignedFrame({ folder, frame, origins, target, align, ox = 0, oy = 0, style, testId, paletteIndex }: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly target: ShopBox
  readonly align: number
  readonly ox?: number
  readonly oy?: number
  readonly style?: CSSProperties
  readonly testId?: string
  readonly paletteIndex?: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const { x, y } = alignedPositionOf(target, origin.width, origin.height, align, ox, oy)
  return (
    <img className={styles.layer} alt="" data-testid={testId} data-frame={frame} data-palette={paletteIndex}
      src={`${folder}/${pad(frame)}.png`} style={{ left: x + origin.x, top: y + origin.y, ...style }} />
  )
}

function PixelRects({ rects }: { readonly rects: readonly PixelRect[] }) {
  return (
    <svg className={styles.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
      ))}
    </svg>
  )
}
