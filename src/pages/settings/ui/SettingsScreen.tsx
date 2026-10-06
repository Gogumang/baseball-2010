import { useEffect, useState } from 'react'
import { FrameSprite, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PITCH_CONTROLS, SOUND_LEVEL_COUNT, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { VIBRATION_TOGGLE_MILLISECONDS, vibrate } from '@/entities/defense-controls/model/vibration'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import {
  DETAIL_CHOICES, DETAIL_COLORS, DETAIL_ROWS, DETAIL_ROW_COUNT, DETAIL_TITLE,
  FIRST_MENU_ROW, IN_GAME_PANEL, IN_GAME_ROW_COUNT, MENU_ROW, MODE_RESET_ROW, MODE_RESET_ROW_COUNT, MODE_RESET_TITLE,
  OK_BUTTON, OK_SELECTED_FRAME, OK_SELECTED_OVERFLOW, PANEL, ROW_COUNT, ROW_ICONS,
  SETTINGS_FRAME, SOUND_BARS, SPEED_MARKS, TITLE, VALUE_ROW, VIBRATION,
  bottomAlignOffset, iconCenterOffsetOf, isSelectedOutlineShown, modeResetRowTopOf, rowTopOf,
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
  /**
   * 에디트 초기화 `0x204c1` = 이름표 memset (모드 초기화 칸 2).
   * 메인 메뉴 환경설정(상태 8)만 넘긴다 — 경기 중 메뉴 "설정" 은 작은 판이라 모드 초기화 줄이 아예 없다
   * (`IN_GAME_PANEL`). 메인 메뉴에서 안 넘기면 칸 4 가 아무 일도 하지 않는다.
   */
  readonly onResetEditedNames?: () => void
  /**
   * 시즌모드 초기화 `0x224ed(mgr, 2)` (모드 초기화 칸 1). 웹 시즌 저장 지우기가 아직 없어 안 넘기면
   * 칸은 보이되 OK 가 아무 일도 하지 않는다 (⚠️ 미배선).
   */
  readonly onResetSeason?: () => void
  /**
   * 메인 메뉴 장면(0x103)의 환경설정일 때만 준다 — 상태 8·0x20·0x21 그리기(0x2dc90 · 0x2dc48 · 0x2dc00)가
   * 판 뒤에 머리띠 `0x54d95(skin, 0, 5, 0)`(제목 "2010프로야구" + G포인트 · 바닥 되돌아가기)를 그린다.
   * 경기 중 메뉴 그리기 0x3cdd0 은 0x593c8 종류 8 만 그리고 머리띠가 없어 안 준다.
   * **안 주면 경기 장면 안 "설정"** 이다 — 경기 장면이 세운 skin+0x125 로 작은 판(130)·세 줄·OK 칸이 된다
   * (`IN_GAME_PANEL`, 0x3301c · 0x5940c · 0x595d0).
   */
  readonly mainMenu?: { readonly gamePoint: number }
  readonly onBack: () => void
}

/**
 * 머리띠 — 들어올 때마다 미끄러져 내려온다: 상태 8 진입 0x259fc(앞 상태가 0x20~0x22 가 아닐 때) ·
 * 0x20 진입 0x2421c · 0x21 진입 0x242a4 가 skin+0x84 = 1 을 세운다. 하위 페이지에서 **돌아온** 첫 화면은
 * 0x259fc 가 커서만 (0, 3/4/5) 로 두고 0x84 를 안 세워(0x25a28~0x25a4e) 다 내려온 그대로다.
 */
function SettingsFrame({ mainMenu, onBack, slides = true }: {
  readonly mainMenu: { readonly gamePoint: number } | undefined
  readonly onBack: () => void
  readonly slides?: boolean
}) {
  if (mainMenu === undefined) return null
  return (
    <ScreenFrame title={SETTINGS_FRAME.title} gamePoint={mainMenu.gamePoint} footer={SETTINGS_FRAME.footer}
      onBack={onBack} slides={slides} />
  )
}

/**
 * 원작 메인 메뉴 [환경설정] — 공용 페이지 0x593c8 종류 8 (P6 5절 확정).
 *
 * 가운데 192×212 판에 줄 여섯이 25px 간격으로 놓인다:
 *   값 줄 0~2 = 사운드 · 속도 · 진동 (StrMAINMENU[63]~[65])
 *   메뉴 줄 3~5 = 상세 설정 · 모드 초기화 · 게임 데이터 관리 (…[66]~[68])
 *
 * 줄은 원본대로 보여 준다. 진동을 켜면 0x29684 처럼 100ms 흔든다(`navigator.vibrate` 가 있을 때만) — 경기 중 메뉴의
 * "설정" 도 이 화면이라 0x3cc20(같은 일)도 여기서 된다. 다만 경기 중은 **작은 판(130)에 값 줄 셋 + OK 칸**뿐이다
 * (`mainMenu` 없음 = skin+0x125, `IN_GAME_PANEL`) — 상세 설정·모드 초기화(에디트 초기화 포함)는 경기 중에 열 길이 없다.
 * 게임 데이터 관리(백업·복구)는 원본이 서버를 쓰므로 🌐 안내만 띄운다.
 * 상세 설정에는 웹이 실제로 쓰는 항목(투구 게이지)을 둔다.
 */
export function SettingsScreen({
  settings, hasSavedCareer, onChange, onResetCareer, onResetEditedNames, onResetSeason, mainMenu, onBack,
}: SettingsScreenProps) {
  const [cursor, setCursor] = useState(0)
  /** 하위 페이지(상세 설정·모드 초기화)에서 돌아왔는가 — 돌아온 첫 화면은 머리띠가 다시 미끄러지지 않는다 */
  const [hasReturned, setHasReturned] = useState(false)
  const isOutlineShown = isSelectedOutlineShown(useUpdateCounter())
  const [notice, setNotice] = useState<string | null>(null)
  const [isDetailOpen, setDetailOpen] = useState(false)
  const [isModeResetOpen, setModeResetOpen] = useState(false)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const titleFrames = useFrameOrigins(IMG_TEXT)

  /** 경기 장면 안 "설정"(skin+0x125 = 1) — 작은 판, 값 줄 셋만, OK 단추가 넷째 커서 칸 */
  const isInGame = mainMenu === undefined
  const panel = isInGame ? IN_GAME_PANEL : PANEL
  /** 판·제목·줄·OK 가 y0 를 따라 내려가는 만큼 */
  const panelDy = panel.y - PANEL.y
  const allNames = [
    SETTINGS_TEXT.sound, SETTINGS_TEXT.speed, SETTINGS_TEXT.vibration,
    SETTINGS_TEXT.detail, SETTINGS_TEXT.modeReset, SETTINGS_TEXT.dataManagement,
  ]
  const names = isInGame ? allNames.slice(0, IN_GAME_ROW_COUNT) : allNames
  /** 커서 칸 수 — 경기 중은 격자 1×4(0x3c3ac) 라 줄 셋 + OK. 메인 메뉴는 웹이 줄 여섯만 센다 */
  const cursorCount = isInGame ? IN_GAME_ROW_COUNT + 1 : ROW_COUNT
  /** 경기 중 OK 칸 — 고르면 popup 프레임 18, OK·좌우 모두 0x3cccc 로 경기 중 메뉴로 돌아간다 */
  const isOkSelected = isInGame && cursor === IN_GAME_ROW_COUNT

  const isBlocked = notice !== null || isDetailOpen || isModeResetOpen

  /** 값 줄에서 좌우 키가 값을 바꾼다 — 줄은 지금 커서(누른 줄을 넘기면 그 줄. 클릭은 커서 갱신 전에 부른다) */
  const changeValue = (step: number, row: number = cursor) => {
    if (row === 0) {
      return onChange({ ...settings, soundLevel: (settings.soundLevel + step + SOUND_LEVEL_COUNT) % SOUND_LEVEL_COUNT })
    }
    if (row === 1) {
      return onChange({ ...settings, speedLevel: (settings.speedLevel + step + SPEED_LEVEL_COUNT) % SPEED_LEVEL_COUNT })
    }
    if (row === 2) {
      // 0x2966c: 저장+0x3b ^= 1 → 켜졌으면 0x3a44(100) 미리 흔들기 (경기 중 메뉴 0x3cc0c 도 같다)
      const isVibrationOn = !settings.isVibrationOn
      onChange({ ...settings, isVibrationOn })
      vibrate(VIBRATION_TOGGLE_MILLISECONDS, isVibrationOn)
    }
  }

  const openRow = (index: number) => {
    if (isInGame && index === IN_GAME_ROW_COUNT) return onBack()
    if (index < FIRST_MENU_ROW) return changeValue(1, index)
    if (index === 3) return setDetailOpen(true)
    // 칸 4 → 상태 0x21 (0x295d0 `0xbcb49(…, 0x21)`) — 조건 없이 들어간다
    if (index === 4) return onResetEditedNames === undefined ? undefined : setModeResetOpen(true)
    setNotice(SETTINGS_TEXT.dataManagementBlocked)
  }

  useEffect(() => {
    if (isBlocked) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const vertical = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (vertical !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + vertical + cursorCount) % cursorCount)
      }
      const horizontal = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (horizontal !== 0 && cursor < FIRST_MENU_ROW) {
        event.preventDefault()
        return changeValue(horizontal)
      }
      // 경기 중 OK 칸의 좌우도 0x3cba4 → 칸 3 갈래 0x3cccc (돌아가기)
      if (horizontal !== 0 && isOkSelected) {
        event.preventDefault()
        return onBack()
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
    return (
      <DetailSettings settings={settings} onChange={onChange} mainMenu={mainMenu}
        onBack={() => { setHasReturned(true); setDetailOpen(false) }} />
    )
  }
  // 모드 초기화도 딴 페이지다 (장면 상태 0x21 · 페이지 33, 갱신 0x2c6d8 · 그리기 0x2dc00)
  if (isModeResetOpen && onResetEditedNames !== undefined) {
    return (
      <ModeResetPage
        hasSavedCareer={hasSavedCareer}
        onResetCareer={onResetCareer}
        onResetEditedNames={onResetEditedNames}
        {...(onResetSeason === undefined ? {} : { onResetSeason })}
        mainMenu={mainMenu}
        onBack={() => { setHasReturned(true); setModeResetOpen(false) }}
      />
    )
  }

  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}
      />
      <FrameSprite folder={IMG_TEXT} frame={TITLE.frame} origins={titleFrames} x={TITLE.x} y={TITLE.y + panelDy} />

      {names.map((name, index) => {
        const top = rowTopOf(index) + panelDy
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

            {index === cursor && isOutlineShown && (
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
        style={{ left: (PANEL.width - OK_BUTTON.width) / 2 + PANEL.x, top: OK_BUTTON.y + panelDy, width: OK_BUTTON.width, height: OK_BUTTON.height }}
        onMouseEnter={isInGame ? () => setCursor(IN_GAME_ROW_COUNT) : undefined}
        onClick={onBack}>
        <img className={styles.sprite} alt=""
          src={imageSrc(POPUP, isOkSelected ? OK_SELECTED_FRAME : OK_BUTTON.frame)}
          style={isOkSelected ? { left: -OK_SELECTED_OVERFLOW, top: -OK_SELECTED_OVERFLOW } : { left: 0, top: 0 }} />
      </button>

      <SettingsFrame mainMenu={mainMenu} onBack={onBack} slides={!hasReturned} />

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
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
function DetailSettings({ settings, onChange, mainMenu, onBack }: {
  readonly settings: GameSettings
  readonly onChange: (settings: GameSettings) => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  readonly onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const isOutlineShown = isSelectedOutlineShown(useUpdateCounter())
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

            {index === cursor && isOutlineShown && (
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
      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />
    </RawScreen>
  )
}

type ModeResetPopup = '나리확인' | '시즌확인' | '에디트확인' | '완료'

/**
 * 세 확인 창의 처음 커서 — 띄운 바로 뒤 `0x749d5(창, 1)` 로 둘째 칸 **"아니오"** 에 둔다
 * (나리 [210]/[211] 0x2c930 · 시즌 0xcf870 0x2c7fa · 에디트 0xcf8d4 0x2c81c).
 */
const CONFIRM_FIRST_CURSOR = 1

const MODE_RESET_NAMES = [SETTINGS_TEXT.careerReset, SETTINGS_TEXT.seasonReset, SETTINGS_TEXT.editReset] as const

/**
 * 환경설정 → **모드 초기화** (메인 메뉴 상태 0x21 — 갱신 0x2c6d8 · 그리기 0x2dc00 → 0x593c8 종류 0x21 · 0x5a316 직접 읽음).
 *
 * 하위 상태 [this+0x18] (점프표 0xcece0):
 * ```
 * 하위 0 목록    CLR(−16) → 0xbcb49(…, 8) 환경설정 첫 화면 · OK(−5) → 칸별
 *   칸 0 [82] 나만의리그  → 고르기 창 0xcf848 "초기화할 데이터를 선택하세요"(종류 0x10) → 하위 1
 *                          → 편별 확인 [210]/[211] (종류 2) + 0x749d5(창, 1) (0x2c928 · 0x2c930)
 *   칸 1 [83] 시즌모드    → 확인 0xcf870 (종류 2) + 0x749d5(창, 1) → 하위 3
 *   칸 2 [84] 에디트      → 확인 0xcf8d4 (종류 2) + 0x749d5(창, 1) → 하위 4
 * 하위 3 답 0(예) → 하위 0 · 0x224ed(mgr, 2) · 알림 0xcf900 "초기화 되었습니다" / 답 1·−1 → 하위 0
 * 하위 4 답 0(예) → 하위 0 · 0x204c1(mgr) = memset(이름표, 0, 0x708) · 알림 0xcf900 / 답 1·−1 → 하위 0
 * ```
 * 파일 저장은 이 상태에 없다 — 환경설정 첫 화면을 CLR·OK 로 나갈 때 0x295e2 가 0x1f1b9 로 저장한다.
 * 웹 이름표 고리(`useEditedNames.clear`)는 비우는 즉시 저장한다(웹 환경설정 값들도 바꾸는 즉시 저장한다) —
 * 창을 닫아 버리는 경우만 다르다.
 *
 * ⚠️ 근사·미해결:
 *  - 칸 0 나만의리그: 원본은 고르기 창(타자편/투수편 두 칸, 0x74ea9 로 채움)을 먼저 띄우고, 편별로
 *    시즌 중 막기 [212] → 확인 [210]/[211] → 0x224ed(4 타자 / 3 투수) 다(R11 3-1). 웹은 투수편 지우기·
 *    시즌 중 막기 배선이 다른 작업 구역(app/model)이라 **예전처럼 타자편 저장이 있을 때만 [210] 확인**으로 둔다.
 *  - 칸 1 시즌모드: 웹에 시즌 저장 지우기(0x224ed(2))가 없어 `onResetSeason` 을 안 받으면 OK 가 아무 일도 안 한다.
 */
function ModeResetPage({ hasSavedCareer, onResetCareer, onResetEditedNames, onResetSeason, mainMenu, onBack }: {
  readonly hasSavedCareer: boolean
  readonly onResetCareer: () => void
  readonly onResetEditedNames: () => void
  readonly onResetSeason?: () => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  readonly onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const isOutlineShown = isSelectedOutlineShown(useUpdateCounter())
  const [popup, setPopup] = useState<ModeResetPopup | null>(null)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const titleFrames = useFrameOrigins(IMG_TEXT)

  const openRow = (index: number) => {
    if (index === 0) return hasSavedCareer ? setPopup('나리확인') : undefined
    if (index === 1) return onResetSeason === undefined ? undefined : setPopup('시즌확인')
    setPopup('에디트확인')
  }

  /** 확인 창 답 — 예(0)면 지우고 0xcf900 알림, 아니오는 하위 0 으로 */
  const answerConfirm = (reset: () => void) => (answer: number) => {
    if (answer !== 0) return setPopup(null)
    reset()
    setPopup('완료')
  }

  useEffect(() => {
    if (popup !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const vertical = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (vertical !== 0) {
        event.preventDefault()
        return setCursor((previous) => (previous + vertical + MODE_RESET_ROW_COUNT) % MODE_RESET_ROW_COUNT)
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

  const { bar, bullet, name: nameBox } = MODE_RESET_ROW
  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{ left: PANEL.x, top: PANEL.y, width: PANEL.width, height: PANEL.height }}
      />
      <FrameSprite folder={IMG_TEXT} frame={MODE_RESET_TITLE.frame} origins={titleFrames}
        x={MODE_RESET_TITLE.x} y={MODE_RESET_TITLE.y} />

      {MODE_RESET_NAMES.map((name, index) => {
        const top = modeResetRowTopOf(index)
        const isSelected = index === cursor
        return (
          <div key={name}>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, isSelected ? MODE_RESET_ROW.selectedBulletImage : MODE_RESET_ROW.bulletImage)}
              style={{ left: bullet.x, top: top + bullet.dy }} />
            <FrameSprite folder={`${SLT_FRAME}/frames`} frame={MODE_RESET_ROW.barFrame}
              origins={frames} x={bar.x} y={top + bar.dy} />
            <div className={styles.menuName}
              style={{
                left: nameBox.x, top: top + nameBox.dy, width: nameBox.width,
                color: isSelected ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
              }}>
              {name}
            </div>
            {isSelected && isOutlineShown && (
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

      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />

      {popup === '나리확인' && (
        <MessageBox text={SETTINGS_TEXT.careerResetConfirm} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(onResetCareer)} />
      )}
      {popup === '시즌확인' && onResetSeason !== undefined && (
        <MessageBox text={SETTINGS_TEXT.seasonResetConfirm} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(onResetSeason)} />
      )}
      {popup === '에디트확인' && (
        <MessageBox text={SETTINGS_TEXT.editResetConfirm} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(onResetEditedNames)} />
      )}
      {popup === '완료' && (
        <MessageBox text={SETTINGS_TEXT.resetDone} buttons={['확인']} onAnswer={() => setPopup(null)} />
      )}
    </RawScreen>
  )
}
