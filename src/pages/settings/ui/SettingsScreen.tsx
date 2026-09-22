import { useEffect, useState } from 'react'
import { FrameSprite, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { PITCH_CONTROLS, SOUND_LEVEL_COUNT, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import {
  DETAIL_CHOICES, DETAIL_COLORS, DETAIL_ROWS, DETAIL_ROW_COUNT, DETAIL_TITLE,
  FIRST_MENU_ROW, MENU_ROW, OK_BUTTON, PANEL, ROW_COUNT, ROW_ICONS,
  SOUND_BARS, SPEED_MARKS, TITLE, VALUE_ROW, VIBRATION,
  bottomAlignOffset, iconCenterOffsetOf, rowTopOf,
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

  // 상세 설정은 팝업이 아니라 **딴 페이지**다 (원본 장면 상태 0x20 · 페이지 32)
  if (isDetailOpen) {
    return <DetailSettings settings={settings} onChange={onChange} onBack={() => setDetailOpen(false)} />
  }

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
                  src={imageSrc(SLT_FRAME, ROW_ICONS[index].image)}
                  style={{
                    left: VALUE_ROW.iconBack.x + iconCenterOffsetOf(ROW_ICONS[index]).dx,
                    top: top + VALUE_ROW.iconBack.dy + iconCenterOffsetOf(ROW_ICONS[index]).dy,
                  }} />
                <div className={styles.valueName} style={{ left: VALUE_ROW.name.x, top: top + VALUE_ROW.name.dy }}>
                  {name}
                </div>
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
                  style={{ left: VALUE_ROW.leftArrow.x, top: top + VALUE_ROW.leftArrow.dy }} />
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, VALUE_ROW.arrowImage)}
                  style={{ left: VALUE_ROW.rightArrow.x, top: top + VALUE_ROW.rightArrow.dy, transform: 'scaleX(-1)' }} />
                {/*
                  소리 막대·속도 꺾쇠는 **아래 맞춤**이다 (P6 5절 확정).
                  그림이 position:absolute 라 `alignSelf:'end'` 는 아무 일도 하지 않았다 —
                  원본 식대로 `y + (h최대 − h)` 를 직접 더한다.
                */}
                {index === 0 && Array.from({ length: settings.soundLevel }, (_unused, k) => (
                  <img key={k} className={styles.sprite} alt=""
                    src={imageSrc(SLT_FRAME, SOUND_BARS.firstImage + k)}
                    style={{
                      left: SOUND_BARS.x + k * (SOUND_BARS.sizes[Math.min(k, SOUND_BARS.sizes.length - 1)].width + SOUND_BARS.gap),
                      top: top + SOUND_BARS.dy + bottomAlignOffset(SOUND_BARS.sizes, k),
                    }} />
                ))}
                {index === 1 && Array.from({ length: settings.speedLevel + 1 }, (_unused, k) => (
                  <img key={k} className={styles.sprite} alt=""
                    src={imageSrc(SLT_FRAME, SPEED_MARKS.firstImage + k)}
                    style={{
                      left: SPEED_MARKS.x + k * SPEED_MARKS.step,
                      top: top + SPEED_MARKS.dy + bottomAlignOffset(SPEED_MARKS.sizes, k),
                    }} />
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

/**
 * 상세 설정 값 넷을 0/1 로 읽는다 — 원본 값 배열 `[sp+0x190]` 순서 그대로
 * (옵션 +0x2d 투구 · +0xbd 주루 · +0xf4 송구 · +0x3a 전광판, P7 K2).
 * 값 0 이 앞 문구(기본 · 수동 · 수동 · OFF) 인 것은 라벨 표 `0xd1b04` 로 **확정**이다.
 */
function detailValuesOf(settings: GameSettings): readonly number[] {
  return [
    settings.pitchControl === '게이지' ? 1 : 0,
    settings.runningMode === '자동' ? 1 : 0,
    settings.throwMode === '자동' ? 1 : 0,
    settings.isScoreboardOn ? 1 : 0,
  ]
}

/** 칸 0~3 은 누르면 값이 뒤집힌다 (원본 갱신 0x288ac 의 `eor #1`) */
function toggleDetail(settings: GameSettings, row: number): GameSettings {
  if (row === 0) {
    const next = PITCH_CONTROLS[(PITCH_CONTROLS.indexOf(settings.pitchControl) + 1) % PITCH_CONTROLS.length]
    return { ...settings, pitchControl: next }
  }
  if (row === 1) return { ...settings, runningMode: settings.runningMode === '자동' ? '수동' : '자동' }
  if (row === 2) return { ...settings, throwMode: settings.throwMode === '자동' ? '수동' : '자동' }
  return { ...settings, isScoreboardOn: !settings.isScoreboardOn }
}

/**
 * 환경설정 → **상세 설정** (원본 장면 상태 0x20 · 페이지 32 — 그리기 4줄 루프, P7 K2 확정).
 *
 * 투구 · 주루 · 송구 · 전광판 네 줄이고, 줄마다 두 칸 중 지금 값이 흰색으로 나온다.
 * 다섯째 줄 "터치"(StrMAINMENU[73], 옵션 +0x14c)는 원본이 값만 읽고 그리지 않아 여기도 없다.
 *
 * ⚠️ 줄 y·두 칸 자리는 못 읽어 첫 화면 값 줄·진동 줄 자리를 빌려 썼다 — **근사**
 * (`settingsLayout.ts` 의 `DETAIL_*` 주석).
 * 웹판에 배선이 없는 값(송구·전광판)도 **원본에 줄이 있으므로 그대로 보여 주고 저장한다.**
 */
function DetailSettings({ settings, onChange, onBack }: {
  readonly settings: GameSettings
  readonly onChange: (settings: GameSettings) => void
  readonly onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const titleFrames = useFrameOrigins(IMG_TEXT)
  const values = detailValuesOf(settings)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const vertical = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (vertical !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + vertical + DETAIL_ROW_COUNT) % DETAIL_ROW_COUNT)
      }
      // OK 로 뒤집는 것은 원본 확정, 좌우도 같이 뒤집는 것은 첫 화면 값 줄을 따른 **추정**이다
      const isToggle = event.key === 'Enter' || event.key === ' '
        || event.key === 'ArrowLeft' || event.key === 'ArrowRight'
      if (isToggle) {
        event.preventDefault()
        return onChange(toggleDetail(settings, cursor))
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
      <FrameSprite folder={IMG_TEXT} frame={DETAIL_TITLE.frame} origins={titleFrames}
        x={DETAIL_TITLE.x} y={DETAIL_TITLE.y} />

      {DETAIL_ROWS.map((row, index) => {
        const top = rowTopOf(index)
        const icon = iconCenterOffsetOf(row.icon)
        return (
          <div key={row.name}>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, VALUE_ROW.bulletImage)}
              style={{ left: VALUE_ROW.bullet.x, top: top + VALUE_ROW.bullet.dy }} />
            <FrameSprite folder={`${SLT_FRAME}/frames`} frame={VALUE_ROW.barFrame}
              origins={frames} x={VALUE_ROW.bar.x} y={top + VALUE_ROW.bar.dy} />
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, VALUE_ROW.iconBackImage)}
              style={{ left: VALUE_ROW.iconBack.x, top: top + VALUE_ROW.iconBack.dy }} />
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, row.icon.image)}
              style={{ left: VALUE_ROW.iconBack.x + icon.dx, top: top + VALUE_ROW.iconBack.dy + icon.dy }} />
            <div className={styles.valueName} style={{ left: VALUE_ROW.name.x, top: top + VALUE_ROW.name.dy }}>
              {row.name}
            </div>

            {row.labels.map((label, choice) => (
              <div key={label} className={styles.vibrationLabel}
                style={{
                  left: DETAIL_CHOICES[choice].x,
                  top: top + DETAIL_CHOICES[choice].dy,
                  width: DETAIL_CHOICES[choice].width,
                  color: values[index] === choice ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
                }}>
                {label}
              </div>
            ))}

            {index === cursor && (
              <div className={styles.selectedOutline}
                style={{
                  left: VALUE_ROW.bar.x, top: top + VALUE_ROW.bar.dy,
                  width: VALUE_ROW.bar.width, height: VALUE_ROW.bar.height,
                }} />
            )}

            <button type="button" className={styles.row} aria-label={row.name}
              style={{
                left: VALUE_ROW.bar.x, top: top + VALUE_ROW.bar.dy,
                width: VALUE_ROW.bar.width, height: VALUE_ROW.bar.height,
              }}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { setCursor(index); onChange(toggleDetail(settings, index)) }} />
          </div>
        )
      })}

      <button type="button" className={styles.row} aria-label="확인"
        style={{ left: (PANEL.width - OK_BUTTON.width) / 2 + PANEL.x, top: OK_BUTTON.y, width: OK_BUTTON.width, height: OK_BUTTON.height }}
        onClick={onBack}>
        <img className={styles.sprite} alt="" src={imageSrc(POPUP, OK_BUTTON.frame)} style={{ left: 0, top: 0 }} />
      </button>
    </RawScreen>
  )
}
