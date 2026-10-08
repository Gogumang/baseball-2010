import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { GENERAL_MODE_PROMPT, NARI_EDITION_PROMPT, NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { entriesOf, isEntryDimmed, selectedIdOf, TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu'
import type { GameStartCursor, MainMenuOpenTier, NariGameReady } from '@/pages/main-menu/model/mainMenu'
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
import { useMenuBand } from '@/pages/main-menu/model/useMenuBand'
import { DescriptionPanel } from '@/pages/main-menu/ui/DescriptionPanel'
import { MenuBand } from '@/pages/main-menu/ui/MenuBand'
import { MenuWheel } from '@/pages/main-menu/ui/MenuWheel'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

export type GameMode = '미션' | '홈런더비' | '시즌모드' | '일반모드' | '일반모드빠른실행' | '일반모드경기이어하기'

/**
 * 일반모드 [13] 버튼 — 띄운 쪽이 `0x74ea9(창, 고른 그림, 보통 그림, 0)` 로 하나씩 넣는다 (0x29782~0x297d8).
 * 고른 그림 = popup 이미지 표 +0x24/+0x20/+0x28 → 프레임 9·8·10 (67×23), 보통 = +0x10/+0xc/+0x14 → 4·3·5 (59×15).
 */
const GENERAL_MODE_BUTTONS = ['이어하기', '새로하기', '빠른실행'] as const
const GENERAL_MODE_BUTTON_FRAMES = [
  { normal: 4, selected: 9 }, { normal: 3, selected: 8 }, { normal: 5, selected: 10 },
] as const
/** 격자 1열×3행(종류 0x10 인자 1, 3 — 0x297a0 · 0x753f4) · 간격 0x74805(창, 0, 5) */
const GENERAL_MODE_GRID = { columns: 1, gapX: 0, gapY: 5 } as const
/** CLR(−16) → 답 −1 (0x29760~0x2977c 가 창 키 표에 넣는다) → 상태 5 */
const GENERAL_MODE_CANCEL = -1
/** [15] 의 처음 커서 — 0x749d5(창, 1) = [아니오] (0x298f2 · 0x2998c) */
const NEW_GAME_CONFIRM_CURSOR = 1

/**
 * 나만의리그 [14] 버튼 (진입 0x25d78): 0 타자편 고른 13 / 보통 11 (이미지 표 +0x34/+0x2c) · 1 투수편 14 / 12 (+0x38/+0x30).
 * 격자 2열×1행(종류 0x10 인자 2, 1) · 간격 0x74805(창, 0x3c, 0) · CLR → −1. 처음 커서는 0(0x749d5 를 안 부른다).
 */
const NARI_EDITION_BUTTONS = ['타자편', '투수편'] as const
const NARI_EDITION_BUTTON_FRAMES = [{ normal: 11, selected: 13 }, { normal: 12, selected: 14 }] as const
const NARI_EDITION_GRID = { columns: 2, gapX: 0x3c, gapY: 0 } as const
/** CLR(−16) → −1 (0x25dc2~0x25df2 가 창 키 표에 넣는다) → 상태 5 */
const NARI_EDITION_CANCEL = -1

interface MainMenuScreenProps {
  readonly hasSavedGame: boolean
  /** 전역기록 +0x4d — 일반모드 경기가 중간 저장돼 있다. [13] 처음 커서·[15] 확인·이어하기가 본다. 안 넘기면 없음 */
  readonly isGeneralGameInProgress?: boolean
  /** 전역기록 +0x3c — 마지막으로 시작한 모드. [최근게임] 이 이 값으로 갈라진다(0x28d54). 안 넘기면 새 저장 기본값 1 */
  readonly lastPlayedMode?: number
  /** 나만의리그 [14] 에서 편을 골랐다 — 원본은 그 편 커리어가 있으면 이어하고 없으면 팀 고르기로 간다(0xf684) */
  readonly onNewGame: (edition: '타자편' | '투수편') => void
  /**
   * 나리 두 편의 `전역기록 +0x40+m && +0x4c+m` — [14]·[최근게임] 의 0x327b8 모드 3·4 갈래가 곧장 경기로 갈지 본다.
   * 안 넘기면 둘 다 거짓(늘 장면 0x106)
   */
  readonly nariGameReady?: NariGameReady
  /** 그 갈래의 곧장 경기 — 0x213c0(앱, m, 0) → 장면 0x104. 안 넘기면 `onNewGame` 으로 간다 */
  readonly onResumeNariGame?: (edition: '타자편' | '투수편') => void
  readonly onSelectMode: (mode: GameMode) => void
  readonly onBack: () => void
  /** 원작 처음 메뉴의 [도움말] (StrMAINMENU[2]) */
  readonly onHelp: () => void
  /** 원작 처음 메뉴의 [환경설정] (StrMAINMENU[3]) */
  readonly onSettings: () => void
  /** 원작 처음 메뉴의 [스페셜] (StrMAINMENU[1]) */
  readonly onSpecial: () => void
  /**
   * 처음 메뉴(하위 4)에 들어선 지 **열 번째 갱신** — 갱신 0x29454 가 상태 틱 `[this+0x2c] == 10`(0xbc9c8 이 상태가 같으면
   * 1 씩 올리고 바뀌면 0 으로 되돌리는 칸)일 때 전부 수집 보상 판정 0x28e98 을 부른다(0x2951e~0x29536).
   * 아랫단(하위 5)으로 내려가면 틱이 끊기고 돌아오면 다시 센다.
   */
  readonly onTopMenuTenthTick?: () => void
  /** 메뉴 위에 얹는 것 — 전부 수집 보상 팝업 0x292f8 */
  readonly overlay?: ReactNode
  /**
   * 전역 G(`mgr+0x64`) — 두 단 그리기가 다 맨 끝에 머리띠 0x54d95 를 부른다:
   *   윗단(하위 4) 0x2866c = `0x24b1c` → `0x54d95(skin, 0, 1)` · 아랫단(하위 5) 0x2863c = `0x24b1c` → `0x2524c(this, 5, 틱)` → `0x54d95(skin, 0, 5)`.
   * 제목 0 "2010프로야구" 라 G포인트(0x54a60)도 그린다(0x550dc). 바닥 1 은 비트 0x4 가 없어 **뒤로 표시가 없고**(띠·탭만),
   * 바닥 5 는 뒤로 표시가 있다. 안 넘기면 예전처럼 머리띠를 안 그린다.
   */
  readonly gamePoint?: number
  /**
   * 장면을 세울 때의 첫 단 — 전역 `[0x140006c]`(생성자 0x234d4). 5 면 게임시작 목록에서 열고 바탕 띠 연출을 켠다
   * (나리 · 시즌 관리 메뉴 취소가 5 를 넣는다). 안 넘기면 4(처음 메뉴)
   */
  readonly openTier?: MainMenuOpenTier
  /** 게임시작 목록 커서 전역 [0x1552d24] — 루트가 들고 다닌다. 안 넘기면 첫 단 5 도 0 칸에서 열고 적지 않는다 */
  readonly gameStartCursor?: GameStartCursor
}

/** 판정을 부르는 상태 틱 (0x29520 `cmp r3,#0xa`) */
const TOP_MENU_REWARD_TICK = 10

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
 * ⚠️ 아랫단에는 **바탕 띠**(오른쪽 80px, 바닥에서 160px 올라오는 #192E74 그라데이션)가 바퀴 위·
 *    릴 글자 아래에 깔린다. 자라는 동안(넉 틱)은 릴 줄을 안 그린다 — 원본 0x254d8 그대로다.
 *    장면이 게임시작 목록으로 바로 설 때(`openTier` 5)만 켜진다 (`model/useMenuBand.ts` 주석 참고).
 *
 * ⚠️ 원본 좌표대로 놓으면 아랫단 슬롯 5·6·7(y 360·380·400)과 **설명 판 아래 절반이 화면 밖**이다.
 *    보이는 것은 위 세 줄 + 판 윗동강뿐이다. 값을 비틀지 않았다 — `mainMenuLayout.ts` 주석 참고.
 */
export function MainMenuScreen({
  hasSavedGame,
  isGeneralGameInProgress = false,
  lastPlayedMode = 1,
  onNewGame,
  nariGameReady,
  onResumeNariGame,
  onSelectMode,
  onBack,
  onHelp,
  onSettings,
  onSpecial,
  onTopMenuTenthTick,
  overlay,
  gamePoint,
  openTier = 4,
  gameStartCursor,
}: MainMenuScreenProps) {
  const { state, dispatch } = useMainMenu(hasSavedGame, false, (effect) => {
    if (effect === '나리타자편') onNewGame('타자편')
    else if (effect === '나리투수편') onNewGame('투수편')
    else if (effect === '나리타자편경기') (onResumeNariGame ?? onNewGame)('타자편')
    else if (effect === '나리투수편경기') (onResumeNariGame ?? onNewGame)('투수편')
    else if (effect === '미션') onSelectMode('미션')
    else if (effect === '홈런더비') onSelectMode('홈런더비')
    else if (effect === '시즌모드') onSelectMode('시즌모드')
    else if (effect === '일반모드') onSelectMode('일반모드')
    else if (effect === '일반모드빠른실행') onSelectMode('일반모드빠른실행')
    // 일반모드 중간 저장 이어하기 — 상태 0x27 → 0x327b8(this, 1) → 0x213c0(앱, 1, 0) → 장면 0x104
    else if (effect === '일반모드경기이어하기') onSelectMode('일반모드경기이어하기')
    else if (effect === '스페셜') onSpecial()
    else if (effect === '도움말') onHelp()
    else if (effect === '환경설정') onSettings()
    else onBack()
  }, { isGeneralGameInProgress, lastPlayedMode, ...(nariGameReady === undefined ? {} : { nariGameReady }) },
  openTier, gameStartCursor)
  const origins = useFrameOrigins(`${MAIN_UI}/frames`)
  const textOrigins = useFrameOrigins(`${IMG_TEXT}/frames`)

  const isWheel = state.tier === 4

  const tenthTickRef = useRef(onTopMenuTenthTick)
  tenthTickRef.current = onTopMenuTenthTick
  useEffect(() => {
    if (!isWheel) return undefined
    const timer = window.setTimeout(() => tenthTickRef.current?.(), millisecondsPerFrame() * TOP_MENU_REWARD_TICK)
    return () => window.clearTimeout(timer)
  }, [isWheel])
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

  // 아랫단 바탕 띠 — 자라는 동안은 릴 줄을 안 그린다 (0x254d8 이 줄 묶음을 통째로 건너뛴다)
  // 연출은 장면이 게임시작 목록으로 바로 설 때(`[0x140006c]` = 5)만 켜진다 — 생성자 0x2381c~0x23846
  const isBandSeededRef = useRef(openTier === 5)
  const band = useMenuBand(!isWheel, isBandSeededRef.current)

  const panelText = state.lockedNotice ?? selected?.description ?? ''

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
  const reelLabels = isWheel || band.isGrowing ? [] : MENU_REEL_SLOTS.map((slot) => {
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

      {/* 바탕 띠 — 바퀴 위, 릴 글자 아래. 자라는 동안은 아래 릴 줄이 비어 있다 (원본 0x254d8) */}
      {!isWheel && <MenuBand spread={band.spread} />}

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

      {/* 머리띠·바닥띠는 두 단 다 마지막에 그린다 — 윗단 바닥 1(뒤로 표시 없음) · 아랫단 바닥 5(뒤로 표시).
          미끄러짐은 [skin+0x84] 가 서 있을 때만 [skin+0x86] 을 두 배씩 키운다(0x54df0~0x54e1e) — 그 둘을 세우는 곳은
          다른 하위 상태의 들어옴(3 0x258fc · 0x23f5c · 0x24804 …)뿐이고 하위 4 들어옴 0x24a40 · 5 들어옴 0x25b88 은 안 건드린다.
          곧 두 단을 오가도 머리띠는 다시 내려오지 않는다 — 같은 ScreenFrame 을 그대로 두어 미끄러짐을 이어 간다 */}
      {gamePoint !== undefined && (
        <ScreenFrame title="2010프로야구" gamePoint={gamePoint}
          onBack={isWheel ? null : () => dispatch({ type: '뒤로' })} />
      )}

      {state.lockedNotice !== null && (
        <div className={styles.confirmKeys}>
          {/* 원본 확인 팝업(0x74ef5 종류 1)은 아무 키나 받아 닫는다 */}
          <button type="button" onClick={() => dispatch({ type: '시작' })}>확인</button>
        </div>
      )}

      {/* 나만의리그 편 고르기 창 [14] — 하위 13 */}
      {state.isPickingNariEdition && (
        <MessageBox
          text={NARI_EDITION_PROMPT}
          buttons={NARI_EDITION_BUTTONS}
          buttonFrames={NARI_EDITION_BUTTON_FRAMES}
          grid={NARI_EDITION_GRID}
          cancelAnswer={NARI_EDITION_CANCEL}
          onAnswer={(answer) => dispatch({ type: '창답', answer })}
        />
      )}

      {/* 일반모드 진입 창 — 하위 12 그리기도 게임시작 목록 위에 상자를 얹는다 */}
      {state.generalModeWindow?.kind === '진입' && (
        <MessageBox
          text={GENERAL_MODE_PROMPT}
          buttons={GENERAL_MODE_BUTTONS}
          buttonFrames={GENERAL_MODE_BUTTON_FRAMES}
          grid={GENERAL_MODE_GRID}
          cancelAnswer={GENERAL_MODE_CANCEL}
          initialSelected={state.generalModeWindow.initialSelected}
          onAnswer={(answer) => dispatch({ type: '창답', answer })}
        />
      )}
      {state.generalModeWindow?.kind === '새로하기확인' && (
        // 종류 0x82 = 예/아니오 (0x82 & 0x1f = 2). CLR 은 1(아니오) 로 넣는다 (0x298e0~0x298ea) — 상자 기본값과 같다
        <MessageBox
          text={NEW_GAME_CONFIRM}
          buttons={['예', '아니오']}
          initialSelected={NEW_GAME_CONFIRM_CURSOR}
          onAnswer={(answer) => dispatch({ type: '창답', answer })}
        />
      )}

      {/* 취소 — 아랫단이면 윗단으로, 윗단이면 타이틀로 (원본은 CLR 키다, 버튼은 웹 임시).
          머리띠를 그리면 아랫단은 바닥띠 뒤로 표시(바닥 5)가 같은 일을 하므로 이 임시 버튼은 윗단에만 둔다 */}
      {(gamePoint === undefined || isWheel) && <button type="button" data-turn={`${turn.direction}/${turn.counter}/${turn.fromCursor}/${scroll}`} className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
        {state.tier === 5 ? '‹ 처음 메뉴' : '‹ 타이틀'}
      </button>}

      {overlay}
    </RawScreen>
  )
}
