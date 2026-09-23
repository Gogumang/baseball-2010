import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { entriesOf, isEntryDimmed, selectedIdOf } from '@/pages/main-menu/model/mainMenu'
import { useMainMenu } from '@/pages/main-menu/model/useMainMenu'
import { useWheelTurn } from '@/pages/main-menu/model/useWheelTurn'
import {
  MENU_BANNER, MENU_LABEL_HEIGHT, MENU_SELECTION_BAR, SCREEN_CENTER_X,
  menuDescriptionPanelOf, menuRowTopOf, menuWheelAngleOf, menuWheelLabelTopLeftOf,
  menuWheelPointOf, menuWheelTurnAngleOf, selectionBarTopOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import { DescriptionPanel } from '@/pages/main-menu/ui/DescriptionPanel'
import { MenuWheel } from '@/pages/main-menu/ui/MenuWheel'
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
/**
 * 윗단(바퀴) 칸 글자는 **`ui/img_text` 프레임**이다 — 높이 **10px** 로, 아랫단이 쓰는
 * `main_ui` 글자(높이 27)보다 훨씬 작다. 원본 번호표 `[0x1552d4c + 4i]` 는 아직 안 읽혔지만,
 * `img_text` 409장을 펼쳐 보면 앞칸이 **그대로 메뉴 차례**다:
 *   0 게임시작 · 1 스페셜 · 2 도움말 · 3 환경설정 · 4 랭킹 … 그리고 **26 게임문의**
 * ⚠️ **게임문의만 5 가 아니다** — 프레임 5 는 "선물&추천" 이다. 0~5 연속으로 짐작하면 틀린다.
 * 눈으로 맞춘 것이라 **유력**이지만, 다섯 칸이 순서대로 맞는 것과 26 이 정확히 "게임문의" 인 것이 근거다.
 */
const IMG_TEXT = './sprites/img_text'
const TOP_TEXT_FRAMES: readonly number[] = [0, 1, 2, 3, 4, 26]
const labelImage = (frame: number) => `${MAIN_UI}/frames/${String(frame).padStart(3, '0')}.png`
const textImage = (frame: number) => `${IMG_TEXT}/frames/${String(frame).padStart(3, '0')}.png`
const partImage = (frame: number) => `${MAIN_UI}/${String(frame).padStart(3, '0')}.png`

/**
 * 메인 메뉴 — 원작대로 **두 단**이다. 윗단(하위 상태 4, 처음 메뉴)에서 [게임시작] 을 고르면
 * 아랫단(하위 상태 5, 게임시작 목록)으로 내려가고, 취소(Esc/CLR)하면 윗단으로 돌아온다.
 * 스페셜(6)·도움말(9)·환경설정(8)도 윗단에서 갈라진다 — 근거는 `model/mainMenu.ts` 주석 참고.
 *
 * 각 단은 원작대로 **글자 그림**(main_ui 프레임)에서 ↑↓ 로 고르고 Enter 로 시작한다.
 * 이름·설명·순서와 새로하기·잠금 문구는 StrMAINMENU 원문이다.
 *
 * **윗단은 원본 반원 바퀴다**: (120,320) 중심 반지름 93 원 3겹 위에 6칸이 각도 표
 * [0,45,90,180,270,315]° 자리에 놓이고, 고른 칸이 맨 위 270° 로 올라온다. 화면에 보이는 칸은
 * 네 개(180·270·315·0)뿐이고 나머지 둘은 화면 아래로 내려간다 (F-ui-layout 4-2).
 *
 * ⚠️ **아랫단(게임시작 7칸)은 아직 세로 목록이다 — 근사.** 원본 각도 표는 6칸뿐이고 상태 5 의
 * 하위 목록 0x2524c 좌표는 해독 전이라, 7칸이 어떻게 도는지 근거가 없다. 지어내지 않았다.
 * 자세한 근거·근사 구분은 `lib/mainMenuLayout.ts` 머리말에 적어 뒀다.
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
  const textOrigins = useFrameOrigins(`${IMG_TEXT}/frames`)
  const entries = entriesOf(state.tier)
  const selectedId = selectedIdOf(state)
  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId)
  const selected = entries[selectedIndex]
  const panelText = state.lockedNotice
    ?? (state.isConfirmingNewGame ? NEW_GAME_CONFIRM : (selected?.description ?? ''))

  // 윗단만 바퀴다 — 아랫단은 아직 세로 목록이라 돌 것이 없다.
  const isWheel = state.tier === 4
  const turn = useWheelTurn(isWheel ? Math.max(selectedIndex, 0) : 0)
  const panel = menuDescriptionPanelOf(isWheel)

  /** 칸 글자 그림의 좌상단 — 바퀴면 기준점 가운데 맞춤, 세로 목록이면 가운데 정렬 한 줄 */
  const labelTopLeftOf = (index: number, width: number) => {
    if (!isWheel) {
      return { x: SCREEN_CENTER_X - Math.trunc(width / 2), y: menuRowTopOf(index) }
    }
    const fromAngle = menuWheelAngleOf(index, turn.fromIndex)
    const toAngle = menuWheelAngleOf(index, Math.max(selectedIndex, 0))
    const angle = menuWheelTurnAngleOf(fromAngle, toAngle, turn.counter)
    return menuWheelLabelTopLeftOf(menuWheelPointOf(angle), width, MENU_LABEL_HEIGHT)
  }

  return (
    <RawScreen>
      <img
        className={styles.layer}
        style={{ left: MENU_BANNER.x, top: MENU_BANNER.y }}
        src="./sprites/mode_back/000.png"
        alt=""
      />

      {/* 바퀴 바닥 — 가운데 공 + 테두리 원 3겹 (확정). 칸 글자보다 먼저 깐다. */}
      {isWheel && <MenuWheel />}

      {/* 세로 목록에서만 고른 줄 뒤에 바를 깐다 — 4-2 에 바퀴용 선택 바 이야기는 없다 */}
      {!isWheel && selectedIndex >= 0 && (
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
      {entries.map((entry, index) => {
        // 바퀴는 img_text(10px), 세로 목록은 main_ui(27px) — 그림판이 다르니 폭도 따로 잰다
        const textFrame = TOP_TEXT_FRAMES[index]
        const useText = isWheel && textFrame !== undefined
        const key = String(useText ? textFrame : entry.labelFrame).padStart(3, '0')
        const width = (useText ? textOrigins : origins)?.[key]?.width ?? 0
        const topLeft = labelTopLeftOf(index, width)
        return (
          <button
            key={entry.id}
            type="button"
            aria-label={entry.id}
            aria-current={entry.id === selectedId}
            className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
            style={{ left: topLeft.x, top: topLeft.y }}
            onMouseEnter={() => dispatch({ type: '모드선택', id: entry.id })}
            onClick={() => {
              dispatch({ type: '모드선택', id: entry.id })
              dispatch({ type: '시작' })
            }}
          >
            <img src={useText ? textImage(textFrame) : labelImage(entry.labelFrame)} alt="" />
          </button>
        )
      })}

      <img
        className={styles.layer}
        style={{ left: panel.x, top: panel.y }}
        src={partImage(panel.frame)}
        alt=""
      />
      <div
        className={styles.description}
        style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }}
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
