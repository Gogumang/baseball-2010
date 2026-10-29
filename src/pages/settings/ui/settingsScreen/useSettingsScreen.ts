import { useState } from 'react'
import { stopSkinFrameSlide } from '@/shared/lib/skinFrameSlide/skinFrameSlide'
import { useImgTextPalette3 } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { useCursorShake } from '@/shared/lib/cursorShake/useCursorShake'
import { isFrameSlideClearedAt, isFrameSlidingAt } from '@/widgets/screen-frame/lib/frameSlide'
import { SOUND_LEVEL_COUNT, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import { VIBRATION_TOGGLE_MILLISECONDS, vibrate } from '@/entities/defense-controls/model/vibration'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import {
  FIRST_MENU_ROW,
  IN_GAME_PANEL,
  IN_GAME_ROW_COUNT,
  MAIN_MENU_CURSOR_COUNT,
  PANEL,
  closingFold,
  isSelectedOutlineShown,
  openingFold,
} from '@/pages/settings/lib/settingsLayout'
import { IMG_TEXT, SLT_FRAMES } from '@/pages/settings/ui/settingsScreen/settingsAssets'
import type { SettingsScreenProps } from '@/pages/settings/ui/settingsScreen/settingsScreenProps'
import { usePanelFold } from '@/pages/settings/ui/settingsScreen/usePanelFold'
import { useSettingsKeys } from '@/pages/settings/ui/settingsScreen/useSettingsKeys'

const ALL_NAMES = [
  SETTINGS_TEXT.sound,
  SETTINGS_TEXT.speed,
  SETTINGS_TEXT.vibration,
  SETTINGS_TEXT.detail,
  SETTINGS_TEXT.modeReset,
  SETTINGS_TEXT.dataManagement,
]

/** 메뉴 줄 칸 — 3 상세 설정(상태 0x20) · 4 모드 초기화(0x21) */
const DETAIL_ROW_INDEX = 3
const MODE_RESET_ROW_INDEX = 4

/** 값 줄 0 소리 · 1 속도 — 끝에서 감는 다음 값 */
const wrapStep = (value: number, step: number, count: number) => (value + step + count) % count

/**
 * 판 꼴 — 메인 메뉴는 192×212 판 · 줄 여섯 · 격자 1×7(0x259fc, 줄 여섯 + OK).
 * 경기 장면 안 "설정"(skin+0x125 = 1)은 작은 판(130) · 값 줄 셋 · 격자 1×4(0x3c3ac, 줄 셋 + OK)
 */
const PAGE_SHAPES = {
  main: { panel: PANEL, names: ALL_NAMES, cursorCount: MAIN_MENU_CURSOR_COUNT },
  inGame: { panel: IN_GAME_PANEL, names: ALL_NAMES.slice(0, IN_GAME_ROW_COUNT), cursorCount: IN_GAME_ROW_COUNT + 1 },
} as const

/**
 * **머리띠가 미끄러지는 동안은 페이지를 안 그린다** — 0x593c8 은 [skin+0x84] ≠ 0 이면 0x59428~0x5942e 에서
 * `bl 0x5a772` 로 빠진다. 0x5a772 는 함수가 아니라 0x593c8 자신의 끝(0x5a772~0x5a780: [페이지+0x25] = 0 · sp 되돌림 · pop)이라
 * **판·제목·줄·설명 띠를 하나도 안 그리고, 판 펼침 0x5a6fe 도 안 부르고** 돌아간다. 그래서 그 뒤 0x55e60 의
 * 알파 · 위 띠 · 아래 띠 · 어둡게 자리에 넘기는 r7(= [skin+0x84])은 늘 0 이다 (깃발이 서 있으면 거기까지 못 온다).
 * 깃발은 상태 8 진입 0x259fc(앞 상태가 0x20~0x22 가 아닐 때) · 0x20 진입 0x2421c · 0x21 진입 0x242a4 가 세우고
 * 머리띠 0x54d95 가 다 내려온 그림에서 지운다(`isFrameSlideClearedAt`). 경기 중 메뉴(skin+0x125)는 머리띠가 없어 늘 그린다.
 * 값은 이 페이지(또는 하위 페이지)가 머리띠와 함께 들어선 갱신 수 — null 이면 미끄러지지 않는다.
 */
const isPageShownOf = (pageSlideStart: number | null, updates: number) => pageSlideStart === null || isFrameSlideClearedAt(updates - pageSlideStart)

/** 환경설정 첫 화면의 상태 · 키 · 나가기 — 훅 차례는 옛 `SettingsScreen` 몸통 그대로 */
export function useSettingsScreen(props: SettingsScreenProps) {
  const { settings, onChange, onSave, mainMenu, onBack } = props
  // 경기 중 [설정] — 경기 중 메뉴 0x3c326 갈래가 판을 세우며 [skin+0x84] = 0 을 쓴다(3c3b0~3c3ba). 머리띠는 없지만 전역 칸이라
  // 끊어 둔다(r168). 들어옴은 첫 그림보다 앞이다
  useState(() => {
    if (mainMenu === undefined) stopSkinFrameSlide()
    return null
  })
  const [cursor, setCursor] = useState(0)
  /** 하위 페이지(상세 설정·모드 초기화)에서 돌아왔는가 — 돌아온 첫 화면은 머리띠가 다시 미끄러지지 않는다 */
  const [hasReturned, setHasReturned] = useState(false)
  const updates = useUpdateCounter()
  const [isDetailOpen, setDetailOpen] = useState(false)
  const [isModeResetOpen, setModeResetOpen] = useState(false)
  const isSubPageOpen = isDetailOpen || isModeResetOpen
  /** [skin+0x410] — 하위 페이지가 떠 있으면 그 페이지가 0x593c8 을 그리며 올린다(이 첫 화면은 안 그린다) */
  const isOutlineShown = isSelectedOutlineShown(useSkinBlinkCounter(updates, isSubPageOpen ? 0 : 1))
  /** 고른 줄 까딱임 — 표 0xd1784 · 0xd1754 (`settingsLayout` 의 `ROW_SHAKE_TABLES` 머리말) */
  const rowShake = useCursorShake(updates)
  /** 경기 장면 안 "설정"(skin+0x125 = 1) — 작은 판, 값 줄 셋만, OK 단추가 넷째 커서 칸 */
  const isInGame = mainMenu === undefined
  const shape = PAGE_SHAPES[isInGame ? 'inGame' : 'main']
  /** 머리띠가 미끄러지는 그리기 — 메인 메뉴 환경설정만 머리띠가 있고, 하위 페이지에서 돌아온 화면은 미끄러지지 않는다 */
  const isHeaderSliding = !isInGame && !hasReturned && isFrameSlidingAt(updates)
  const [notice, setNotice] = useState<string | null>(null)
  const frames = useFrameOrigins(SLT_FRAMES)
  const titleFrames = useFrameOrigins(IMG_TEXT)
  const titlePalette = useImgTextPalette3()
  /** 페이지가 머리띠와 함께 들어선 갱신 수 — null 이면 미끄러지지 않는다(경기 중) */
  const [pageSlideStart, setPageSlideStart] = useState<number | null>(isInGame ? null : 0)
  const isPageShown = isPageShownOf(pageSlideStart, updates)
  /** OK 칸 번호 (격자 마지막 칸) */
  const okCell = shape.names.length
  /** OK 칸이 고른 칸이면 popup 프레임 18 (0x59de2~0x59e4e) */
  const isOkSelected = cursor === okCell
  const { fold, setFold, foldRef } = usePanelFold(isPageShown, shape.panel.height, onBack)

  /**
   * 첫 화면을 나간다 — 메인 메뉴는 OK 칸·CLR 모두 0x295e2(저장 0x1f1b9 → 접힘 → 상태 4).
   * 경기 중은 0x3cccc(3cccc~3cd5a)가 판을 접지 않고 목록을 곧바로 지운 뒤 0x1f1b9 저장 · 메뉴 0x741a1 을 다시 띄운다([앱+0x290] = 0 ·
   * 하위 +0x18 = 0 이라 0x593c9 판을 더 안 그린다) — 곧바로 돌아간다. CLR(3cb0e~3cb9c)도 같다(U-84).
   */
  const leave = () => {
    if (isInGame) return onBack()
    // 0x295e2: 0x1f1b9(저장) 뒤 접힘
    onSave?.()
    setFold(closingFold(foldRef.current))
  }

  /** 값 줄에서 좌우 키가 값을 바꾼다 — 줄은 지금 커서(누른 줄을 넘기면 그 줄. 클릭은 커서 갱신 전에 부른다) */
  const changeValue = (step: number, row: number = cursor) => {
    if (row === 0) return onChange({ ...settings, soundLevel: wrapStep(settings.soundLevel, step, SOUND_LEVEL_COUNT) })
    if (row === 1) return onChange({ ...settings, speedLevel: wrapStep(settings.speedLevel, step, SPEED_LEVEL_COUNT) })
    if (row !== 2) return undefined
    // 0x2966c: 저장+0x3b ^= 1 → 켜졌으면 0x3a44(100) 미리 흔들기 (경기 중 메뉴 0x3cc0c 도 같다)
    const isVibrationOn = !settings.isVibrationOn
    onChange({ ...settings, isVibrationOn })
    vibrate(VIBRATION_TOGGLE_MILLISECONDS, isVibrationOn)
  }

  /** 하위 페이지 진입 0x2421c(0x20) · 0x242a4(0x21) 도 판을 높이 0x20 · 걸음 1 · 끝 0 · 펼침 1 로 다시 세운다 (skin+0x90~+0x99) */
  const openSubPage = (open: (isOpen: boolean) => void) => {
    setFold(openingFold())
    setPageSlideStart(updates)
    open(true)
  }

  const openRow = (index: number) => {
    if (index === okCell) return leave()
    if (index < FIRST_MENU_ROW) return changeValue(1, index)
    if (index === DETAIL_ROW_INDEX) return openSubPage(setDetailOpen)
    // 칸 4 → 상태 0x21 (0x295d0 `0xbcb49(…, 0x21)`) — 조건 없이 들어간다
    if (index === MODE_RESET_ROW_INDEX) return props.onResetEditedNames === undefined ? undefined : openSubPage(setModeResetOpen)
    setNotice(SETTINGS_TEXT.dataManagementBlocked)
  }

  /** 좌우 키 — 값 줄은 값을, 경기 중 OK 칸은 0x3cba4 → 0x3cccc 돌아가기. 메인 메뉴 OK 칸의 좌우는 아무 일도 없다(0x29604/0x2960a 는 칸 0~2 만) */
  const horizontalActionOf = () => {
    if (cursor < FIRST_MENU_ROW) return (step: number) => changeValue(step)
    return isOkSelected && isInGame ? () => onBack() : null
  }

  useSettingsKeys({
    isActive: notice === null && !isSubPageOpen,
    onVertical: (vertical) => {
      // 1열 격자라 세로 키는 늘 커서를 옮긴다(끝에서 감는다) → 격자 +0x25 가 서고 그 방향으로 까딱인다.
      // 머리띠가 미끄러지는 그리기는 0x5942e 가 페이지를 안 그리고 +0x25 만 지워(0x5a772) 까딱이지 않는다 (`ROW_SHAKE_TABLES`)
      if (!isHeaderSliding) rowShake.start(vertical > 0 ? 'down' : 'up')
      setCursor((previous) => wrapStep(previous, vertical, shape.cursorCount))
    },
    onHorizontal: horizontalActionOf(),
    onConfirm: () => openRow(cursor),
    onBack: leave,
  })

  /** 하위 페이지에서 돌아온다 — 돌아온 첫 화면은 머리띠가 다시 미끄러지지 않는다 */
  const returnFrom = (close: (isOpen: boolean) => void) => () => {
    setHasReturned(true)
    setPageSlideStart(null)
    close(false)
  }

  return {
    cursor,
    setCursor,
    hasReturned,
    isDetailOpen,
    isModeResetOpen,
    isOutlineShown,
    rowShake,
    isInGame,
    shape,
    notice,
    setNotice,
    frames,
    titleFrames,
    titlePalette,
    isPageShown,
    okCell,
    isOkSelected,
    fold,
    leave,
    changeValue,
    openRow,
    returnFrom: { detail: returnFrom(setDetailOpen), modeReset: returnFrom(setModeResetOpen) },
  }
}

export type SettingsScreenState = ReturnType<typeof useSettingsScreen>
