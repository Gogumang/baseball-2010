import { SEASON_EQUIPMENT_LEVEL_COUNT } from '@/entities/season-mode/model/seasonEquipment'
import { EQUIPMENT_COLORS, EQUIPMENT_WINDOW, equipmentItemNameOf, isBlinkOn, windowRowOf } from '@/pages/season/lib/seasonEquipmentWindow'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { MODE_UI, imageOf, pixel, pressable } from './equipmentAssets'
import type { EquipmentWindowProps } from './EquipmentWindow'

/** 칸 목록에서 보이는 줄 — 맨 윗줄부터 다섯 줄, 열한 칸 끝에서 자른다 */
const visibleLevelsOf = (top: number) =>
  Array.from({ length: EQUIPMENT_WINDOW.visibleRows }, (_unused, row) => top + row).filter((index) => index < SEASON_EQUIPMENT_LEVEL_COUNT)

/** 칸 목록 (1 열 × 11 줄 중 다섯 줄) — 낀 칸 막대 · 이름 · 깜빡이는 커서 */
export function EquipmentItemRows({ isBatter, equipment, part, level, top, isItemFocus, tick, isHiddenOpen, onPickLevel }: EquipmentWindowProps) {
  const equippedIndex = (equipment[part] ?? 0) - 1
  return visibleLevelsOf(top).map((index, row) => {
    const box = windowRowOf(EQUIPMENT_WINDOW.items, row)
    const isEquipped = equippedIndex === index
    const isCursor = isItemFocus && index === level
    const name = equipmentItemNameOf(isBatter, part, index, isHiddenOpen)
    return (
      <div key={index} data-testid={`장비-칸-${index}`}>
        {isEquipped && <img alt="" src={imageOf(MODE_UI, EQUIPMENT_WINDOW.equippedBarFrame)} style={{ ...pixel, left: box.x, top: box.y }} />}
        <button
          type="button"
          className={styles.title}
          aria-label={name}
          aria-current={isCursor}
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            lineHeight: `${box.height}px`,
            color: isEquipped ? EQUIPMENT_COLORS.equippedText : EQUIPMENT_COLORS.itemText,
            pointerEvents: 'auto',
            ...pressable,
          }}
          onClick={() => onPickLevel(index)}
        >
          {name}
        </button>
        {/* 0xb9ed5 → 0x6a978 은 폭 · 높이에 1 을 더해 (w + 1) × (h + 1) 칸을 덮는다 (U-113, R12 6절) */}
        {isCursor && isBlinkOn(tick) && (
          <div
            data-testid="장비-커서"
            style={{
              ...pixel,
              left: box.x,
              top: box.y,
              width: box.width + 1,
              height: box.height + 1,
              boxSizing: 'border-box',
              border: `1px solid ${EQUIPMENT_COLORS.cursor}`,
            }}
          />
        )}
      </div>
    )
  })
}
