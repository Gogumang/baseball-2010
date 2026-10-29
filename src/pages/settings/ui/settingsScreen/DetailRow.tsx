import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  DETAIL_CHOICES,
  DETAIL_COLORS,
  DETAIL_ROW,
  DETAIL_ROWS,
  detailRowTopOf,
  detailValueOutlineOf,
  iconCenterOffsetOf,
} from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'
import { SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/settings/ui/settingsScreen/settingsAssets'

type Shift = { readonly dx: number; readonly dy: number }

/** 고른 줄 깜빡임 — 화살 둘 · 흰 테두리 */
function DetailRowBlink({ top, dx, dy }: { readonly top: number } & Shift) {
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, DETAIL_ROW.arrowImage)}
        style={{ left: DETAIL_ROW.leftArrow.x + dx, top: top + DETAIL_ROW.leftArrow.dy + dy }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, DETAIL_ROW.arrowImage)}
        style={{ left: DETAIL_ROW.rightArrow.x + dx, top: top + DETAIL_ROW.rightArrow.dy + dy, transform: 'scaleX(-1)' }}
      />
      <div
        className={styles.selectedOutline}
        style={{
          left: DETAIL_ROW.outline.x + dx,
          top: top + DETAIL_ROW.outline.dy + dy,
          width: DETAIL_ROW.outline.width,
          height: DETAIL_ROW.outline.height,
        }}
      />
    </>
  )
}

interface DetailRowProps {
  readonly index: number
  /** 지금 값 0/1 */
  readonly value: number
  readonly isSelected: boolean
  /** 깜빡임 켜진 고른 줄 — 펴는 동안은 0x59548 이 끈다 */
  readonly isBlinkOn: boolean
  /** 까딱임은 줄 루프(0x59f4a~0x5a224) 그림 모두 — 줄 뒤 값 칸 노랑 테두리(0x5a226~)는 제자리다 */
  readonly shift: Shift
  readonly frames: FrameOrigins | null
  readonly onPress: (index: number) => void
}

/** 상세 설정 한 줄 — 점 · 이름 · 아이콘 · 막대 · 두 칸 · (깜빡임) · 지금 값 테두리 · 누름 칸 */
export function DetailRow({ index, value, isSelected, isBlinkOn, shift, frames, onPress }: DetailRowProps) {
  const row = DETAIL_ROWS[index]
  const top = detailRowTopOf(index)
  const icon = iconCenterOffsetOf(row.icon)
  const valueOutline = detailValueOutlineOf(value)
  const { dx, dy } = shift
  return (
    <div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, isSelected ? DETAIL_ROW.selectedBulletImage : DETAIL_ROW.bulletImage)}
        style={{ left: DETAIL_ROW.bullet.x + dx, top: top + DETAIL_ROW.bullet.dy + dy }}
      />
      <div className={styles.valueName} style={{ left: DETAIL_ROW.name.x + dx, top: top + DETAIL_ROW.name.dy + dy }}>
        {row.name}
      </div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, DETAIL_ROW.iconBackImage)}
        style={{ left: DETAIL_ROW.iconBack.x + dx, top: top + DETAIL_ROW.iconBack.dy + dy }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, row.icon.image)}
        style={{ left: DETAIL_ROW.iconBack.x + icon.dx + dx, top: top + DETAIL_ROW.iconBack.dy + icon.dy + dy }}
      />
      <FrameSprite folder={SLT_FRAMES} frame={DETAIL_ROW.barFrame} origins={frames} x={DETAIL_ROW.bar.x + dx} y={top + DETAIL_ROW.bar.dy + dy} />

      {row.labels.map((label, choice) => (
        <div
          key={label}
          className={styles.vibrationLabel}
          style={{
            left: DETAIL_CHOICES[choice].x + dx,
            top: top + DETAIL_CHOICES[choice].dy + dy,
            width: DETAIL_CHOICES[choice].width,
            color: value === choice ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
          }}
        >
          {label}
        </div>
      ))}

      {isBlinkOn && <DetailRowBlink top={top} dx={dx} dy={dy} />}

      {/* 줄 루프 뒤 지금 값 칸 노랑 테두리 (0x5a226~) — 줄마다 늘 */}
      <div
        className={styles.valueOutline}
        data-testid={`상세값테두리-${index}`}
        style={{ left: valueOutline.x, top: top + valueOutline.dy, width: valueOutline.width, height: valueOutline.height }}
      />

      <button
        type="button"
        className={styles.row}
        aria-label={row.name}
        style={{
          left: DETAIL_ROW.outline.x,
          top: top + DETAIL_ROW.outline.dy,
          width: DETAIL_ROW.outline.width,
          height: DETAIL_ROW.outline.height,
        }}
        onClick={() => onPress(index)}
      />
    </div>
  )
}
