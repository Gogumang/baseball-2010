import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { EQUIPMENT_BOXES, EQUIPMENT_COLORS, EQUIPMENT_MODE_UI_FRAME, EQUIPMENT_VISIBLE_ROWS, rowBoxOf } from '@/pages/shop/lib/equipmentWindowLayout'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import { AlignedFrame } from '@/pages/shop/ui/equipmentWindow/equipmentPictures'
import { MODE_UI } from '@/pages/shop/ui/equipmentWindow/spriteFolders'
import * as styles from '@/pages/shop/ui/EquipmentWindow.css'

/** 줄 바탕 막대 — 지금 낀 것(주황 43)이 상점에서 가진 것(흰 44)보다 나중에 칠해 이긴다 (0x83914 · 0x83984) */
function rowBarOf(row: EquipmentRow, isShop: boolean): number | null {
  if (row.isEquipped) return EQUIPMENT_MODE_UI_FRAME.equippedBar
  if (isShop && row.isOwned) return EQUIPMENT_MODE_UI_FRAME.ownedBar
  return null
}

/** 줄 글색 — 낀 것 남색 · 상점에서 가진 것 베이지 · 그 밖 하늘 (0x83802 · 0x83904 · 0x83984) */
function rowTextColorOf(row: EquipmentRow, isShop: boolean): string {
  if (row.isEquipped) return EQUIPMENT_COLORS.equippedText
  if (isShop && row.isOwned) return EQUIPMENT_COLORS.ownedText
  return EQUIPMENT_COLORS.rowText
}

/** 목록 다섯 줄 (0x837ea) — 보이는 줄은 눌러서 고른다(고른 줄을 다시 누르면 확인) */
export function EquipmentRows({
  rows,
  state,
  isShop,
  modeUiOrigins,
  onStateChange,
  onSelect,
}: {
  readonly rows: readonly EquipmentRow[]
  readonly state: EquipmentWindowState
  readonly isShop: boolean
  readonly modeUiOrigins: FrameOrigins | null
  readonly onStateChange: (state: EquipmentWindowState) => void
  readonly onSelect: (row: EquipmentRow) => void
}) {
  const isListFocused = state.focus === '줄'
  return rows.slice(state.top, state.top + EQUIPMENT_VISIBLE_ROWS).map((row, offset) => {
    const index = state.top + offset
    const target = rowBoxOf(EQUIPMENT_BOXES.row, offset)
    const bar = rowBarOf(row, isShop)
    return (
      <span key={row.id}>
        {bar !== null && <AlignedFrame folder={MODE_UI} frame={bar} origins={modeUiOrigins} target={target} align={0x22} />}
        <button
          type="button"
          className={styles.rowButton}
          data-testid={`장비줄-${row.level}`}
          style={{ left: target.x, top: target.y, width: target.width, height: target.height, color: rowTextColorOf(row, isShop) }}
          onClick={() => (isListFocused && state.cursor === index ? onSelect(row) : onStateChange({ ...state, focus: '줄', cursor: index }))}
        >
          {row.name}
        </button>
      </span>
    )
  })
}
