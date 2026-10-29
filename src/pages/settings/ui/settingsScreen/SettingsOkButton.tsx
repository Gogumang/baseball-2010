import { OK_BUTTON, OK_SELECTED_FRAME, OK_SELECTED_OVERFLOW, PANEL, VIBRATION, okButtonTopOf, rowTopOf } from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'
import { POPUP, imageSrc } from '@/pages/settings/ui/settingsScreen/settingsAssets'

/** 진동 지금 값 칸 노랑 테두리 — 줄 루프 뒤 (0x59d70) */
export function VibrationValueOutline({ isOn, panelDy }: { readonly isOn: boolean; readonly panelDy: number }) {
  return (
    <div
      className={styles.valueOutline}
      data-testid="진동값테두리"
      style={{
        left: VIBRATION.outline.x + VIBRATION.outline.step * (isOn ? 1 : 0),
        top: rowTopOf(2) + panelDy + VIBRATION.outline.dy,
        width: VIBRATION.outline.width,
        height: VIBRATION.outline.height,
      }}
    />
  )
}

/** 아래 OK 단추 — 고른 칸이면 popup 프레임 18 (0x59de2~0x59e4e) */
export function SettingsOkButton({
  panelHeight,
  isSelected,
  onPress,
}: {
  readonly panelHeight: number
  readonly isSelected: boolean
  readonly onPress: () => void
}) {
  return (
    <button
      type="button"
      className={styles.row}
      aria-label="확인"
      style={{
        left: (PANEL.width - OK_BUTTON.width) / 2 + PANEL.x,
        top: okButtonTopOf(panelHeight),
        width: OK_BUTTON.width,
        height: OK_BUTTON.height,
      }}
      onClick={onPress}
    >
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(POPUP, isSelected ? OK_SELECTED_FRAME : OK_BUTTON.frame)}
        style={isSelected ? { left: -OK_SELECTED_OVERFLOW, top: -OK_SELECTED_OVERFLOW } : { left: 0, top: 0 }}
      />
    </button>
  )
}
