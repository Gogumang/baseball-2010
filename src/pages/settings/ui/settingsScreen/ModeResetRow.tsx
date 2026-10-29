import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DETAIL_COLORS, MODE_RESET_ROW, modeResetRowTopOf } from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'
import { SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/settings/ui/settingsScreen/settingsAssets'

const { bar, bullet, name: nameBox } = MODE_RESET_ROW

interface ModeResetRowProps {
  readonly name: string
  readonly index: number
  readonly isSelected: boolean
  /** 고른 줄 흰 테두리 — 깜빡임 켜진 그림 · 다 편 판에서만 */
  readonly isOutlineOn: boolean
  readonly shift: { readonly dx: number; readonly dy: number }
  readonly frames: FrameOrigins | null
  readonly onPress: (index: number) => void
}

/** 모드 초기화 한 줄 — 점 · 막대 · 이름 · (테두리) · 누름 칸 */
export function ModeResetRow({ name, index, isSelected, isOutlineOn, shift, frames, onPress }: ModeResetRowProps) {
  const top = modeResetRowTopOf(index)
  const { dx, dy } = shift
  return (
    <div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, isSelected ? MODE_RESET_ROW.selectedBulletImage : MODE_RESET_ROW.bulletImage)}
        style={{ left: bullet.x + dx, top: top + bullet.dy + dy }}
      />
      <FrameSprite folder={SLT_FRAMES} frame={MODE_RESET_ROW.barFrame} origins={frames} x={bar.x + dx} y={top + bar.dy + dy} />
      <div
        className={styles.menuName}
        style={{
          left: nameBox.x + dx,
          top: top + nameBox.dy + dy,
          width: nameBox.width,
          color: isSelected ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
        }}
      >
        {name}
      </div>
      {isOutlineOn && (
        <div className={styles.selectedOutline} style={{ left: bar.x + dx, top: top + bar.dy + dy, width: bar.width, height: bar.height }} />
      )}
      <button
        type="button"
        className={styles.row}
        aria-label={name}
        style={{ left: bar.x, top: top + bar.dy, width: bar.width, height: bar.height }}
        onClick={() => onPress(index)}
      />
    </div>
  )
}
