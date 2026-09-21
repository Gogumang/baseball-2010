import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { isEntryEnabled, MODE_ENTRIES } from '@/pages/main-menu/model/mainMenu'
import { useMainMenu } from '@/pages/main-menu/model/useMainMenu'
import {
  MENU_BANNER, MENU_DESCRIPTION_PANEL, MENU_SELECTION_BAR, SCREEN_CENTER_X,
  menuRowTopOf, selectionBarTopOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import { DescriptionPanel } from '@/pages/main-menu/ui/DescriptionPanel'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

export type GameMode = '미션' | '홈런더비' | '시즌모드' | '일반모드'

interface MainMenuScreenProps {
  readonly hasSavedGame: boolean
  readonly onContinue: () => void
  readonly onNewGame: () => void
  readonly onSelectMode: (mode: GameMode) => void
  readonly onBack: () => void
  /** 원작 처음 메뉴의 [도움말] (StrMAINMENU[2]) */
  readonly onHelp: () => void
  /** 원작 처음 메뉴의 [환경설정] (StrMAINMENU[3]) */
  readonly onSettings: () => void
  /** 원작 처음 메뉴의 [스페셜] (StrMAINMENU[1]) */
  readonly onSpecial: () => void
}

const MAIN_UI = './sprites/main_ui'
const labelImage = (frame: number) => `${MAIN_UI}/frames/${String(frame).padStart(3, '0')}.png`
const partImage = (frame: number) => `${MAIN_UI}/${String(frame).padStart(3, '0')}.png`

/**
 * 메인 메뉴 — 원작대로 **글자 그림 목록**에서 ↑↓ 로 고르고 Enter 로 시작한다.
 * 모드 이름·설명·순서와 새로하기 확인 문구는 StrMAINMENU 원문이다.
 *
 * (2026-09-13 에 토스 TDS 셀렉트박스로 바꿨던 적이 있는데, "원본이 기준, 커스텀은 그 뒤" 원칙에 따라
 * 원본 목록으로 되돌렸다. 목록 좌표는 아직 못 읽어 추정이다 — `mainMenuLayout.ts` 참고.)
 */
export function MainMenuScreen({
  hasSavedGame,
  onContinue,
  onNewGame,
  onSelectMode,
  onBack,
  onHelp,
  onSettings,
  onSpecial,
}: MainMenuScreenProps) {
  const { state, dispatch } = useMainMenu(hasSavedGame, false, (effect) => {
    if (effect === '이어하기') onContinue()
    else if (effect === '새로하기') onNewGame()
    else if (effect === '미션') onSelectMode('미션')
    else if (effect === '홈런더비') onSelectMode('홈런더비')
    else if (effect === '시즌모드') onSelectMode('시즌모드')
    else if (effect === '일반모드') onSelectMode('일반모드')
    else onBack()
  })
  const origins = useFrameOrigins(`${MAIN_UI}/frames`)
  const widthOf = (frame: number) => origins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const selectedIndex = MODE_ENTRIES.findIndex((entry) => entry.id === state.selectedModeId)
  const selected = MODE_ENTRIES[selectedIndex]

  return (
    <RawScreen>
      <img
        className={styles.layer}
        style={{ left: MENU_BANNER.x, top: MENU_BANNER.y }}
        src="./sprites/mode_back/000.png"
        alt=""
      />

      {/* 고른 줄 뒤에 까는 바 — 글자보다 먼저 그려야 글자를 덮지 않는다 */}
      {selectedIndex >= 0 && (
        <img
          className={styles.layer}
          style={{
            left: SCREEN_CENTER_X - Math.trunc(MENU_SELECTION_BAR.width / 2),
            top: selectionBarTopOf(selectedIndex),
          }}
          src={partImage(MENU_SELECTION_BAR.frame)}
          alt=""
        />
      )}

      {MODE_ENTRIES.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          aria-label={entry.id}
          aria-current={entry.id === state.selectedModeId}
          className={styles.menuRow}
          disabled={!isEntryEnabled(entry, hasSavedGame)}
          style={{ left: SCREEN_CENTER_X - Math.trunc(widthOf(entry.labelFrame) / 2), top: menuRowTopOf(index) }}
          onMouseEnter={() => dispatch({ type: '모드선택', id: entry.id })}
          onClick={() => {
            dispatch({ type: '모드선택', id: entry.id })
            dispatch({ type: '시작' })
          }}
        >
          <img src={labelImage(entry.labelFrame)} alt="" />
        </button>
      ))}

      <img
        className={styles.layer}
        style={{ left: MENU_DESCRIPTION_PANEL.x, top: MENU_DESCRIPTION_PANEL.y }}
        src={partImage(MENU_DESCRIPTION_PANEL.frame)}
        alt=""
      />
      <div
        className={styles.description}
        style={{
          left: MENU_DESCRIPTION_PANEL.x,
          top: MENU_DESCRIPTION_PANEL.y,
          width: MENU_DESCRIPTION_PANEL.width,
          height: MENU_DESCRIPTION_PANEL.height,
        }}
      >
        <DescriptionPanel raw={state.isConfirmingNewGame ? NEW_GAME_CONFIRM : (selected?.description ?? '')} />
      </div>

      {state.isConfirmingNewGame && (
        <div className={styles.confirmKeys}>
          <button type="button" onClick={() => dispatch({ type: '확인', isAccepted: true })}>
            예
          </button>
          <button type="button" onClick={() => dispatch({ type: '확인', isAccepted: false })}>
            아니오
          </button>
        </div>
      )}

      {/* 원작 처음 메뉴 — 아직 화면이 없는 것들이라 구석에 둔다 (웹 임시) */}
      <div className={styles.topRightButtons}>
        <button type="button" className={styles.cornerButton} onClick={onSpecial}>스페셜</button>
        <button type="button" className={styles.cornerButton} onClick={onHelp}>도움말</button>
        <button type="button" className={styles.cornerButton} onClick={onSettings}>환경설정</button>
      </div>
      <button type="button" className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
        ‹ 타이틀
      </button>
    </RawScreen>
  )
}
