import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FrameSprite, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PITCH_CONTROLS, SOUND_LEVEL_COUNT, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { VIBRATION_TOGGLE_MILLISECONDS, vibrate } from '@/entities/defense-controls/model/vibration'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import { MODE_RESET_TEXT } from '@/entities/settings/model/modeReset'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'
import {
  DETAIL_CHOICES, DETAIL_COLORS, DETAIL_ROW, DETAIL_ROWS, DETAIL_ROW_COUNT, DETAIL_TITLE, detailRowTopOf,
  detailValueOutlineOf,
  FIRST_MENU_ROW, IN_GAME_PANEL, IN_GAME_ROW_COUNT, MENU_ROW, MODE_RESET_ROW, MODE_RESET_ROW_COUNT, MODE_RESET_TITLE,
  OK_BUTTON, OK_SELECTED_FRAME, OK_SELECTED_OVERFLOW, PANEL, ROW_ICONS,
  SETTINGS_FRAME, SOUND_BARS, SPEED_MARKS, TITLE, VALUE_ROW, VIBRATION,
  MAIN_MENU_CURSOR_COUNT, SCREEN,
  bottomAlignOffset, closingFold, iconCenterOffsetOf, isSelectedOutlineShown, modeResetRowTopOf, nextPanelFold,
  openingFold, panelClipOf, rowTopOf,
} from '@/pages/settings/lib/settingsLayout'
import type { PanelFold } from '@/pages/settings/lib/settingsLayout'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'

const SLT_FRAME = './sprites/slt_frame'
const IMG_TEXT = './sprites/img_text/frames'
const POPUP = './sprites/popup/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface SettingsScreenProps {
  readonly settings: GameSettings
  /**
   * ⚠️ 이제 안 읽는다 — 원본 모드 초기화 나리 칸(0x2c746)은 저장 유무를 안 보고 늘 고르기 창을 띄운다. 경기 중 "설정" 들이
   * 아직 넘기므로 칸만 남긴다.
   */
  readonly hasSavedCareer: boolean
  readonly onChange: (settings: GameSettings) => void
  /**
   * 나만의리그 초기화 — 고르기 창 답 0 타자편 → `0x224ec(mgr, 4)` · 1 투수편 → `0x224ec(mgr, 3)` (하위 2 의 예).
   * 받는 쪽이 그 편 저장·경기 중간 저장 표시를 지우고 시즌 내 팀에서 그 편 나리 선수를 뺀다(0x223a8).
   */
  readonly onResetCareer: (edition: CareerResetEdition) => void
  /**
   * 하위 1 의 시즌 중 막기 — `0xb5054(내 시즌 팀, 편) && 전역기록 +0x4e` 면 띄울 글(타자편 [212] · 투수편 [213]), 통과면 null.
   * 안 넘기면 늘 통과(경기 중 "설정" — 모드 초기화 줄이 없다).
   */
  readonly careerResetBlockOf?: (edition: CareerResetEdition) => string | null
  /**
   * 에디트 초기화 `0x204c1` = 이름표 memset (모드 초기화 칸 2).
   * 메인 메뉴 환경설정(상태 8)만 넘긴다 — 경기 중 메뉴 "설정" 은 작은 판이라 모드 초기화 줄이 아예 없다
   * (`IN_GAME_PANEL`). 메인 메뉴에서 안 넘기면 칸 4 가 아무 일도 하지 않는다.
   */
  readonly onResetEditedNames?: () => void
  /**
   * 시즌모드 초기화 `0x224ec(mgr, 2)` (모드 초기화 칸 1) — 시즌 저장·경기 중간 저장(+0x4e)을 지운다.
   * 안 넘기면 칸은 보이되 OK 가 아무 일도 하지 않는다.
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
  settings, onChange, onResetCareer, careerResetBlockOf, onResetEditedNames, onResetSeason, mainMenu, onBack,
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
  /**
   * 커서 칸 수 — 줄 다음 칸이 OK 단추다. 경기 중은 격자 1×4(0x3c3ac) 라 줄 셋 + OK,
   * 메인 메뉴는 격자 1×7(0x259fc) 이라 줄 여섯 + OK.
   */
  const cursorCount = isInGame ? IN_GAME_ROW_COUNT + 1 : MAIN_MENU_CURSOR_COUNT
  /** OK 칸 번호 (격자 마지막 칸) */
  const okCell = names.length
  /** OK 칸이 고른 칸이면 popup 프레임 18 (0x59de2~0x59e4e) */
  const isOkSelected = cursor === okCell

  /**
   * 판 펼침·접힘 (`nextPanelFold`) — 처음 들어오면 0x20 부터 펼친다. 하위 페이지에서 돌아온 첫 화면은 그 페이지가
   * 이미 다 편 판 그대로다(0x259fc 가 앞 상태 0x20~0x22 면 플래그를 안 건드린다) — 이 화면은 하위 페이지 동안에도
   * 그대로 서 있어 다 편 상태를 들고 있다.
   */
  const [fold, setFold] = useState<PanelFold>(openingFold)
  const foldRef = useRef(fold)
  foldRef.current = fold
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const isFolding = !fold.isDone
  useEffect(() => {
    if (!isFolding) return undefined
    const timer = window.setInterval(() => {
      const next = nextPanelFold(foldRef.current, panel.height)
      // 접힘이 끝나면 갱신 끝 0x29688 이 상태 4 로 — 10 높이 판은 그려지지 않는다
      if (!next.isOpening && next.isDone) {
        window.clearInterval(timer)
        foldRef.current = next
        return onBackRef.current()
      }
      foldRef.current = next
      setFold(next)
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [isFolding, panel.height])

  /**
   * 첫 화면을 나간다 — 메인 메뉴는 OK 칸·CLR 모두 0x295e2(저장 0x1f1b9 → 접힘 → 상태 4).
   * 경기 중은 0x3cccc 가 목록을 닫는다(접힘 여부는 안 읽었다 — 곧바로 돌아간다).
   */
  const leave = () => {
    if (isInGame) return onBack()
    setFold(closingFold(foldRef.current))
  }

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
    if (index === okCell) return leave()
    if (index < FIRST_MENU_ROW) return changeValue(1, index)
    // 하위 페이지 진입 0x2421c(0x20) · 0x242a4(0x21) 도 판을 높이 0x20 · 걸음 1 · 끝 0 · 펼침 1 로 다시 세운다
    // (skin+0x90 · +0x94 · +0x98 · +0x99, 0x24262~0x24274 · 0x242ea~0x242fc) — 공용 페이지 0x593c8 이 그대로 편다
    if (index === 3) {
      setFold(openingFold())
      return setDetailOpen(true)
    }
    // 칸 4 → 상태 0x21 (0x295d0 `0xbcb49(…, 0x21)`) — 조건 없이 들어간다
    if (index === 4) {
      if (onResetEditedNames === undefined) return undefined
      setFold(openingFold())
      return setModeResetOpen(true)
    }
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
      // 경기 중 OK 칸의 좌우도 0x3cba4 → 칸 3 갈래 0x3cccc (돌아가기). 메인 메뉴 OK 칸의 좌우는 아무 일도 없다
      // (0x29604/0x2960a 는 칸 0~2 만 본다)
      if (horizontal !== 0 && isOkSelected && isInGame) {
        event.preventDefault()
        return onBack()
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return openRow(cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        leave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // 상세 설정은 팝업이 아니라 **딴 페이지**다 (원본 장면 상태 0x20 · 페이지 32)
  if (isDetailOpen) {
    return (
      <DetailSettings settings={settings} onChange={onChange} mainMenu={mainMenu} panelHeight={Math.min(fold.height, PANEL.height)}
        onBack={() => { setHasReturned(true); setDetailOpen(false) }} />
    )
  }
  // 모드 초기화도 딴 페이지다 (장면 상태 0x21 · 페이지 33, 갱신 0x2c6d8 · 그리기 0x2dc00)
  if (isModeResetOpen && onResetEditedNames !== undefined) {
    return (
      <ModeResetPage
        onResetCareer={onResetCareer}
        {...(careerResetBlockOf === undefined ? {} : { careerResetBlockOf })}
        onResetEditedNames={onResetEditedNames}
        {...(onResetSeason === undefined ? {} : { onResetSeason })}
        mainMenu={mainMenu}
        panelHeight={Math.min(fold.height, PANEL.height)}
        onBack={() => { setHasReturned(true); setModeResetOpen(false) }}
      />
    )
  }

  /** 이번에 그리는 판 높이 — 판은 화면 가운데를 기준으로 위아래로 펴진다 (0x55e60 정렬 0x22) */
  const drawnHeight = Math.min(fold.height, panel.height)
  const isUnfolded = drawnHeight >= panel.height
  const clip = panelClipOf(drawnHeight, panel.height)

  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{
          left: panel.x, top: SCREEN.height / 2 - Math.trunc(drawnHeight / 2), width: panel.width, height: drawnHeight,
        }}
      />
      <PanelClip x={panel.x} y={clip.y} width={panel.width} height={clip.height}>
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

            {/* 펴는 동안은 테두리를 끈다 (0x59548) */}
            {index === cursor && isOutlineShown && isUnfolded && (
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
        onMouseEnter={() => setCursor(okCell)}
        onClick={() => { setCursor(okCell); leave() }}>
        <img className={styles.sprite} alt=""
          src={imageSrc(POPUP, isOkSelected ? OK_SELECTED_FRAME : OK_BUTTON.frame)}
          style={isOkSelected ? { left: -OK_SELECTED_OVERFLOW, top: -OK_SELECTED_OVERFLOW } : { left: 0, top: 0 }} />
      </button>
      </PanelClip>

      {/* 머리띠 되돌아가기 = CLR (0x295e2) */}
      <SettingsFrame mainMenu={mainMenu} onBack={leave} slides={!hasReturned} />

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}

/** 판 (24, H/2 − h/2, 192, h) — 화면 가운데를 기준으로 위아래로 펴진다 (0x55e60 정렬 0x22). 하위 페이지 0x20 · 0x21 용 */
function UnfoldingPanel({ height }: { readonly height: number }) {
  return (
    <div className={styles.panel}
      style={{ left: PANEL.x, top: SCREEN.height / 2 - Math.trunc(height / 2), width: PANEL.width, height }} />
  )
}

/**
 * 잘라내기 0xbae25 사각형 — 안의 그림은 화면 좌표 그대로 두고 바깥만 가린다.
 */
function PanelClip({ x, y, width, height, children }: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly children: ReactNode
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width, height: Math.max(0, height), overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -x, top: -y, width: SCREEN.width, height: SCREEN.height }}>
        {children}
      </div>
    </div>
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
 * 배치는 그리기 0x59e82~0x5a2f4 를 직접 뜬 값이다 (`settingsLayout.ts` 의 `DETAIL_*` 주석) — 아래 OK 단추는 없다.
 * 웹판에 배선이 없는 값(송구·전광판)도 **원본에 줄이 있으므로 그대로 보여 주고 저장한다.**
 */
function DetailSettings({ settings, onChange, mainMenu, panelHeight, onBack }: {
  readonly settings: GameSettings
  readonly onChange: (settings: GameSettings) => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  /** 이번에 그리는 판 높이 — 첫 화면이 들고 있는 펼침(`nextPanelFold`) */
  readonly panelHeight: number
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
      // 갱신 0x288ac 가 OK(−5) · 좌우(−3 · −4) · '4'(0x34) · '6'(0x36) 을 모두 같은 갈래 0x28920(칸 값 ^= 1)으로 보낸다 — 확정.
      // CLR(−16)은 판·키 상태와 상관없이 곧바로 상태 8 (0xbcb49(…, 8)) — 펴는 도중에도 키를 받는다
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

  const isUnfolded = panelHeight >= PANEL.height
  const clip = panelClipOf(panelHeight, PANEL.height)
  return (
    <RawScreen>
      <UnfoldingPanel height={panelHeight} />
      <PanelClip x={PANEL.x} y={clip.y} width={PANEL.width} height={clip.height}>
      <FrameSprite folder={IMG_TEXT} frame={DETAIL_TITLE.frame} origins={titleFrames}
        x={DETAIL_TITLE.x} y={DETAIL_TITLE.y} />

      {DETAIL_ROWS.map((row, index) => {
        const top = detailRowTopOf(index)
        const icon = iconCenterOffsetOf(row.icon)
        const isSelected = index === cursor
        // 화살·흰 테두리는 깜빡일 때만([sp+0x9c]) — 펴는 동안은 0x59548 이 끈다
        const isBlinkOn = isSelected && isOutlineShown && isUnfolded
        const valueOutline = detailValueOutlineOf(values[index])
        return (
          <div key={row.name}>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, isSelected ? DETAIL_ROW.selectedBulletImage : DETAIL_ROW.bulletImage)}
              style={{ left: DETAIL_ROW.bullet.x, top: top + DETAIL_ROW.bullet.dy }} />
            <div className={styles.valueName} style={{ left: DETAIL_ROW.name.x, top: top + DETAIL_ROW.name.dy }}>
              {row.name}
            </div>
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, DETAIL_ROW.iconBackImage)}
              style={{ left: DETAIL_ROW.iconBack.x, top: top + DETAIL_ROW.iconBack.dy }} />
            <img className={styles.sprite} alt=""
              src={imageSrc(SLT_FRAME, row.icon.image)}
              style={{ left: DETAIL_ROW.iconBack.x + icon.dx, top: top + DETAIL_ROW.iconBack.dy + icon.dy }} />
            <FrameSprite folder={`${SLT_FRAME}/frames`} frame={DETAIL_ROW.barFrame}
              origins={frames} x={DETAIL_ROW.bar.x} y={top + DETAIL_ROW.bar.dy} />

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

            {isBlinkOn && (
              <>
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, DETAIL_ROW.arrowImage)}
                  style={{ left: DETAIL_ROW.leftArrow.x, top: top + DETAIL_ROW.leftArrow.dy }} />
                <img className={styles.sprite} alt=""
                  src={imageSrc(SLT_FRAME, DETAIL_ROW.arrowImage)}
                  style={{ left: DETAIL_ROW.rightArrow.x, top: top + DETAIL_ROW.rightArrow.dy, transform: 'scaleX(-1)' }} />
                <div className={styles.selectedOutline}
                  style={{
                    left: DETAIL_ROW.outline.x, top: top + DETAIL_ROW.outline.dy,
                    width: DETAIL_ROW.outline.width, height: DETAIL_ROW.outline.height,
                  }} />
              </>
            )}

            {/* 줄 루프 뒤 지금 값 칸 노랑 테두리 (0x5a226~) — 줄마다 늘 */}
            <div className={styles.valueOutline} data-testid={`상세값테두리-${index}`}
              style={{ left: valueOutline.x, top: top + valueOutline.dy, width: valueOutline.width, height: valueOutline.height }} />

            <button type="button" className={styles.row} aria-label={row.name}
              style={{
                left: DETAIL_ROW.outline.x, top: top + DETAIL_ROW.outline.dy,
                width: DETAIL_ROW.outline.width, height: DETAIL_ROW.outline.height,
              }}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { setCursor(index); onChange(toggleDetail(settings, index)) }} />
          </div>
        )
      })}
      {/* 이 페이지에는 아래 OK 단추가 없다 — 나가는 길은 CLR(머리띠 되돌아가기)뿐이다 */}
      </PanelClip>
      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />
    </RawScreen>
  )
}

type ModeResetPopup =
  | { readonly kind: '나리고르기' }
  | { readonly kind: '나리막힘'; readonly text: string }
  | { readonly kind: '나리확인'; readonly edition: CareerResetEdition }
  | { readonly kind: '시즌확인' }
  | { readonly kind: '에디트확인' }
  | { readonly kind: '완료' }

/**
 * 세 확인 창의 처음 커서 — 띄운 바로 뒤 `0x749d5(창, 1)` 로 둘째 칸 **"아니오"** 에 둔다
 * (나리 [210]/[211] 0x2c930 · 시즌 0xcf870 0x2c7fa · 에디트 0xcf8d4 0x2c81c).
 */
const CONFIRM_FIRST_CURSOR = 1

/**
 * 나만의리그 칸 고르기 창 0xcf848 (종류 0x10, 0x2c746~0x2c7e4) — 버튼은 메인 메뉴 [14] 와 같은 그림:
 * 0 타자편 popup 고른 13 / 보통 11 (이미지 표 +0x34/+0x2c) · 1 투수편 14 / 12 (+0x38/+0x30). 2열×1행 · 간격 0x74805(창, 0x3c, 0).
 * 처음 커서 0x749d5 를 안 불러 타자편에서 시작한다. CLR → −1 → 하위 0.
 */
const CAREER_CHOOSE_BUTTONS = ['타자편', '투수편'] as const
const CAREER_CHOOSE_FRAMES = [{ normal: 11, selected: 13 }, { normal: 12, selected: 14 }] as const
const CAREER_CHOOSE_GRID = { columns: 2, gapX: 0x3c, gapY: 0 } as const
const CAREER_CHOOSE_CANCEL = -1

const MODE_RESET_NAMES = [SETTINGS_TEXT.careerReset, SETTINGS_TEXT.seasonReset, SETTINGS_TEXT.editReset] as const

/**
 * 환경설정 → **모드 초기화** (메인 메뉴 상태 0x21 — 갱신 0x2c6d8 · 그리기 0x2dc00 → 0x593c8 종류 0x21 · 0x5a316 직접 읽음).
 *
 * 하위 상태 [this+0x18] (점프표 0xcece0) — 전부는 `entities/settings` 의 `modeReset` 머리글:
 * ```
 * 하위 0 목록    CLR(−16) → 0xbcb49(…, 8) 환경설정 첫 화면 · OK(−5) → 칸별
 *   칸 0 [82] 나만의리그  → 고르기 창 0xcf848 "초기화할 데이터를 선택하세요"(종류 0x10) → 하위 1
 *   칸 1 [83] 시즌모드    → 확인 0xcf870 (종류 2) + 0x749d5(창, 1) → 하위 3
 *   칸 2 [84] 에디트      → 확인 0xcf8d4 (종류 2) + 0x749d5(창, 1) → 하위 4
 * 하위 1 답 0 타자편 · 1 투수편 → 시즌 중 막기(0xb5054 && +0x4e) ? [212] / 투수편은 [213](원본 버그) 종류 1 → 하위 0
 *                                                         : [210] / [211] 종류 2 + 0x749d5(창, 1) → 하위 2 · −1 → 하위 0
 * 하위 2 답 0(예) → 하위 0 · 0x224ec(mgr, 타자편 4 / 투수편 3) · 알림 0xcf900 / 1·−1 → 하위 0
 * 하위 3 답 0(예) → 하위 0 · 0x224ec(mgr, 2) · 알림 0xcf900 "초기화 되었습니다" / 답 1·−1 → 하위 0
 * 하위 4 답 0(예) → 하위 0 · 0x204c1(mgr) = memset(이름표, 0, 0x708) · 알림 0xcf900 / 답 1·−1 → 하위 0
 * ```
 * 나리 칸은 그 편 저장이 있는지 안 본다 — 없어도 고르기·확인·지우기·알림이 다 돈다.
 * 파일 저장은 이 상태에 없다 — 환경설정 첫 화면을 CLR·OK 로 나갈 때 0x295e2 가 0x1f1b9 로 저장한다.
 * 웹 저장 고리들은 지우는 즉시 저장한다(웹 환경설정 값들도 바꾸는 즉시 저장한다) — 창을 닫아 버리는 경우만 다르다.
 *
 * ⚠️ 칸 1 시즌모드: `onResetSeason` 을 안 받으면 OK 가 아무 일도 안 한다.
 */
function ModeResetPage({
  onResetCareer, careerResetBlockOf, onResetEditedNames, onResetSeason, mainMenu, panelHeight, onBack,
}: {
  readonly onResetCareer: (edition: CareerResetEdition) => void
  readonly careerResetBlockOf?: (edition: CareerResetEdition) => string | null
  readonly onResetEditedNames: () => void
  readonly onResetSeason?: () => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  /** 이번에 그리는 판 높이 — 첫 화면이 들고 있는 펼침(`nextPanelFold`) */
  readonly panelHeight: number
  readonly onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const isOutlineShown = isSelectedOutlineShown(useUpdateCounter())
  const [popup, setPopup] = useState<ModeResetPopup | null>(null)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const titleFrames = useFrameOrigins(IMG_TEXT)

  const openRow = (index: number) => {
    if (index === 0) return setPopup({ kind: '나리고르기' })
    if (index === 1) return onResetSeason === undefined ? undefined : setPopup({ kind: '시즌확인' })
    setPopup({ kind: '에디트확인' })
  }

  /** 하위 1 — 고르기 창 답. 막히면 [212]/[213] 알림 뒤 하위 0, 통과면 편별 확인 */
  const answerCareerChoose = (answer: number) => {
    if (answer !== 0 && answer !== 1) return setPopup(null)
    const edition: CareerResetEdition = answer === 0 ? '타자편' : '투수편'
    const blockText = careerResetBlockOf?.(edition) ?? null
    setPopup(blockText === null ? { kind: '나리확인', edition } : { kind: '나리막힘', text: blockText })
  }

  /** 확인 창 답 — 예(0)면 지우고 0xcf900 알림, 아니오는 하위 0 으로 */
  const answerConfirm = (reset: () => void) => (answer: number) => {
    if (answer !== 0) return setPopup(null)
    reset()
    setPopup({ kind: '완료' })
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
  const isUnfolded = panelHeight >= PANEL.height
  const clip = panelClipOf(panelHeight, PANEL.height)
  return (
    <RawScreen>
      <UnfoldingPanel height={panelHeight} />
      <PanelClip x={PANEL.x} y={clip.y} width={PANEL.width} height={clip.height}>
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
            {isSelected && isOutlineShown && isUnfolded && (
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
      </PanelClip>

      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />

      {popup?.kind === '나리고르기' && (
        <MessageBox
          text={MODE_RESET_TEXT.careerChoose}
          buttons={CAREER_CHOOSE_BUTTONS}
          buttonFrames={CAREER_CHOOSE_FRAMES}
          grid={CAREER_CHOOSE_GRID}
          cancelAnswer={CAREER_CHOOSE_CANCEL}
          onAnswer={answerCareerChoose}
        />
      )}
      {popup?.kind === '나리막힘' && (
        <MessageBox text={popup.text} buttons={['확인']} onAnswer={() => setPopup(null)} />
      )}
      {popup?.kind === '나리확인' && (
        <MessageBox
          text={popup.edition === '타자편' ? MODE_RESET_TEXT.careerBatterConfirm : MODE_RESET_TEXT.careerPitcherConfirm}
          buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(() => onResetCareer(popup.edition))} />
      )}
      {popup?.kind === '시즌확인' && onResetSeason !== undefined && (
        <MessageBox text={SETTINGS_TEXT.seasonResetConfirm} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(onResetSeason)} />
      )}
      {popup?.kind === '에디트확인' && (
        <MessageBox text={SETTINGS_TEXT.editResetConfirm} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR}
          onAnswer={answerConfirm(onResetEditedNames)} />
      )}
      {popup?.kind === '완료' && (
        <MessageBox text={SETTINGS_TEXT.resetDone} buttons={['확인']} onAnswer={() => setPopup(null)} />
      )}
    </RawScreen>
  )
}
