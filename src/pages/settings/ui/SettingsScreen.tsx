import { useEffect, useState } from 'react'
import { FrameSprite, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { PITCH_CONTROLS, SOUND_LEVEL_COUNT, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import {
  FIRST_MENU_ROW, MENU_ROW, OK_BUTTON, PANEL, ROW_COUNT, ROW_ICON_IMAGES,
  SOUND_BARS, SPEED_MARKS, TITLE, VALUE_ROW, VIBRATION, rowTopOf,
} from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'

const SLT_FRAME = './sprites/slt_frame'
const IMG_TEXT = './sprites/img_text/frames'
const POPUP = './sprites/popup/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface SettingsScreenProps {
  readonly settings: GameSettings
  readonly hasSavedCareer: boolean
  readonly onChange: (settings: GameSettings) => void
  readonly onResetCareer: () => void
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [환경설정] — 공용 페이지 0x593c8 종류 8 (P6 5절 확정).
 *
 * 가운데 192×212 판에 줄 여섯이 25px 간격으로 놓인다:
 *   값 줄 0~2 = 사운드 · 속도 · 진동 (StrMAINMENU[63]~[65])
 *   메뉴 줄 3~5 = 상세 설정 · 모드 초기화 · 게임 데이터 관리 (…[66]~[68])
 *
 * 웹에는 소리·진동이 없어 값만 들고 있지만 **줄은 원본대로 보여 준다.**
 * 게임 데이터 관리(백업·복구)는 원본이 서버를 쓰므로 🌐 안내만 띄운다.
 * 상세 설정에는 웹이 실제로 쓰는 항목(투구 게이지)을 둔다.
 */
export function SettingsScreen({ settings, hasSavedCareer, onChange, onResetCareer, onBack }: SettingsScreenProps) {
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  const [isDetailOpen, setDetailOpen] = useState(false)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const titleFrames = useFrameOrigins(IMG_TEXT)

  const names = [
    SETTINGS_TEXT.sound, SETTINGS_TEXT.speed, SETTINGS_TEXT.vibration,
    SETTINGS_TEXT.detail, SETTINGS_TEXT.modeReset, SETTINGS_TEXT.dataManagement,
  ]

  const isBlocked = notice !== null || isConfirmingReset || isDetailOpen

  /** 값 줄에서 좌우 키가 값을 바꾼다 */
  const changeValue = (step: number) => {
    if (cursor === 0) {
      return onChange({ ...settings, soundLevel: (settings.soundLevel + step + SOUND_LEVEL_COUNT) % SOUND_LEVEL_COUNT })
    }
    if (cursor === 1) {
      return onChange({ ...settings, speedLevel: (settings.speedLevel + step + SPEED_LEVEL_COUNT) % SPEED_LEVEL_COUNT })
    }
    if (cursor === 2) onChange({ ...settings, isVibrationOn: !settings.isVibrationOn })
  }

  const openRow = (index: number) => {
    if (index < FIRST_MENU_ROW) return changeValue(1)
    if (index === 3) return setDetailOpen(true)
    if (index === 4) return hasSavedCareer ? setIsConfirmingReset(true) : undefined
    setNotice(SETTINGS_TEXT.dataManagementBlocked)
  }

  useEffect(() => {
    if (isBlocked) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const vertical = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (vertical !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + vertical + ROW_COUNT) % ROW_COUNT)
      }
      const horizontal = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (horizontal !== 0 && cursor < FIRST_MENU_ROW) {
        event.preventDefault()
        return changeValue(horizontal)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return openRow(cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{ left: PANEL.x, top: PANEL.y, width: PANEL.width, height: PANEL.height }}
      />
      <FrameSprite folder={IMG_TEXT} frame={TITLE.frame} origins={titleFrames} x={TITLE.x} y={TITLE.y} />

      {names.map((name, index) => {
        const top = rowTopOf(index)
        const isValueRow = index < FIRST_MENU_ROW
        const bar = isValueRow ? VALUE_ROW.bar : MENU_ROW.bar
        const bullet = isValueRow ? VALUE_ROW : MENU_ROW
        return (
          <div key={name}>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, bullet.bulletImage)}
              style={{ left: bullet.bullet.x, top: top + bullet.bullet.dy }} />
            <FrameSprite folder={`${SLT_FRAME}/frames`} frame={isValueRow ? VALUE_ROW.barFrame : MENU_ROW.barFrame}
              origins={frames} x={bar.x} y={top + bar.dy} />

            {isValueRow ? (
              <>
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, VALUE_ROW.iconBackImage)}
                  style={{ left: VALUE_ROW.iconBack.x, top: top + VALUE_ROW.iconBack.dy }} />
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, [ROW_ICON_IMAGES.sound, ROW_ICON_IMAGES.speed, ROW_ICON_IMAGES.vibration][index])}
                  style={{ left: VALUE_ROW.iconBack.x + 3, top: top + VALUE_ROW.iconBack.dy + 3 }} />
                <div className={styles.valueName} style={{ left: VALUE_ROW.name.x, top: top + VALUE_ROW.name.dy }}>
                  {name}
                </div>
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
                  style={{ left: VALUE_ROW.leftArrow.x, top: top + VALUE_ROW.leftArrow.dy }} />
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
                  style={{ left: VALUE_ROW.rightArrow.x, top: top + VALUE_ROW.rightArrow.dy, transform: 'scaleX(-1)' }} />
                {index === 0 && Array.from({ length: settings.soundLevel }, (_unused, k) => (
                  <img key={k} className={styles.sprite} alt=""
                    src={imageSrc(SLT_FRAME, SOUND_BARS.firstImage + k)}
                    style={{ left: SOUND_BARS.x + k * (12 + SOUND_BARS.gap), top: top + SOUND_BARS.dy, alignSelf: 'end' }} />
                ))}
                {index === 1 && Array.from({ length: settings.speedLevel + 1 }, (_unused, k) => (
                  <img key={k} className={styles.sprite} alt=""
                    src={imageSrc(SLT_FRAME, SPEED_MARKS.firstImage + k)}
                    style={{ left: SPEED_MARKS.x + k * 12, top: top + SPEED_MARKS.dy }} />
                ))}
                {index === 2 && (
                  <>
                    <div className={styles.vibrationHighlight}
                      style={{
                        left: (settings.isVibrationOn ? VIBRATION.on : VIBRATION.off).x,
                        top: top + VIBRATION.highlight.dy,
                        width: VIBRATION.highlight.width,
                        height: VIBRATION.highlight.height,
                      }} />
                    <div className={styles.vibrationLabel}
                      style={{ left: VIBRATION.off.x, top: top + VIBRATION.off.dy, width: VIBRATION.off.width, color: settings.isVibrationOn ? '#FFFFFF' : '#000000' }}>
                      {SETTINGS_TEXT.vibrationOff}
                    </div>
                    <div className={styles.vibrationLabel}
                      style={{ left: VIBRATION.on.x, top: top + VIBRATION.on.dy, width: VIBRATION.on.width, color: settings.isVibrationOn ? '#000000' : '#FFFFFF' }}>
                      {SETTINGS_TEXT.vibrationOn}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.menuName} style={{ left: MENU_ROW.name.x, top: top + MENU_ROW.name.dy, width: MENU_ROW.name.width }}>
                {name}
              </div>
            )}

            {index === cursor && (
              <div className={styles.selectedOutline}
                style={{ left: bar.x, top: top + bar.dy, width: bar.width, height: bar.height }} />
            )}

            <button type="button" className={styles.row} aria-label={name}
              style={{ left: bar.x, top: top + bar.dy, width: bar.width, height: bar.height }}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { setCursor(index); openRow(index) }} />
          </div>
        )
      })}

      <button type="button" className={styles.row} aria-label="확인"
        style={{ left: (PANEL.width - OK_BUTTON.width) / 2 + PANEL.x, top: OK_BUTTON.y, width: OK_BUTTON.width, height: OK_BUTTON.height }}
        onClick={onBack}>
        <img className={styles.sprite} alt="" src={imageSrc(POPUP, OK_BUTTON.frame)} style={{ left: 0, top: 0 }} />
      </button>

      {isDetailOpen && (
        <MessageBox
          text={`!C투구 : !cFFFF00${settings.pitchControl}`}
          buttons={['바꾸기', '닫기']}
          onAnswer={(index) => {
            if (index === 0) {
              const next = PITCH_CONTROLS[(PITCH_CONTROLS.indexOf(settings.pitchControl) + 1) % PITCH_CONTROLS.length]
              onChange({ ...settings, pitchControl: next })
            }
            setDetailOpen(false)
          }}
        />
      )}
      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      {isConfirmingReset && (
        <MessageBox
          text={SETTINGS_TEXT.careerResetConfirm}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onResetCareer()
            setIsConfirmingReset(false)
          }}
        />
      )}
    </RawScreen>
  )
}
