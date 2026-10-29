import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite } from '@/shared/ui'
import { ACE_LEVEL_UP_BUTTONS, ACE_LEVEL_UP_BUTTON_SIZE } from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'
import { POPUP } from '@/widgets/ace-level-up/ui/aceLevelUpWindow/aceLevelUpAssets'

/**
 * 5f948 · 5f97c popup 1 "예" · 2 "아니오" — 고른 칸은 6 · 7 을 덧긋는다 (5f9f6).
 * 웹 누름: "예" 는 고른 칸이면 확인, 아니면 고르기 · "아니오" 는 닫기
 */
export function AceLevelUpButtons({
  popupOrigins,
  isYes,
  onConfirm,
  onPickYes,
  onClose,
}: {
  readonly popupOrigins: FrameOrigins | null
  readonly isYes: boolean
  readonly onConfirm: () => void
  readonly onPickYes: () => void
  readonly onClose: () => void
}) {
  return (
    <>
      {ACE_LEVEL_UP_BUTTONS.map((button, index) => {
        const isSelected = (index === 0) === isYes
        return (
          <span key={button.label}>
            <FrameSprite folder={POPUP} frame={button.frame} origins={popupOrigins} x={button.x} y={button.y} />
            {isSelected && <FrameSprite folder={POPUP} frame={button.selectedFrame} origins={popupOrigins} x={button.x} y={button.y} />}
            <button
              type="button"
              className={styles.hitArea}
              aria-label={button.label}
              aria-pressed={isSelected}
              style={{ left: button.x, top: button.y, width: ACE_LEVEL_UP_BUTTON_SIZE.width, height: ACE_LEVEL_UP_BUTTON_SIZE.height }}
              onClick={() => pressAceLevelUpButton(index, isYes, onConfirm, onPickYes, onClose)}
            />
          </span>
        )
      })}
    </>
  )
}

function pressAceLevelUpButton(index: number, isYes: boolean, onConfirm: () => void, onPickYes: () => void, onClose: () => void): void {
  if (index !== 0) return onClose()
  if (isYes) return onConfirm()
  return onPickYes()
}
