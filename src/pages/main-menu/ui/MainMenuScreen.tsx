import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { entriesOf, isEntryDimmed, selectedIdOf, TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu'
import { useMainMenu } from '@/pages/main-menu/model/useMainMenu'
import { useMenuTurn } from '@/pages/main-menu/model/useMenuTurn'
import {
  MENU_BANNER, MENU_DESCRIPTION_PANEL, MENU_DESCRIPTION_TEXT_BOX, MENU_PANEL_HEADING_COLOR,
  MENU_REEL_ITEM_FRAMES, MENU_REEL_SCROLL_STEPS, MENU_REEL_SHADOW_COLOR, MENU_REEL_SHADOW_OFFSET,
  MENU_REEL_SLOTS, MENU_WHEEL_ITEM_FRAMES, MENU_WHEEL_TURN_TICKS,
  isMenuWheelAngleDrawn, menuPanelHeadingFrameOf, menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf, menuReelEntryAtSlotOf, menuReelFrameListOf, menuReelSlotRowOf,
  menuReelTextTopLeftOf, menuWheelAngleAt, menuWheelLabelTopLeftOf, menuWheelOrderOf,
  menuWheelPointOf,
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
const IMG_TEXT = './sprites/img_text'
const pad = (frame: number) => String(frame).padStart(3, '0')
/** 합성 프레임 (main_ui/frames · img_text/frames) */
const frameSrc = (folder: string, frame: number) => `${folder}/frames/${pad(frame)}.png`
/** 통짜 이미지 (main_ui/NNN) — 설명 판이 이쪽이다 */
const imageSrc = (frame: number) => `${MAIN_UI}/${pad(frame)}.png`

/** 웹이 내려가는 하위 목록은 아직 **상태 5(게임시작)** 하나다 — 표는 상태로 색인한다 */
const REEL_STATE = 5

/**
 * 메인 메뉴 — 원작대로 **두 단**이다. 윗단(하위 상태 4, 처음 메뉴)에서 [게임시작] 을 고르면
 * 아랫단(하위 상태 5, 게임시작 목록)으로 내려가고, 취소(Esc/CLR)하면 윗단으로 돌아온다.
 * 스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10 도 윗단에서 갈라진다
 * (표 0xcebdc = [5,6,7,8,9,10], 0x294a2 확정).
 *
 * **두 단 다 원본처럼 "배열이 도는" 릴이다** — 커서가 칸을 옮겨 다니는 것이 아니다.
 * 자세한 근거·좌표는 `lib/mainMenuLayout.ts` 머리말에 적어 뒀다.
 *   윗단 = 반원 바퀴. 여섯 칸이 각도 표 [0,45,90,180,270,315]° 자리에 놓이고 배열이 한 칸씩 돈다.
 *          **고른 칸은 0° 자리라 아예 안 그려진다**(0x24ef0) — 설명 판이 대신 보여 준다.
 *   아랫단 = 세로 릴. 화면 슬롯은 7개 고정이고 9칸짜리 배열이 돈다. **슬롯 4(= 고른 칸)는 안 그린다**.
 *
 * ⚠️ 원본은 아랫단에서도 바퀴 판(0x24b1c)을 **먼저 깔고** 그 위에 목록(0x2524c)을 그린다
 * (부르는 곳 0x2857c 등이 둘을 잇달아 부른다). 그래서 게임시작 목록 뒤로 처음 메뉴 칸 글자가
 * 그대로 비친다 — 보기에 이상해도 원본이 그렇다.
 *
 * ⚠️ 원본 좌표대로 놓으면 아랫단 슬롯 5·6·7(y 360·380·400)과 **설명 판 아래 절반이 화면 밖**이다.
 *    보이는 것은 위 세 줄 + 판 윗동강뿐이다. 값을 비틀지 않았다 — `mainMenuLayout.ts` 주석 참고.
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

  const isWheel = state.tier === 4
  const entries = entriesOf(state.tier)
  const selectedId = selectedIdOf(state)
  const selected = entries.find((entry) => entry.id === selectedId)
  const cursor = Math.max(entries.findIndex((entry) => entry.id === selectedId), 0)

  // 윗단은 5틱(카운터 0~4), 아랫단은 스크롤 석 장을 그린 뒤 배열이 돈다
  const turn = useMenuTurn(
    cursor,
    entries.length,
    isWheel ? MENU_WHEEL_TURN_TICKS : MENU_REEL_SCROLL_STEPS.length,
  )
  /** 도는 동안은 **돌기 전 배열**을 그린다 (회전은 마지막 틱에 한 번 일어난다) */
  const shownCursor = turn.direction === null ? cursor : turn.fromCursor

  const panelText = state.lockedNotice
    ?? (state.isConfirmingNewGame ? NEW_GAME_CONFIRM : (selected?.description ?? ''))

  const sizeOf = (frames: ReturnType<typeof useFrameOrigins>, frame: number) =>
    frames?.[pad(frame)] ?? null

  /** 단색으로 찍는 글자 (원본 효과 0xb) — 그림을 마스크로 쓰고 색을 칠한다 */
  const tinted = (src: string, left: number, top: number, width: number, height: number, color: string) => (
    <div
      className={styles.tintedLabel}
      style={{ left, top, width, height, background: color, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }}
    />
  )

  // ── 윗단 바퀴: 여섯 자리에 놓인 칸 글자 (아랫단에서도 그대로 깔린다) ──
  const wheelCursor = isWheel
    ? shownCursor
    : Math.max(TOP_ENTRIES.findIndex((entry) => entry.id === state.selectedTopId), 0)
  const wheelOrder = menuWheelOrderOf(wheelCursor)
  const wheelDirection = isWheel ? turn.direction : null
  const wheelLabels = wheelOrder.map((entryIndex, slot) => {
    const angle = menuWheelAngleAt(slot, wheelDirection, turn.counter)
    if (!isMenuWheelAngleDrawn(angle)) return null
    const frame = MENU_WHEEL_ITEM_FRAMES[entryIndex]
    const size = sizeOf(textOrigins, frame)
    if (size === null) return null
    const topLeft = menuWheelLabelTopLeftOf(menuWheelPointOf(angle), size.width, size.height)
    const entry = TOP_ENTRIES[entryIndex]
    return (
      <button
        key={entry.id}
        type="button"
        aria-label={entry.id}
        aria-current={isWheel && entryIndex === cursor}
        className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
        style={{ left: topLeft.x, top: topLeft.y }}
        disabled={!isWheel}
        onMouseEnter={() => isWheel && dispatch({ type: '모드선택', id: entry.id })}
        onClick={() => {
          dispatch({ type: '모드선택', id: entry.id })
          dispatch({ type: '시작' })
        }}
      >
        <img src={frameSrc(IMG_TEXT, frame)} alt="" />
      </button>
    )
  })

  // ── 아랫단 세로 릴 ──
  const reelFrames = MENU_REEL_ITEM_FRAMES[REEL_STATE]
  const reelRow = menuReelSlotRowOf(REEL_STATE)
  const reelFrameList = menuReelFrameListOf(reelFrames)
  /** ↑(−1) 면 +, ↓(−2) 면 − 로 민다 (0x2534c) */
  const scroll = turn.direction === null
    ? 0
    : (turn.direction === -1 ? 1 : -1) * (MENU_REEL_SCROLL_STEPS[turn.counter] ?? 0)
  const reelLabels = isWheel ? [] : MENU_REEL_SLOTS.map((slot) => {
    const entryIndex = menuReelEntryAtSlotOf(reelFrames, reelRow, shownCursor, slot)
    if (entryIndex === null) return null
    const frame = reelFrameList[entryIndex]
    const size = sizeOf(textOrigins, frame)
    if (size === null) return null
    const topLeft = menuReelTextTopLeftOf(slot, size.width, scroll)
    if (topLeft === null) return null
    const entry = entries[entryIndex]
    const src = frameSrc(IMG_TEXT, frame)
    return (
      <div key={entry.id}>
        {/* 그림자를 #212B70 으로 (+1,+1) 에 먼저 찍고 진짜 글자를 원색으로 덮는다 (0x255c8) */}
        {tinted(
          src,
          topLeft.x + MENU_REEL_SHADOW_OFFSET.x,
          topLeft.y + MENU_REEL_SHADOW_OFFSET.y,
          size.width,
          size.height,
          MENU_REEL_SHADOW_COLOR,
        )}
        <button
          type="button"
          aria-label={entry.id}
          className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
          style={{ left: topLeft.x, top: topLeft.y }}
          onMouseEnter={() => dispatch({ type: '모드선택', id: entry.id })}
          onClick={() => {
            dispatch({ type: '모드선택', id: entry.id })
            dispatch({ type: '시작' })
          }}
        >
          <img src={src} alt="" />
        </button>
      </div>
    )
  })

  // ── 설명 판 (두 단 공통) ──
  const panelLabelSize = selected === undefined ? null : sizeOf(origins, selected.labelFrame)
  const panelLabelAt = panelLabelSize === null
    ? null
    : menuPanelLabelTopLeftOf(panelLabelSize.width, panelLabelSize.height)
  /** 판 왼쪽 위 회색 제목 — 하위 목록(0x257cc)에만 있다 */
  const headingFrame = isWheel ? null : menuPanelHeadingFrameOf(REEL_STATE)
  const headingSize = headingFrame === null ? null : sizeOf(textOrigins, headingFrame)

  return (
    <RawScreen>
      <img
        className={styles.layer}
        style={{ left: MENU_BANNER.x, top: MENU_BANNER.y }}
        src="./sprites/mode_back/000.png"
        alt=""
      />

      {/* 바퀴 바닥 — 가운데 공 + 테두리 원 3겹 (확정). 두 단 다 깔린다. */}
      <MenuWheel />
      {wheelLabels}

      {/* 잠긴 칸도 목록에 그대로 나오고 커서도 지나간다 (R11 4-1) — 안내조차 없는 칸만 흐리게 (근사) */}
      {reelLabels}

      <img
        className={styles.layer}
        style={{ left: MENU_DESCRIPTION_PANEL.x, top: MENU_DESCRIPTION_PANEL.y }}
        src={imageSrc(MENU_DESCRIPTION_PANEL.frame)}
        alt=""
      />
      {/* 판 안 큰 글자 = main_ui 프레임, 첨자는 커서다 (0x25774 · 상태 4 는 0x25084) */}
      {selected !== undefined && panelLabelAt !== null && panelLabelSize !== null && (
        <img
          className={styles.layer}
          style={{ left: panelLabelAt.x, top: panelLabelAt.y }}
          src={frameSrc(MAIN_UI, selected.labelFrame)}
          alt=""
        />
      )}
      {headingFrame !== null && headingSize !== null && tinted(
        frameSrc(IMG_TEXT, headingFrame),
        menuPanelHeadingTopLeftOf().x,
        menuPanelHeadingTopLeftOf().y,
        headingSize.width,
        headingSize.height,
        MENU_PANEL_HEADING_COLOR,
      )}
      <div
        className={styles.description}
        style={{
          left: MENU_DESCRIPTION_TEXT_BOX.x,
          top: MENU_DESCRIPTION_TEXT_BOX.y,
          width: MENU_DESCRIPTION_TEXT_BOX.width,
          height: MENU_DESCRIPTION_TEXT_BOX.height,
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
      <button type="button" data-turn={`${turn.direction}/${turn.counter}/${turn.fromCursor}/${scroll}`} className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
        {state.tier === 5 ? '‹ 처음 메뉴' : '‹ 타이틀'}
      </button>
    </RawScreen>
  )
}
