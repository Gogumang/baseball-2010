import { useId } from 'react'
import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { moneyGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  EQUIPMENT_BOXES,
  EQUIPMENT_FRAME,
  EQUIPMENT_LABEL_FRAMES,
  EQUIPMENT_MODE_UI_FRAME,
  EQUIPMENT_PART_COUNT,
  EQUIPMENT_TAB_STEP,
  EQUIPMENT_VISIBLE_ROWS,
  VALUE_RIGHT_INSET,
  boardRectsOf,
  descriptionPanelRectsOf,
  rowBoxOf,
  scrollBarRectsOf,
  tabCursorBoxOf,
  tabSeparatorRectsOf,
} from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentEdition } from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import { AlignedFrame, FramePicture, PixelRects } from '@/pages/shop/ui/equipmentWindow/equipmentPictures'
import { IMG_TEXT, MODE_UI } from '@/pages/shop/ui/equipmentWindow/spriteFolders'
import { EquipmentRows } from '@/pages/shop/ui/equipmentWindow/EquipmentRows'
import { SelectedDetails } from '@/pages/shop/ui/equipmentWindow/SelectedDetails'
import { useEquipmentWindowKeys } from '@/pages/shop/ui/equipmentWindow/useEquipmentWindowKeys'
import * as styles from '@/pages/shop/ui/EquipmentWindow.css'

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
export function EquipmentWindow({ edition, rows, state, onStateChange, onSelect, onExit, money, isShop, isKeyEnabled }: EquipmentWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const update = useUpdateCounter()
  const isBlinkOn = update % BLINK_PERIOD !== 0
  const paletteFilterId = `equipment-palette1-${useId().replace(/:/g, '')}`
  const isListFocused = state.focus === '줄'

  useEquipmentWindowKeys(isKeyEnabled, state, rows, onStateChange, onSelect, onExit)

  // 터치 기기 — 줄 목록이 5줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 줄은 눌러서 고른다
  useTouchScrollKeys(isKeyEnabled && isListFocused && rows.length > EQUIPMENT_VISIBLE_ROWS)

  const selected = isListFocused ? rows[state.cursor] : undefined
  const { label: labelBox, value: valueBox, row: rowBox, description: descriptionBox } = EQUIPMENT_BOXES

  return (
    <>
      <PixelRects
        rects={[
          ...boardRectsOf(EQUIPMENT_BOXES.board, true),
          ...tabSeparatorRectsOf(EQUIPMENT_BOXES.tab),
          ...descriptionPanelRectsOf(descriptionBox),
        ]}
      />

      {/* 프레임 그림 — 부위 아이콘 넷 · 왼쪽 막대 셋 · 오른쪽 막대 다섯 · ▲▼ (0x8360a vt+0x10) */}
      <FramePicture folder={MODE_UI} frame={EQUIPMENT_FRAME[edition]} origins={modeUiOrigins} x={0} y={0} />

      {/* 이름표 셋 — 소지금 · 가격 · 효과 (팔레트 0, 정렬 0x24, ox −2) */}
      {EQUIPMENT_LABEL_FRAMES.map((frame, index) => (
        <AlignedFrame
          key={frame}
          folder={IMG_TEXT}
          frame={frame}
          origins={textOrigins}
          target={rowBoxOf(labelBox, index)}
          align={0x24}
          ox={-VALUE_RIGHT_INSET}
        />
      ))}

      {/* 소지금 — 박스 2 줄 0 */}
      <SpriteNumber
        glyphs={moneyGlyphsOf(money)}
        right={valueBox.x + valueBox.width - VALUE_RIGHT_INSET}
        boxTop={valueBox.y}
        boxHeight={valueBox.height}
      />

      {/* 부위 탭 커서 — 목록 초점이면 늘, 탭 초점이면 깜박인다 */}
      {(isListFocused || isBlinkOn) && (
        <AlignedFrame
          folder={MODE_UI}
          frame={EQUIPMENT_MODE_UI_FRAME.tabCursor}
          origins={modeUiOrigins}
          target={tabCursorBoxOf(state.part)}
          align={0x22}
          testId="장비-탭커서"
        />
      )}
      {Array.from({ length: EQUIPMENT_PART_COUNT }, (_unused, part) => (
        <button
          key={part}
          type="button"
          aria-label={`부위 ${part + 1}`}
          className={styles.tabButton}
          aria-pressed={part === state.part}
          style={{
            left: EQUIPMENT_BOXES.tab.x + EQUIPMENT_TAB_STEP * part,
            top: EQUIPMENT_BOXES.tab.y,
            width: EQUIPMENT_BOXES.tab.width,
            height: EQUIPMENT_BOXES.tab.height,
          }}
          onClick={() => onStateChange({ focus: '탭', part, cursor: 0, top: 0 })}
        />
      ))}

      {/* 목록 다섯 줄 */}
      <EquipmentRows rows={rows} state={state} isShop={isShop} modeUiOrigins={modeUiOrigins} onStateChange={onStateChange} onSelect={onSelect} />

      {selected !== undefined && (
        <SelectedDetails
          row={selected}
          edition={edition}
          part={state.part}
          cursorBox={rowBoxOf(rowBox, state.cursor - state.top)}
          isBlinkOn={isBlinkOn}
          textOrigins={textOrigins}
          paletteFilterId={paletteFilterId}
        />
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
