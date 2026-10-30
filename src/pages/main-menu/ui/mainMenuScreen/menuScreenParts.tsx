import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { MENU_DESCRIPTION_PANEL, MENU_REEL_SCROLL_STEPS, MENU_WHEEL_TURN_TICKS } from '@/pages/main-menu/lib/mainMenuLayout'
import { TOP_ENTRIES, type MainMenuAction, type MainMenuState } from '@/pages/main-menu/model/mainMenu'
import type { MainMenuScreenProps } from '@/pages/main-menu/ui/mainMenuScreen/mainMenuScreenProps'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

type Dispatch = (action: MainMenuAction) => void

/**
 * 전역기록 칸 — +0x4d(일반모드 경기 중간 저장) · +0x3c(마지막 모드) · 나리 두 편. 안 넘기면 저장 없음 · 1(새 저장)
 */
export function menuGlobalRecordOf(props: MainMenuScreenProps) {
  const { isGeneralGameInProgress = false, lastPlayedMode = 1, nariGameReady } = props
  return { isGeneralGameInProgress, lastPlayedMode, ...(nariGameReady === undefined ? {} : { nariGameReady }) }
}

/** 윗단은 5틱(카운터 0~4), 아랫단은 스크롤 석 장을 그린 뒤 배열이 돈다 */
export function menuTurnTicksOf(isWheel: boolean): number {
  return isWheel ? MENU_WHEEL_TURN_TICKS : MENU_REEL_SCROLL_STEPS.length
}

/** 아랫단에서도 바퀴는 처음 메뉴에서 고른 칸으로 깔린다 */
export function wheelCursorOf(isWheel: boolean, shownCursor: number, selectedTopId: MainMenuState['selectedTopId']): number {
  if (isWheel) return shownCursor
  return Math.max(
    TOP_ENTRIES.findIndex((entry) => entry.id === selectedTopId),
    0,
  )
}

/**
 * 머리띠 · 바닥띠 — 윗단 바닥 1(뒤로 표시 없음) · 아랫단 바닥 5(뒤로 표시). 보유 G 를 안 넘기면 그리지 않는다.
 * 미끄러짐은 타이틀에서 왔을 때만(`headerSlides`, 0x54df0~0x54e1e)
 */
export function menuScreenFrameOf(gamePoint: number | undefined, isWheel: boolean, headerSlides: boolean | undefined, dispatch: Dispatch) {
  if (gamePoint === undefined) return null
  return (
    <ScreenFrame
      title="2010프로야구"
      gamePoint={gamePoint}
      onBack={isWheel ? null : () => dispatch({ type: '뒤로' })}
      slides={headerSlides === true}
    />
  )
}

/** 설명 판 누름 칸을 둘 때 — 안내 · 일반모드 창 · 나리 편 고르기가 떠 있지 않다 */
function canPressSelected(state: MainMenuState): boolean {
  return state.lockedNotice === null && state.generalModeWindow === null && !state.isPickingNariEdition
}

/** 설명 판 = 지금 고른 칸 — 투명 누름 칸으로 OK (바닥띠 되돌아가기 x 206~ 는 비워 둔다) */
export function selectedPressAreaOf(state: MainMenuState, dispatch: Dispatch) {
  if (!canPressSelected(state)) return null
  return (
    <PressArea
      label="고른 칸 시작"
      onPress={() => dispatch({ type: '시작' })}
      rect={{
        x: MENU_DESCRIPTION_PANEL.x,
        y: MENU_DESCRIPTION_PANEL.y,
        width: 200 - MENU_DESCRIPTION_PANEL.x,
        height: 320 - MENU_DESCRIPTION_PANEL.y,
      }}
    />
  )
}

/** 머리띠가 없을 때 아랫단의 취소 단추(웹 임시 — 원본은 CLR 키). 처음 메뉴(하위 4)는 CLR 을 안 본다(0x29454) */
export function menuBackButtonOf(gamePoint: number | undefined, isWheel: boolean, dispatch: Dispatch) {
  if (gamePoint !== undefined || isWheel) return null
  return (
    <button type="button" className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
      ‹ 처음 메뉴
    </button>
  )
}
