import { CHANCE_VALUE_COUNT } from '@/pages/match-settings/lib/matchSettingsMenu'
import { CHANCE_SLOTS, CHANCE_SLOT_SIZE } from '@/pages/match-settings/lib/matchSettingsLayout'
import { CHANCE_LABELS } from '@/pages/match-settings/lib/matchSettingsText'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { OriginSprite } from './OriginSprite'
import { POPUP_FRAMES } from './settingsAssets'
import type { SettingsDraw } from './settingsDraw'

/** 찬스 값 칸 둘 — popup 프레임 위에 이름, 깜빡이면 고른 칸을 고른 프레임으로 덮는다 */
export function ChanceSlots({
  draw,
  value,
  onPress,
}: {
  readonly draw: SettingsDraw
  readonly value: number
  readonly onPress: (index: number) => void
}) {
  const selectedSlot = CHANCE_SLOTS[value]
  return (
    <>
      {CHANCE_SLOTS.slice(0, CHANCE_VALUE_COUNT).map((slot, index) => (
        <span key={slot.frame}>
          <OriginSprite folder={POPUP_FRAMES} frame={slot.frame} origins={draw.popupOrigins} x={slot.x} y={slot.y} />
          {draw.text(slot.label, slot.labelX, slot.labelY)}
          <button
            type="button"
            className={styles.hitArea}
            aria-label={CHANCE_LABELS[index]}
            aria-current={index === value}
            data-frame={slot.frame}
            style={{ left: slot.x, top: slot.y, width: CHANCE_SLOT_SIZE, height: CHANCE_SLOT_SIZE }}
            onClick={() => onPress(index)}
          />
        </span>
      ))}
      {draw.isBlinkOn && selectedSlot !== undefined && (
        <OriginSprite folder={POPUP_FRAMES} frame={selectedSlot.selectedFrame} origins={draw.popupOrigins} x={selectedSlot.x} y={selectedSlot.y} />
      )}
    </>
  )
}
