import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { entriesOf, isEntryDimmed, selectedIdOf } from '@/pages/main-menu/model/mainMenu'
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
 * 메인 메뉴 — 원작대로 **두 단**이다. 윗단(하위 상태 4, 처음 메뉴)에서 [게임시작] 을 고르면
 * 아랫단(하위 상태 5, 게임시작 목록)으로 내려가고, 취소(Esc/CLR)하면 윗단으로 돌아온다.
 * 스페셜(6)·도움말(9)·환경설정(8)도 윗단에서 갈라진다 — 근거는 `model/mainMenu.ts` 주석 참고.
 *
 * 각 단은 원작대로 **글자 그림 목록**(main_ui 프레임)에서 ↑↓ 로 고르고 Enter 로 시작한다.
 * 이름·설명·순서와 새로하기·잠금 문구는 StrMAINMENU 원문이다.
 *
 * ⚠️ **배치는 근사다**: 원본 두 단은 화면 아래 (120,320) 중심 반지름 93 의 **반원 바퀴**에 칸이
 * 45°/90° 간격으로 도는 모습이다(F-ui-layout 4-2). 웹판은 아직 배너 + 세로 목록으로 그린다.
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
    else if (effect === '스페셜') onSpecial()
    else if (effect === '도움말') onHelp()
    else if (effect === '환경설정') onSettings()
    else onBack()
  })
  const origins = useFrameOrigins(`${MAIN_UI}/frames`)
  const widthOf = (frame: number) => origins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const entries = entriesOf(state.tier)
  const selectedId = selectedIdOf(state)
  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId)
  const selected = entries[selectedIndex]
  const panelText = state.lockedNotice
    ?? (state.isConfirmingNewGame ? NEW_GAME_CONFIRM : (selected?.description ?? ''))

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

      {/* 잠긴 칸도 목록에 그대로 나오고 커서도 지나간다 (R11 4-1) — 안내조차 없는 칸만 흐리게 (근사) */}
      {entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          aria-label={entry.id}
          aria-current={entry.id === selectedId}
          className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
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
        <DescriptionPanel raw={panelText} />
      </div>

      {state.lockedNotice !== null && (
        <div className={styles.confirmKeys}>
          {/* 원본 확인 팝업(0x74ef5 종류 1)은 아무 키나 받아 닫는다 */}
          <button type="button" onClick={() => dispatch({ type: '시작' })}>확인</button>
        </div>
      )}

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

      {/* 취소 — 아랫단이면 윗단으로, 윗단이면 타이틀로 (원본은 CLR 키다, 버튼은 웹 임시) */}
      <button type="button" className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
        {state.tier === 5 ? '‹ 처음 메뉴' : '‹ 타이틀'}
      </button>
    </RawScreen>
  )
}
