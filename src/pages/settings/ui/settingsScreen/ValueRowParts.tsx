import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import {
  DETAIL_COLORS,
  SOUND_BARS,
  SPEED_MARKS,
  VALUE_ROW,
  VIBRATION,
  iconCenterOffsetOf,
  soundBarAt,
  speedMarkAt,
} from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'
import { SLT_FRAME, imageSrc } from '@/pages/settings/ui/settingsScreen/settingsAssets'

type Shift = { readonly dx: number; readonly dy: number }

/** 고른 값 줄 좌우 화살 — 깜빡일 때만 */
function ValueArrows({ top, dx, dy }: { readonly top: number } & Shift) {
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
        style={{ left: VALUE_ROW.leftArrow.x + dx, top: top + VALUE_ROW.leftArrow.dy + dy }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
        style={{ left: VALUE_ROW.rightArrow.x + dx, top: top + VALUE_ROW.rightArrow.dy + dy, transform: 'scaleX(-1)' }}
      />
    </>
  )
}

/** 소리 막대 — 아래 맞춤, 기준은 막대 높이 18 (밑변 Y + 53). 0 이면 "OFF" */
function SoundValue({ top, level }: { readonly top: number; readonly level: number }) {
  return (
    <>
      {Array.from({ length: level }, (_unused, k) => (
        <img
          key={k}
          className={styles.sprite}
          alt=""
          data-testid={`소리막대-${k}`}
          src={imageSrc(SLT_FRAME, SOUND_BARS.firstImage + k)}
          style={{ left: soundBarAt(k).x, top: top + soundBarAt(k).dy }}
        />
      ))}
      {level === 0 && (
        <div
          className={styles.vibrationLabel}
          style={{ left: VALUE_ROW.bar.x, top: top + VALUE_ROW.name.dy, width: VALUE_ROW.bar.width, color: DETAIL_COLORS.unselected }}
        >
          {SETTINGS_TEXT.vibrationOff}
        </div>
      )}
    </>
  )
}

/** 속도 꺾쇠 — 틈 없이 붙이고 막대 안 세로 가운데 */
function SpeedValue({ top, level }: { readonly top: number; readonly level: number }) {
  return Array.from({ length: level + 1 }, (_unused, k) => (
    <img
      key={k}
      className={styles.sprite}
      alt=""
      data-testid={`속도꺾쇠-${k}`}
      src={imageSrc(SLT_FRAME, SPEED_MARKS.firstImage + k)}
      style={{ left: speedMarkAt(k).x, top: top + speedMarkAt(k).dy }}
    />
  ))
}

/** 진동 OFF · ON — 지금 값이 흰색 */
function VibrationValue({ top, isOn }: { readonly top: number; readonly isOn: boolean }) {
  return (
    <>
      <div
        className={styles.vibrationLabel}
        style={{
          left: VIBRATION.off.x,
          top: top + VIBRATION.off.dy,
          width: VIBRATION.off.width,
          color: isOn ? DETAIL_COLORS.unselected : DETAIL_COLORS.selected,
        }}
      >
        {SETTINGS_TEXT.vibrationOff}
      </div>
      <div
        className={styles.vibrationLabel}
        style={{
          left: VIBRATION.on.x,
          top: top + VIBRATION.on.dy,
          width: VIBRATION.on.width,
          color: isOn ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
        }}
      >
        {SETTINGS_TEXT.vibrationOn}
      </div>
    </>
  )
}

interface ValueRowPartsProps {
  readonly index: number
  readonly name: string
  readonly top: number
  readonly icon: { readonly image: number; readonly width: number; readonly height: number }
  readonly settings: GameSettings
  readonly isBlinkOn: boolean
  readonly shift: Shift
}

/** 값 줄 0~2 — 이름 · 아이콘 받침 · 아이콘(제자리) · 화살 · 값 그림(제자리) */
export function ValueRowParts({ index, name, top, icon, settings, isBlinkOn, shift }: ValueRowPartsProps) {
  const { dx, dy } = shift
  return (
    <>
      <div className={styles.valueName} style={{ left: VALUE_ROW.name.x + dx, top: top + VALUE_ROW.name.dy + dy }}>
        {name}
      </div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, VALUE_ROW.iconBackImage)}
        style={{ left: VALUE_ROW.iconBack.x + dx, top: top + VALUE_ROW.iconBack.dy + dy }}
      />
      <img
        className={styles.sprite}
        alt=""
        data-testid={`설정아이콘-${index}`}
        src={imageSrc(SLT_FRAME, icon.image)}
        style={{
          left: VALUE_ROW.iconBack.x + iconCenterOffsetOf(icon).dx,
          top: top + VALUE_ROW.iconBack.dy + iconCenterOffsetOf(icon).dy,
        }}
      />
      {isBlinkOn && <ValueArrows top={top} dx={dx} dy={dy} />}
      {index === 0 && <SoundValue top={top} level={settings.soundLevel} />}
      {index === 1 && <SpeedValue top={top} level={settings.speedLevel} />}
      {index === 2 && <VibrationValue top={top} isOn={settings.isVibrationOn} />}
    </>
  )
}
