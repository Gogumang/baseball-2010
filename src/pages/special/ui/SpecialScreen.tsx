import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type {
  Collection, HallOfFamePlayerPick, HallOfFameResult, HallOfFameSide,
} from '@/entities/collection/model/collection'
import {
  firstEmptyHallOfFameSlot, hallOfFameBatterAt, hallOfFamePitcherAt, isHallOfFameSlotOpen,
} from '@/entities/collection/model/collection'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import {
  FOOTER, HALL_OF_FAME_BUBBLE, HALL_OF_FAME_CHART, HALL_OF_FAME_DETAIL, HALL_OF_FAME_GRID,
  HALL_OF_FAME_PITCHER_SLOTS, HALL_OF_FAME_SLOTS, HALL_OF_FAME_SLOT_ART, HALL_OF_FAME_TAGS,
  HEADBAND, ITEM_COUNT, NARI_BATTER_SLOT, NARI_PITCHER_SLOT, SCREEN, SLT_FRAME, SPECIAL_ITEMS, SPECIAL_REEL_STATE,
  hallOfFameBubblePositionOf, hallOfFameCellOf, HALL_OF_FAME_CHART_MAXIMUM_LENGTH, HALL_OF_FAME_CELL_ART, hallOfFameCellImagesOf,
  hallOfFameCellImageTopLeftOf, isHallOfFameCellDimmed,
  hallOfFameEntryOfSlot, hallOfFameKeyCodeOf, HOME_RUN_DERBY_FIRST_ROW_Y,
} from '@/pages/special/lib/specialLayout'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FRAME_SLIDE_END, frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import { MenuWheel } from '@/pages/main-menu/ui/MenuWheel'
import { MenuWheelUnderlayImage } from '@/pages/main-menu/ui/MenuWheelUnderlayImage'
import {
  MENU_DESCRIPTION_PANEL, MENU_PANEL_HEADING_COLOR, MENU_REEL_ITEM_FRAMES, MENU_REEL_SCROLL_STEPS,
  MENU_REEL_SHADOW_COLOR, MENU_REEL_SHADOW_OFFSET, MENU_REEL_SLOTS,
  menuPanelHeadingFrameOf, menuPanelHeadingTopLeftOf, menuPanelLabelTopLeftOf, menuReelEntryAtSlotOf, menuReelFrameListOf,
  menuReelSlotRowOf, menuReelTextTopLeftOf, menuWheelLabelTopLeftOf, menuWheelRestingLabelsOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import { useMenuBand } from '@/pages/main-menu/model/useMenuBand'
import { useMenuTurn } from '@/pages/main-menu/model/useMenuTurn'
import { MenuBand } from '@/pages/main-menu/ui/MenuBand'
import * as menuStyles from '@/pages/main-menu/ui/MainMenuScreen.css'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { TOP_ENTRIES } from '@/pages/main-menu/model/mainMenu'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useCursorShake } from '@/shared/lib/cursorShake/useCursorShake'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { SkinBackdropKind } from '@/pages/special/ui/SkinBackdrops'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { footerBottomOf, headerTopOf } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { HallOfFameFigure, useHallOfFameFigure } from '@/pages/special/ui/HallOfFameFigure'
import { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import type { HallOfFameListOwner } from '@/pages/special/ui/HallOfFameFigure'
import { HALL_OF_FAME_FIGURE_TEAM } from '@/pages/special/lib/hallOfFameFigure'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsDirection, AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
import type { SecretCodeState } from '@/pages/record/lib/statCells'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'

const MAIN_UI = './sprites/main_ui'
const MAIN_UI_FRAMES = `${MAIN_UI}/frames`
const GAME_FRAME = './sprites/game_frame'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
/** ui/team_logo.pzx — 메뉴 진입 0x24924 가 [this+0xa8] 에 올려 0x663c5 로 목록에 넘긴다 */
const TEAM_LOGO = './sprites/team_logo'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

type SpecialView = '목록' | '기록연감' | '명예의 전당' | '마선수선택' | '에디트'

interface SpecialScreenProps {
  readonly collection: Collection
  /**
   * **스페셜 마선수 선택** (하위 상태 28 — 그리기 0x2df78 · 갱신 0x2af20): 마선수 오픈·레벨업 격자.
   * 화면은 `pages/general-mode` 의 마선수 고르기(`mode="레벨업"`)라 앱이 꽂아 준다.
   * `onBack` 은 CLR — 원본도 상태 6(이 목록)으로 돌아간다 (0x2b126 → 0xbcb49(…, 6)).
   * 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderAceSelect?: (onBack: () => void) => ReactNode
  /**
   * **스페셜 에디트** (하위 상태 29 — 갱신 0x2b2e0 · 그리기 0x2e1e0): 선수 이름 바꾸기.
   * 화면은 `pages/special-edit` 이라 앱이 꽂아 준다. `onBack` 은 팀 고르기의 CLR — 원본도 상태 6(이 목록)으로
   * 돌아간다 (0x2b432 `0xbcb49(this+0x18, 6)`). 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderEdit?: (onBack: () => void) => ReactNode
  /** 명예의 전당 말풍선 "슬롯에서 삭제" (0x2ac00 · 0x62994). 안 넘기면 안내만 띄운다 */
  readonly hallOfFameDeletion?: HallOfFameDeletion
  /**
   * 전역 G(`mgr+0x64`) — 머리띠 0x54d95 는 제목이 −1 이 아니면 오른쪽 위에 G포인트(0x54a60)를 그린다(0x550d8~0x550de).
   * 스페셜 목록(하위 6, 0x2860c → `0x54d95(skin, 0, 5)`)과 명예의 전당(하위 27, 0x2dcd8 → `0x54d95(skin, 16, 5)`)이 다 그렇다.
   * 넘기면 두 화면 머리띠를 G 까지 그리고, 안 넘기면 예전처럼 제목 0 띠만(G 없음) 그린다.
   */
  readonly gamePoint?: number
  /** 기록연감 비밀 번호 상태 — 메뉴 객체에 사는 값이라 들고 있는 쪽(메인 메뉴)이 넘긴다 (`RecordAnnals` 참고) */
  readonly annalsSecretCode?: SecretCodeState
  readonly onAnnalsSecretCodeChange?: (next: SecretCodeState) => void
  /**
   * 바탕 띠 `[메뉴+0xe4]` 가 이미 다 자랐는가 — 같은 장면에서 띠가 자란 뒤 다시 서는 경우(되돌리는 코드가 없다).
   * 안 넘기면 처음 메뉴 OK(0x294b8 — 칸이 무엇이든 [0xe2] · [0xe4] = 1)로 막 내려온 것이라 1 부터 자란다
   */
  readonly isBandGrown?: boolean
  readonly onBack: () => void
}

/**
 * 원작 메인 메뉴 [스페셜] = 하위 상태 6 (그리기 0x2860c — P6 2d).
 *
 * 반원 바퀴(0x24b1c) 위에 **하위 목록 0x2524c** 여덟 칸이 오른쪽 세로로 서고, 머리띠 0x54d95(제목 0
 * "2010프로야구", 바닥 5 = 되돌아가기)가 위아래를 덮는다. 칸 그림은 main_ui 프레임
 * **15 G포인트충전 · 16 G포인트선물 · 17 친구추천 · 18 명예의전당 · 19 마선수선택 · 20 에디트 ·
 * 21 기록연감 · 28 선물받기** (표 0xceb2f 확정).
 *
 * 오프라인 웹판에서 실제로 도는 칸은 **명예의전당·마선수선택·에디트·기록연감** 넷뿐이지만, 원본에 있는 칸을 지우지 않고
 * 여덟 칸을 다 그린다. 나머지(통신 기능 = 충전·선물·친구추천·선물받기)는 흐리게 그리고 누르면 안내를 띄운다.
 * 마선수선택(상태 28)은 앱이 `renderAceSelect` 로, 에디트(상태 29)는 `renderEdit` 로 꽂는다.
 *
 * 바퀴는 메인 메뉴의 `MenuWheel`(도는 공 + 호)에 칸 글자(0x24f9e~0x24fe2 — 메인 메뉴 `wheelLabels` 와 같은 꼴)를 얹는다.
 * 하위 6 에서는 바퀴가 돌지 않고 배열 `[0x1552d4c]` 는 윗단에서 [스페셜] 을 고른 그대로라 [스페셜] 이 0°(안 그림)에 있다
 * — 나머지 다섯 칸이 45·90·180·270·315° 에 선다(`menuWheelRestingLabelsOf`).
 *
 * 목록은 메인 메뉴 아랫단과 **같은 세로 릴 0x2524c(this, 6, 틱)** 이다(`specialLayout` 의 `SPECIAL_REEL_STATE` 머리말, 직접 떴다):
 * 그리기 0x2860c 가 0x24b1c(바퀴) → 0x2524c → 머리띠 차례로, 게임시작 목록 0x2863c 와 목록 종류만 다르다. 그래서 바탕은 메인 메뉴
 * 아랫단과 같다 — 배너 · 바퀴 · 바퀴 칸 글자 · **바탕 띠**(처음 메뉴 OK 0x294b8 이 칸이 무엇이든 [0xe2] · [0xe4] = 1 을 넣어
 * 1 → 4 → 16 → 64 → 160 으로 자란다, 자라는 동안은 줄 · 설명 띠를 안 그리고 키도 버린다 0x28ba0~0x28bb4).
 * 줄은 슬롯 1·2·3 (y 213 · 233 · 253) 에 커서 −3 · −2 · −1 칸, 고른 칸은 슬롯 4 라 안 그리고 설명 판(96, 289)이 대신 보인다.
 * 슬롯 5·6·7 은 화면 밖이다(원본 그대로). ↑ · ↓ 는 릴을 돌린다(스크롤 ±1 · ±4 · ±16 뒤 회전).
 * 바탕은 판 0x24b1c 가 맨 먼저 찍는 메뉴 바탕 0x58371(skin, [메뉴+0x90] main_title, 0)(0x24c9c)이다 — 예전 웹의 mode_back/000 배너는
 * 원본에 없다(mode_back 은 0x7b8ec 만 싣고, 그리기 0x7b9ac 를 부르는 곳은 0x7d34c · 0x84928 · 0x88572 · 0x88d76 뿐, 2026-10-15 r97 직접 뜸).
 */
export function SpecialScreen({
  collection, renderAceSelect, renderEdit, hallOfFameDeletion, gamePoint, annalsSecretCode, onAnnalsSecretCodeChange,
  isBandGrown = false, onBack,
}: SpecialScreenProps) {
  const [view, setView] = useState<SpecialView>('목록')
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  /** 설명 판 까딱임 — 표 0xce8bc · 0xce88c (`specialLayout` 의 까딱임 주석) */
  const panelShake = useCursorShake(useUpdateCounter())
  /** 바탕 띠 [메뉴+0xe4] — 처음 메뉴 OK(0x294b8)가 1 로 두고 이 화면에서 자란다. 하위 화면을 다녀와도 되돌리지 않는다 */
  const band = useMenuBand(true, isBandGrown)
  /** 릴 돌기 — 스크롤 석 장 뒤 회전 (0x25386) */
  const turn = useMenuTurn(cursor, ITEM_COUNT, MENU_REEL_SCROLL_STEPS.length)
  /** 도는 동안은 돌기 전 배열을 그린다 */
  const shownCursor = turn.direction === null ? cursor : turn.fromCursor
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)

  const openItem = (index: number) => {
    const item = SPECIAL_ITEMS[index]
    setCursor(index)
    if (item.availability !== '됨') return setNotice(item.blockedText ?? '')
    if (item.id === '마선수선택') return renderAceSelect === undefined ? undefined : setView('마선수선택')
    if (item.id === '에디트') return renderEdit === undefined ? undefined : setView('에디트')
    setView(item.id === '기록연감' ? '기록연감' : '명예의 전당')
  }

  useEffect(() => {
    if (view !== '목록' || notice !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 0x28ba0~0x28bb4 — 바탕 띠가 자라는 동안([메뉴+0xe2] ≠ 0)은 키를 통째로 버린다
      if (band.isGrowing) return
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        // 갱신 0x28b9c: ↑ · ↓ 가 [메뉴+0xf4] = 1 을 세우고 0x5550d 로 방향을 적는다 → 그리기 머리 0x252c6 가 까딱임을 건다
        panelShake.start(step > 0 ? 'down' : 'up')
        return setCursor((previous) => (previous + step + ITEM_COUNT) % ITEM_COUNT)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return openItem(cursor)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (view === '기록연감') {
    return (
      <RecordAnnals collection={collection} {...(gamePoint === undefined ? {} : { gamePoint })}
        {...(annalsSecretCode === undefined ? {} : { secretCode: annalsSecretCode })}
        {...(onAnnalsSecretCodeChange === undefined ? {} : { onSecretCodeChange: onAnnalsSecretCodeChange })}
        // 하위 30 그리기 0x2e29c 도 맨 앞(0x2e2b6)에 메뉴 바탕 0x58371 을 깐다
        underlay={<SkinBackdrop kind="메뉴바탕" />}
        onBack={() => setView('목록')} />
    )
  }

  if (view === '마선수선택' && renderAceSelect !== undefined) {
    return <>{renderAceSelect(() => setView('목록'))}</>
  }

  if (view === '에디트' && renderEdit !== undefined) {
    return <>{renderEdit(() => setView('목록'))}</>
  }

  if (view === '명예의 전당') {
    const mode: HallOfFameMode = hallOfFameDeletion === undefined
      ? { kind: '보기' }
      : { kind: '보기', deletion: hallOfFameDeletion }
    // 하위 27 그리기 0x2dcd8: 배경 0x58371 · 목록 k 8 · 머리띠 0x54d95(skin, 16 "명예의전당", 5)
    return (
      <HallOfFameScreen collection={collection} mode={mode} onBack={() => setView('목록')}
        {...(gamePoint === undefined ? {} : { frame: { title: '명예의전당', gamePoint } })} />
    )
  }

  const selected = SPECIAL_ITEMS[cursor]
  const { dx: shakeDx, dy: shakeDy } = panelShake.offset
  const panel = { x: MENU_DESCRIPTION_PANEL.x + shakeDx, y: MENU_DESCRIPTION_PANEL.y + shakeDy }
  /** 판 안 큰 글자 자리 — 프레임 크기는 PNG 머리에서 읽어 둔 `labelWidth` · `labelHeight` (0x25794~0x257c4 가운데 + (2, 5)) */
  const panelLabelAt = menuPanelLabelTopLeftOf(selected.labelWidth, selected.labelHeight)
  const headingFrame = menuPanelHeadingFrameOf(SPECIAL_REEL_STATE)
  const headingSize = headingFrame === null ? null : textOrigins?.[String(headingFrame).padStart(3, '0')] ?? null
  /** 단색으로 찍는 글자 (원본 효과 0xb) — 그림을 마스크로 쓰고 색을 칠한다 */
  const tinted = (src: string, left: number, top: number, width: number, height: number, color: string) => (
    <div className={menuStyles.tintedLabel}
      style={{ left, top, width, height, background: solidColorCss(color), maskImage: spriteMaskImage(src), WebkitMaskImage: spriteMaskImage(src) }} />
  )

  // ── 세로 릴 0x2524c(…, 6) — 슬롯 1·2·3 · 5·6·7 (4 는 판이 대신) ──
  /** ↑(−1) 면 +, ↓(−2) 면 − 로 민다 (0x2534c) */
  const scroll = turn.direction === null ? 0 : (turn.direction === -1 ? 1 : -1) * (MENU_REEL_SCROLL_STEPS[turn.counter] ?? 0)
  const reelLabels = band.isGrowing ? [] : MENU_REEL_SLOTS.map((slot) => {
    const entryIndex = menuReelEntryAtSlotOf(REEL_FRAMES, REEL_SLOT_ROW, shownCursor, slot)
    if (entryIndex === null) return null
    const frame = REEL_FRAME_LIST[entryIndex]
    const item = SPECIAL_ITEMS[entryIndex]
    const size = textOrigins?.[String(frame).padStart(3, '0')] ?? null
    if (size === null || item === undefined) return null
    const topLeft = menuReelTextTopLeftOf(slot, size.width, scroll)
    if (topLeft === null) return null
    const src = imageSrc(IMG_TEXT_FRAMES, frame)
    return (
      <div key={item.id} data-reel-slot={slot}>
        {/* 그림자를 #212B70 으로 (+1,+1) 에 먼저 찍고 진짜 글자를 원색으로 덮는다 (0x255c8) */}
        {tinted(src, topLeft.x + MENU_REEL_SHADOW_OFFSET.x, topLeft.y + MENU_REEL_SHADOW_OFFSET.y, size.width, size.height,
          MENU_REEL_SHADOW_COLOR)}
        <button type="button" aria-label={item.id} className={menuStyles.menuRow} data-frame={frame}
          style={{ left: topLeft.x, top: topLeft.y }}
          // ⚠️ 웹 조작 — 누르면 고르기만 한다(원본은 키패드뿐). 여는 것은 설명 판 누름(OK)이다
          onClick={() => (band.isGrowing ? undefined : setCursor(entryIndex))}>
          <img src={src} alt="" />
        </button>
      </div>
    )
  })

  return (
    <RawScreen>
      {/* 메뉴 바탕 0x58371(skin, main_title, 0) — 판 0x24b1c 의 첫 그림(0x24c9c), 메인 메뉴와 같다 */}
      <SkinBackdrop kind="메뉴바탕" />
      {/* 반원 바퀴 0x24b1c 의 바닥 — 가운데에서 도는 main_ball 애니 0 + 테두리 원 3겹 (120, 320) 반지름 93·95·97. 메인 메뉴와 같은 그림 */}
      <MenuWheel />
      <SpecialWheelLabels />
      {/* 바탕 띠 — 바퀴 위, 릴 글자 아래 (0x253e8~0x2548e) */}
      <MenuBand spread={band.spread} />
      {reelLabels}

      {/* 설명 판 = main_ui 이미지 3 (149×63) 을 (96, 289) — 아래 절반은 화면 밖(원본 그대로). 판 안 큰 글자 = main_ui 프레임(0x25774) */}
      <img className={styles.sprite} alt="" data-testid="스페셜-설명판" src={imageSrc(MAIN_UI, MENU_DESCRIPTION_PANEL.frame)}
        style={{ left: panel.x, top: panel.y }} />
      <EffectImage
        className={`${styles.sprite} ${selected.availability === '됨' ? '' : styles.dimmed}`}
        effect={selected.availability === '됨' ? null : DRAW_EFFECT.GRAY}
        src={imageSrc(MAIN_UI_FRAMES, selected.labelFrame)}
        style={{ left: panelLabelAt.x + shakeDx, top: panelLabelAt.y + shakeDy }} />
      {/* 판 왼쪽 위 회색 제목 img_text 1 "스페셜" (0x257cc~0x257ee) */}
      {headingFrame !== null && headingSize !== null && tinted(
        imageSrc(IMG_TEXT_FRAMES, headingFrame), menuPanelHeadingTopLeftOf().x + shakeDx, menuPanelHeadingTopLeftOf().y + shakeDy,
        headingSize.width, headingSize.height, MENU_PANEL_HEADING_COLOR,
      )}
      {/* 설명 띠 0x55545(StrMAINMENU[0x10 + 커서]) — 0x2524c 맨 끝. 띠가 자라는 동안은 안 그린다 */}
      {!band.isGrowing && <DescriptionBand text={selected.description} seed={cursor} />}
      {/* 설명 판 = 고른 칸 — 투명 누름 칸으로 OK (바닥띠 되돌아가기 x 206~ 는 비워 둔다) */}
      {notice === null && (
        <PressArea label={`${selected.id} 열기`} onPress={() => (band.isGrowing ? undefined : openItem(cursor))}
          rect={{ x: MENU_DESCRIPTION_PANEL.x, y: MENU_DESCRIPTION_PANEL.y, width: 200 - MENU_DESCRIPTION_PANEL.x, height: 320 - MENU_DESCRIPTION_PANEL.y }} />
      )}

      {gamePoint === undefined
        ? <SpecialBands onBack={onBack} />
        : <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={onBack} slides={false} />}

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}

/** 상태 6 릴 표 — 글자 0xcea24 · 슬롯 0xceaf2[1] */
const REEL_FRAMES = MENU_REEL_ITEM_FRAMES[SPECIAL_REEL_STATE] ?? []
const REEL_FRAME_LIST = menuReelFrameListOf(REEL_FRAMES)
const REEL_SLOT_ROW = menuReelSlotRowOf(SPECIAL_REEL_STATE)

/** [스페셜] 칸 — 윗단 배열 `[0x1552d4c]` 를 이 칸이 0번(0°)에 오도록 돈 커서 */
const SPECIAL_WHEEL_CURSOR = TOP_ENTRIES.findIndex((entry) => entry.id === '스페셜')

/**
 * 반원 바퀴 0x24b1c 의 칸 — 자리 5 → 0 차례로 main_ui 이미지 0 밑판을 찍고 그 위에 img_text 프레임 글자를 기준점 가운데
 * (0x24fc4: x − w/2, y − h/2)에. 하위 6 은 키가 바퀴를 안 돌려 누를 수 없는 그림이다(메인 메뉴 아랫단의 `disabled` 칸과 같다).
 */
function SpecialWheelLabels() {
  const origins = useFrameOrigins(IMG_TEXT_FRAMES)
  return (
    <>
      {[...menuWheelRestingLabelsOf(SPECIAL_WHEEL_CURSOR)].reverse().map((label) => {
        const underlay = <MenuWheelUnderlayImage key={`${label.entryIndex}-밑판`} underlay={label.underlay} />
        const size = origins?.[String(label.frame).padStart(3, '0')]
        if (size === undefined) return underlay
        const topLeft = menuWheelLabelTopLeftOf(label.point, size.width, size.height)
        return [
          underlay,
          <img
            key={label.entryIndex}
            className={styles.sprite}
            alt=""
            data-wheel-label={TOP_ENTRIES[label.entryIndex]?.id}
            src={imageSrc(IMG_TEXT_FRAMES, label.frame)}
            style={{ left: topLeft.x, top: topLeft.y }}
          />,
        ]
      })}
    </>
  )
}

/**
 * 머리띠·바닥띠 0x54d95(skin, 0, 5) — 제목 "2010프로야구" + 바닥 되돌아가기 (P6 1-1). G포인트를 받지 않은 화면(시험 · 머리띠를
 * 안 넘긴 부르는 쪽)이 `ScreenFrame` 대신 쓴다.
 *
 * `slides` 면 0x54d95 가 그릴 때마다 +0x86 을 두 배로 해(0x54dfe~0x54e08) 머리띠는 위에서 · 바닥띠는 아래에서 미끄러져 들어온다
 * — `ScreenFrame` 과 같은 `frameSlideOf` · `headerTopOf` · `footerBottomOf` 로 다 내려온 자리(머리 −8 · 바닥 320)에서 민다.
 * 공용 목록 0x63b14 를 부르는 명예의 전당(스페셜 27 · 나리 145 0x15d54 = 0x63b15(…, 6, 1, [this+0x2c], −1))은 틱 0 에
 * +0x84 = 1 · +0x86 = 1 을 세워(0x63ba0~0x63bb4) 미끄러지고, 스페셜 목록 6 은 세우지 않아(ScreenFrame `slides` 머리말) 안 미끄러진다.
 */
function SpecialBands({ onBack, slides = false }: { readonly onBack: () => void; readonly slides?: boolean }) {
  const updates = useUpdateCounter(slides)
  const slide = slides ? frameSlideOf(updates) : FRAME_SLIDE_END
  const dyTop = headerTopOf(slide) - headerTopOf(FRAME_SLIDE_END)
  const dyBottom = footerBottomOf(slide) - footerBottomOf(FRAME_SLIDE_END)
  return (
    <>
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={HEADBAND.band.y + dyTop} width={SCREEN.width} height={HEADBAND.band.height} fill={HEADBAND.band.color} />
        <rect x={0} y={HEADBAND.line.y + dyTop} width={SCREEN.width} height={HEADBAND.line.height} fill={HEADBAND.line.color} />
        <rect x={0} y={FOOTER.band.y + dyBottom} width={SCREEN.width} height={FOOTER.band.height} fill={FOOTER.band.color} />
        <rect x={0} y={FOOTER.line.y + dyBottom} width={SCREEN.width} height={1} fill={FOOTER.line.color} />
      </svg>
      {HEADBAND.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.tileImage)} style={{ left: x, top: HEADBAND.tileY + dyTop }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.cornerImage)} style={{ left: HEADBAND.cornerX, top: HEADBAND.tileY + dyTop }} />
      <img className={styles.sprite} alt="" data-testid="스페셜-머리띠-제목" src={imageSrc(GAME_FRAME, HEADBAND.title.image)}
        style={{ left: HEADBAND.title.x, top: HEADBAND.title.y + dyTop }} />
      {FOOTER.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.tileImage)} style={{ left: x, top: FOOTER.tileY + dyBottom }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.cornerImage)} style={{ left: FOOTER.cornerX, top: FOOTER.tileY + dyBottom }} />
      <button
        type="button"
        className={styles.backButton}
        aria-label="되돌아가기"
        style={{ left: FOOTER.backIcon.x, top: FOOTER.backIcon.y + dyBottom }}
        onClick={onBack}
      >
        <img src={imageSrc(GAME_FRAME, FOOTER.backIcon.image)} alt="" />
      </button>
    </>
  )
}

/** 등록 목록에서 나리 선수 칸(0·5)에 그릴 선수 — 저장이 없으면 null (칸 상태 2) */
export interface HallOfFameNariPlayer {
  readonly name: string
  /** `0xb6415(기록, k, 1)` — 능력치 도형 값 */
  readonly equippedAbility: readonly number[]
  /**
   * A 자리 몸 그림 — 나리 저장 기록의 폼·피부·장비 니블과 **나리 저장의 팀**(목록 +0x4c4 투수 · +0x4c0 타자, 0x5ec0a · 0x5ec60).
   * 칸 0·5 는 그 팀의 team_logo 도 A 가운데에 찍는다. 안 넘기면 몸 그림·로고를 안 그린다.
   */
  readonly figure?: HallOfFameFigureLook
}

/** 명예의 전당 목록의 두 쓰임 */
export type HallOfFameMode =
  /** 스페셜 명예의 전당 — 하위 상태 27, 목록 종류 2 (0x26024). `deletion` 을 넘기면 말풍선 "슬롯에서 삭제" 가 돈다 */
  | { readonly kind: '보기'; readonly deletion?: HallOfFameDeletion }
  /**
   * 엔딩 뒤 등록 — 나리 상태 145, 목록 종류 3 (0x1c91e). 키는 0x62568 이 `0x5eae0` 결과 코드와 모드로 가른다.
   * `onRegister(칸)` 은 칸 번호(없으면 첫 빈 칸)로 등록을 해 보고 결과를 돌려준다. `onDone` 은 등록 뒤 메인 메뉴,
   * `onLater` 는 "나중에 등록" 예.
   */
  | {
      readonly kind: '등록'
      readonly edition: HallOfFameSide
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      readonly onRegister: (slot: number | null) => HallOfFameResult['kind']
      readonly onDone: () => void
      readonly onLater: () => void
      /**
       * **완료 창(꼬리표 0x30)을 닫았을 때의 히든 17** — 0x1ca4c 1cb02~1cb58 (직접 떴다):
       * ```
       * [창+0x248] == 0x30 && 답 == 0 → 답 = −1
       *   0x9f6c1(전역기록, 1, 1)(전광판 히든 칸 1 = id 17 열렸나) 거짓 → 0x62368(ui, 0x11, 0) · [창+0x3ac] = 0x31
       *   참 → 1cb7c [this+0x278] = 1 · 화면 전환 → 메인 메뉴
       * 꼬리표 0x31 창을 닫으면 → 같은 1cb7c
       * ```
       * 열고 알림 창을 띄웠으면 참 — 그 창을 닫을 때 `then`(= `onDone`) 을 부른다. 거짓이면 목록이 곧바로 `onDone`.
       */
      readonly openRegisteredHidden?: (then: () => void) => boolean
    }
  /**
   * **미션 선수 고르기** — 메인 메뉴 하위 17 (진입 0x2613c · 갱신 0x29a54), 목록 종류 0 (`[목록+0x1fc] = 0`, 0x261c2).
   * 0x5eb8c 가 종류 0 이면 나리 칸 0·5(1 있음 / 2 없음)와 명전 칸을 다 채운다. 키는 0x62568 의 종류 ≠ 3 갈래 0x627d4 —
   * 칸 코드 `0x5eae0` 을 표 0xd1da0 로: 1~4 → 결과 [목록+0x12c] = 코드 (0x627ec~0x627f8, `onPick`),
   * 5 → StrCOMMON[38] · 6 → StrCOMMON[39] · 7 → 칸 ≤ 4 ? [45] : [54] 현금 구매(🌐). 되돌아가기는 결과 0 (`onCancel`).
   * 편은 0x5ea1a 가 커서 칸으로 정한다(`[목록+0x288] = 칸 > 4`) — 칸 ≤ 4 가 투수다.
   */
  | {
      readonly kind: '선수고르기'
      /**
       * 어느 창인가 (기본 미션). **홈런더비** = 하위 16 (진입 0x25e6c · 갱신 0x29ac8): 목록 종류 1 이라 0x5eb8c 가
       * 투수 칸 0~4 를 안 채우고(상태 0), 격자는 5열 × **2행**(0x25e96), 키 0x62568 의 셋째 인자 5(0x29ae0)로
       * 칸 번호가 5 부터다 — 타자 칸 5~14 만 고른다. 결과 2·4 만 나온다.
       */
      readonly purpose?: '미션' | '홈런더비'
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      /**
       * 결과 1~4. 글을 돌려주면 목록 위에 알림으로 띄우고 목록에 남는다 — 시즌 선수영입(0xe340)의 중복 StrMODE[181] 자리다.
       */
      readonly onPick: (pick: HallOfFamePlayerPick) => string | undefined | void
      readonly onCancel: () => void
    }

/**
 * 말풍선 "슬롯에서 삭제" (하위 27 갱신 0x2ac00 의 하위 1, OK · 칸 1 — R11 3-1·3-2).
 * ```
 * 막기: 0x213c1(저장, 2, 1) ; team = 0x1f571(저장, 내 팀) ; 0xb50ad(team, 타자?1:0, 칸) && 전역기록+0x4e ≠ 0
 *       → StrMAINMENU[213] (팝업 종류 1, 하위 상태 그대로 — 말풍선이 남는다)
 * 통과: StrMAINMENU[128] 예/아니오 (skin+0x314 = 4) · 하위 0 (말풍선 닫힘)
 * 예(0x62994): 투수 0x22371 · 타자 0x22339 — 시즌 명단 정리 0x221dc 뒤 칸을 0 으로 · 0x5eb8c 다시 채움 · 저장 0x1f1b9 ·
 *       StrCOMMON[46]
 * ```
 * [128] 확인 창은 띄운 바로 뒤 `0x749d5(popup, 1)`(0x2ae42)로 처음 커서를 둘째 칸 **"아니오"** 에 둔다.
 */
export interface HallOfFameDeletion {
  /** 막기 검사 — 그 명전 선수가 시즌 내 팀 명단에 있고(0xb50ac) 시즌모드 경기가 진행 중(전역기록 +0x4e)인가 */
  readonly isBlocked: (side: HallOfFameSide, slot: number) => boolean
  /** "예" — 칸을 비우고 시즌 명단을 정리하고 저장한다 */
  readonly onDelete: (side: HallOfFameSide, slot: number) => void
}

/** 원본 문구 (StrCOMMON · 0xcc214 · StrMODE[219]) */
const HALL_OF_FAME_TEXT = {
  nariFirst: '!C!cFFFFFF나만의리그 선수를!N먼저 등록해야합니다', // StrCOMMON[38]
  confirm: '!C!cffffff명예의 전당에 선수를!N등록하시겠습니까?!N(!cFFFF0020000 G포인트 소모!cFFFFFF)', // StrCOMMON[50]
  full: '!C!cffffff명예의 전당에!N빈슬롯이 없습니다', // StrCOMMON[51]
  done: '!C!cffffff명예의 전당에!N등록이 완료되었습니다', // StrCOMMON[52]
  shortage: '!C!cFF0000G포인트가 부족합니다.!cFFFFFF 구매!N페이지로 이동하시겠습니까?', // 0xcc214
  later: '!C나중에 등록 하시겠습니까?!N메인 메뉴로 이동합니다', // StrMODE[219]
  deleteConfirm: '!C!cFFFFFF현재 명예선수를!N삭제 하시겠습니까?!N(!cFF0000삭제 시 복구 불가!cFFFFFF)', // StrMAINMENU[128]
  deleteBlocked: '!C!cFFFFFF시즌모드 경기 진행 중에는!N삭제 하실 수 없습니다', // StrMAINMENU[213]
  deleted: '!C!cffffff선수를 삭제하였습니다', // StrCOMMON[46]
  hallOfFameFirst: '!C!cFFFFFF명예의전당 선수를!N먼저 등록해야합니다', // StrCOMMON[39]
  // StrCOMMON[45] / [54] — 슬롯 현금 구매 (🌐)
  buyPitcherSlots: '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N투수 슬롯 2개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF0000500원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
  buyBatterSlots: '!C!cFFFFFF슬롯을 오픈하여 명예선수를!N추가로 등록할 수 있습니다!N타자 슬롯 4개가 오픈됩니다!N!N!cFFFFFF실제 현금 !cFF00001000원!cFFFFFF의 추가 정보!N이용료 (통화료별도)가 부과!N됩니다. 아이템 구매 중 일부!N시간이 소요 될 수 있으므로!N강제종료 하지 마세요!N!N구매 하시겠습니까?',
} as const

/** 등록 목록에 뜬 팝업 — 0x62568 의 창 종류 [목록+0x314] (0x16 확인 · 0x17 G 부족) 와 알림 */
type HallOfFamePopup =
  | { readonly kind: '확인'; readonly slot: number | null }
  | { readonly kind: 'G부족' }
  | { readonly kind: '나중에' }
  | { readonly kind: '완료' }
  /** 완료 창 뒤 히든 17 알림(꼬리표 0x31)이 공용 창에 떠 있는 동안 — 목록은 키를 안 받고 창이 닫히면 나간다 */
  | { readonly kind: '히든알림' }
  | { readonly kind: '알림'; readonly text: string; readonly buttons: readonly string[] }
  /** 스페셜 말풍선 삭제 확인 StrMAINMENU[128] (skin+0x314 = 4) */
  | { readonly kind: '삭제확인'; readonly side: HallOfFameSide; readonly slot: number }

/**
 * 명예의 전당 목록 (공용 목록 페이지 `0x63b15` 의 k = 8 — P6 2a-3 · S9 3~4절). 스페셜(상태 27)과 엔딩 뒤 등록(나리 상태 145)이 같이 쓴다.
 *
 * 위쪽 A(58,110) 자리에 고른 칸의 선수, B(178,96) 자리에 능력치 도형, 아래쪽에 **5×3 격자 15칸**
 * (`NARI_PITCHER_SLOT` 머리말의 배치). 스페셜에서는 칸을 고르면 **말풍선**(친구에게 선물 / 슬롯에서 삭제)이 뜬다.
 *
 * 찬 칸의 **캐릭터 그림**([skin+0x290])과 **팀 로고**(캐릭터+0x30, 나리 칸 0·5)는 `HallOfFameFigure` · `TeamLogo` 가 A 자리에
 * 그린다 — 원 두 개는 빈 칸 · 잠긴 칸에만 깐다(0x6535a~).
 *
 * ⚠️ **웹에서 못 하는 것**
 *  - "친구에게 선물" 은 통신이 필요해 안내만 띄운다. "슬롯에서 삭제" 는 `deletion`(HallOfFameDeletion) 대로 돈다.
 *    슬롯 현금 구매·G 충전 페이지(🌐)도 열 수 없어 목록으로 돌아온다.
 */
export function HallOfFameScreen({ collection, mode, onBack, frame, backdrop, listOwner }: {
  readonly collection: Collection
  readonly mode: HallOfFameMode
  readonly onBack: () => void
  /**
   * 머리띠를 다른 제목으로 그릴 때 — 머리띠 `0x54d95(skin, 제목, 5)` 는 제목이 −1 이 아니면 G포인트(0x54a60)도 그린다.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 머리띠 객체를 `0x7f53c(hdr, 10, 5, 0)`(0xb8c8~0xb8d6, 0xe2 는 기본 갈래)로
   * 세우고 그리기 0xa10c 끝의 `0x7f4ec(hdr)` 가 `0x54d95(skin, 10 "시즌모드", 5)` 로 그린다. 안 주면 예전 그대로.
   */
  readonly frame?: { readonly title: ScreenFrameTitle; readonly gamePoint: number }
  /**
   * 바탕 — 안 주면 모드로 정한다: 등록(나리 상태 145 — 0x16928 이 `0x5fd61(skin, 0, 0, W, H)`)은 **공무늬**,
   * 보기(하위 27 0x2dcd8) · 선수고르기(미션 하위 17 0x2dec8 · 홈런더비 하위 16 0x2df20)는 **메뉴바탕** `0x58371(skin, main_title, 0)`.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 0xdd · 0xe0 · 0xe1 밖이라 `0x5fd61` — 그 화면은 '공무늬' 를 넘겨야 원본과 같다.
   */
  readonly backdrop?: SkinBackdropKind
  /**
   * 목록 객체 — 몸 그림의 그린 수·머무름·자세([목록+0x40c] · +0x208 · +0x204)가 이 객체 칸이라 화면을 건너 잇는다.
   * 안 주면 등록은 '나리'(나리 [this+0xd8]), 그 밖은 '메뉴'(스킨 [this+0x120]). 시즌 선수영입 0xe2 는 '시즌' 을 넘겨야 원본과 같다.
   */
  readonly listOwner?: HallOfFameListOwner
}) {
  const [slot, setSlot] = useState(initialHallOfFameSlotOf(mode))
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [bubbleCursor, setBubbleCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [popup, setPopup] = useState<HallOfFamePopup | null>(null)

  const slots = hallOfFameSlotsOf(collection, mode)
  const view = hallOfFameGridViewOf(mode)
  const current = slots[slot]
  const cell = hallOfFameCellOf(slot - view.firstSlot, view.firstRowY)
  const { a, b } = HALL_OF_FAME_DETAIL
  const owner = listOwner ?? (mode.kind === '등록' ? '나리' : '메뉴')
  const menuGrid = hallOfFameGridOf(mode, owner)
  const figure = useHallOfFameFigure(owner, {
    slot,
    isBatterSlot: slot >= HALL_OF_FAME_PITCHER_SLOTS,
    look: current.kind === '찬칸' ? current.figure : null,
    // 홈런더비 하위 16 은 그리기 0x32dd8 이 0x669c1 을 부르지 않는다(0x11 · 0x1b 만)
    capturesImage: !(mode.kind === '선수고르기' && mode.purpose === '홈런더비'),
  })
  // 0x63b14 k 6·7·8 — 머리띠가 미끄러지는 동안은 본문이 없고, 본문 첫 그림에 지은 격자가 열림 애니(0x79fa8)를 다 돌 때까지
  // 키 함수(16 0x29ac8 · 17 0x29a54 · 27 0x2ac00 · 시즌 0xe2 0xe340 · 나리 145 0x1ca4c)가 [skin+0xe4] == 0 을 보고 아무것도 안 한다.
  // 부르는 곳(0x2df20 · 0x2dec8 · 0x2dcd8 · 0xa10c · 0x15d54)이 모두 넷째 인자 1 이라 [skin+0xe8] = 1 — 애니가 돈다.
  // 머리띠도 같은 틱 0 에 +0x84 를 세우므로(0x63ba0) `frame` 을 안 받은 `SpecialBands` 도 미끄러진다 — 본문 · 키는 그 다섯 그림 뒤다.
  // 나리 145(0x15d54)의 머리띠는 0x7f4ec([this+0xe0]) — 틀 0x16928 기본 갈래 0x169ea 가 0x7f53c(hdr, [this+0xcc] == 4 ? 8 : 9, 5, 0)
  // 로 세운 제목 8 "나만의리그 타자편" / 9 "투수편" · 바닥 5 · G포인트다(부르는 쪽 EndingScreen 이 `frame` 으로 넘긴다).
  const gridOpenShape = hallOfFameGridOpenShapeOf(view.rows)
  const entry = useListPageEntry({ grid: { shape: gridOpenShape, isAnimated: true } })
  const { keyLock } = entry
  const gridOpen = entry.grid
  const bounce = useGridCursorBounce()
  const teamLogo = current.kind === '찬칸' && (slot === NARI_PITCHER_SLOT || slot === NARI_BATTER_SLOT) && current.figure !== null
    ? current.figure.team : null

  /** 등록 목록의 키 확인 (0x62604~0x627d0) — 결과 코드와 지금 모드(3 투수 · 4 타자)로 가른다 */
  const pressRegisterSlot = (target: number) => {
    if (mode.kind !== '등록') return
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    const entry = hallOfFameEntryOfSlot(target)
    const isMine = (side: HallOfFameSide) => mode.edition === side
    // 1·2 나리 선수 칸 → 첫 빈 칸이 있으면 [50] 확인, 없으면 [51] (0x62630 · 0x626a0)
    if ((code === 1 && isMine('투수')) || (code === 2 && isMine('타자'))) {
      const empty = firstEmptyHallOfFameSlot(collection, mode.edition)
      return setPopup(empty === null ? { kind: '알림', text: HALL_OF_FAME_TEXT.full, buttons: ['확인'] } : { kind: '확인', slot: null })
    }
    // 5 나리 선수 없음 → StrCOMMON[38] (0x62710 — 모드 3 칸 0 · 모드 4 칸 5)
    if (code === 5 && ((isMine('투수') && target === NARI_PITCHER_SLOT) || (isMine('타자') && target === NARI_BATTER_SLOT))) {
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.nariFirst, buttons: ['확인'] })
    }
    // 6 열린 빈 칸 — 자기 편 칸이면 그 칸으로 [50] 확인 (0x62728)
    if (code === 6 && entry !== null && isMine(entry.side)) return setPopup({ kind: '확인', slot: entry.index })
    // 7 잠긴 칸 — 자기 편이면 슬롯 현금 구매 [45]/[54] (0x62772, 🌐)
    if (code === 7 && entry !== null && isMine(entry.side)) {
      const text = entry.side === '투수' ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    // 3·4 명예 선수 칸은 결과 3·4 를 남길 뿐 상태 145 가 그 결과로 하는 일이 없다 (⚠️ 0x1ca4c 가 0·7·팝업만 본다 — 유력)
    return undefined
  }

  /** 선수 고르기의 키 확인 (0x627d4~0x6286c) — 칸 코드 표 0xd1da0 */
  const pressPickSlot = (target: number) => {
    if (mode.kind !== '선수고르기') return undefined
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    const entry = hallOfFameEntryOfSlot(target)
    const pick = (chosen: HallOfFamePlayerPick) => {
      const refusal = mode.onPick(chosen)
      return typeof refusal === 'string' ? setPopup({ kind: '알림', text: refusal, buttons: ['확인'] }) : undefined
    }
    if (code === 1 || code === 2) return pick({ side: code === 1 ? '투수' : '타자', hallOfFameIndex: null })
    if ((code === 3 || code === 4) && entry !== null) return pick({ side: entry.side, hallOfFameIndex: entry.index })
    if (code === 5) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.nariFirst, buttons: ['확인'] })
    if (code === 6) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.hallOfFameFirst, buttons: ['확인'] })
    // 7 잠긴 칸 — 0x6282c: 칸 ≤ 4 면 [45] 투수 슬롯, 아니면 [54] 타자 슬롯 (팝업 종류 4 → 현금 구매 🌐, 웹은 목록으로)
    if (code === 7) {
      const text = target < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    return undefined
  }

  /**
   * 스페셜 목록의 키 확인 — 하위 27 갱신 0x2ac00 도 `0x62569(목록, 키, 0)` 이고 목록 종류 2(≠ 3)라 선수 고르기와 같은
   * 0x627d4 갈래다: 6 → StrCOMMON[39] · 7 → [45]/[54](🌐) 는 0x62568 안에서 띄우고, 결과 3·4(명예 선수 칸)만 0x2ac00 이
   * 하위 1(말풍선, 커서 0)로 받는다. 나리 칸(상태 0)은 코드 0 이라 아무 일이 없다.
   */
  const pressViewSlot = (target: number) => {
    const code = hallOfFameKeyCodeOf(slots[target].state, target)
    if (code === 3 || code === 4) {
      setBubbleCursor(0)
      return setIsBubbleOpen(true)
    }
    if (code === 6) return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.hallOfFameFirst, buttons: ['확인'] })
    if (code === 7) {
      const text = target < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots
      return setPopup({ kind: '알림', text, buttons: ['예', '아니오'] })
    }
    return undefined
  }

  const pressSlot = (target: number) => {
    if (mode.kind === '등록') return pressRegisterSlot(target)
    if (mode.kind === '선수고르기') return pressPickSlot(target)
    return pressViewSlot(target)
  }

  /** 말풍선 OK (0x2ac00 하위 1) — 0 선물(🌐, 안내만) · 1 슬롯에서 삭제 */
  const chooseBubble = (index: number) => {
    const entry = hallOfFameEntryOfSlot(slot)
    if (index !== HALL_OF_FAME_BUBBLE_DELETE || mode.kind !== '보기' || mode.deletion === undefined || entry === null) {
      return setNotice(HALL_OF_FAME_BUBBLE_NOTICES[index])
    }
    // 막히면 [213] 만 띄우고 말풍선은 그대로(하위 상태 그대로), 통과하면 [128] 확인 + 하위 0(말풍선 닫힘)
    if (mode.deletion.isBlocked(entry.side, entry.index)) {
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleteBlocked, buttons: ['확인'] })
    }
    setIsBubbleOpen(false)
    return setPopup({ kind: '삭제확인', side: entry.side, slot: entry.index })
  }

  /** 되돌아가기 — 등록 목록은 결과 0 → StrMODE[219] (0x1ca4c), 선수 고르기는 결과 0 (0x6286e), 스페셜은 상태 6 */
  const goBack = () => {
    if (mode.kind === '등록') return setPopup({ kind: '나중에' })
    if (mode.kind === '선수고르기') return mode.onCancel()
    return onBack()
  }

  useEffect(() => {
    if (notice !== null || popup !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (keyLock.current) return
      if (isBubbleOpen) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          return setBubbleCursor((previous) => 1 - previous)
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          return chooseBubble(bubbleCursor)
        }
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault()
          return setIsBubbleOpen(false)
        }
        return
      }
      // 메인 메뉴 16 · 17 · 27 · 나리 145 · 시즌 0xe2: 키 0x62568 이 격자 [목록+0x134] 의 vt+0x18(0x6c299 → 0x6c521 → 0x6c031,
      // 숫자키 꼴 1)에 넘긴다 — '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK
      const direction: AnnalsDirection | null =
        event.key === 'ArrowRight' || event.key === '6' ? 'right'
        : event.key === 'ArrowLeft' || event.key === '4' ? 'left'
        : event.key === 'ArrowDown' || event.key === '8' ? 'down'
        : event.key === 'ArrowUp' || event.key === '2' ? 'up'
        : null
      if (direction !== null) {
        event.preventDefault()
        const next = view.firstSlot + moveGridCursor(menuGrid, slot - view.firstSlot, direction)
        // 칸이 바뀐 키(커서 +0x25)면 고른 칸을 튕긴다 — 시작 0x7a005(격자, [skin+0xe8], 1, 0) 의 [격자+6] = 1 (0x651e4)
        if (next !== slot) bounce.start(direction)
        return setSlot(next)
      }
      if (event.key === '5') {
        event.preventDefault()
        return pressSlot(slot)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return pressSlot(slot)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  /** 팝업 답 — 확인(0x16)·G 부족(0x17)·나중에(StrMODE[219])·완료(0x30) */
  const answerPopup = (index: number) => {
    // 삭제 확인 "예"(결과 0) → 0x62994: 칸 비우기 · 저장 · StrCOMMON[46]. "아니오" 는 0x62e54 — 창만 닫는다
    if (popup?.kind === '삭제확인' && mode.kind === '보기' && mode.deletion !== undefined) {
      if (index !== 0) return setPopup(null)
      mode.deletion.onDelete(popup.side, popup.slot)
      return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.deleted, buttons: ['확인'] })
    }
    if (popup === null || mode.kind !== '등록') return setPopup(null)
    if (popup.kind === '확인') {
      if (index !== 0) return setPopup(null)
      const result = mode.onRegister(popup.slot)
      if (result === 'G부족') return setPopup({ kind: 'G부족' })
      if (result === '빈칸없음') return setPopup({ kind: '알림', text: HALL_OF_FAME_TEXT.full, buttons: ['확인'] })
      return setPopup({ kind: '완료' })
    }
    if (popup.kind === '나중에') return index === 0 ? mode.onLater() : setPopup(null)
    if (popup.kind === '완료') {
      if (mode.openRegisteredHidden?.(mode.onDone) === true) return setPopup({ kind: '히든알림' })
      return mode.onDone()
    }
    // G 부족 "예" 는 결과 7 → G 충전 페이지 139(🌐) — 웹은 목록으로 돌아온다
    return setPopup(null)
  }

  const popupView = popup === null ? null : popupTextOf(popup)
  const bubble = hallOfFameBubblePositionOf(cell)
  const chartValues = current.kind === '찬칸' ? current.chartValues : []
  const chartCenter = { x: b.x, y: b.y + HALL_OF_FAME_CHART.dy }

  return (
    <RawScreen>
      <SkinBackdrop kind={backdrop ?? (mode.kind === '등록' ? '공무늬' : '메뉴바탕')} />
      {gridOpen !== null && (<>
      {/*
        A 자리 — 빈 칸·잠긴 칸(0x5ea18 이 0, 0x6535a~)만 원 두 개 (A−38 지름 77 · A−31 지름 63) 를 깐다.
        찬 칸(0x6522e~)은 원 없이 나리 칸(0·5)이면 team_logo 프레임 [그림+0x30](= 팀) 을 A 가운데(0x65554~0x65598),
        그 위에 고른 선수 몸 그림 — 타자는 그림을 바로, 투수는 그리기 앞에 0x669c1 → 0x65e80 이 떠 둔 54×75 이미지
        [0x1552ae0] 를 (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) 에 (`lib/hallOfFameFigure.ts`).
      */}
      {current.kind !== '찬칸' && HALL_OF_FAME_SLOT_ART.circles.map((circle) => (
        <div
          key={circle.size}
          className={styles.hofCircle}
          style={{
            left: a.x - circle.offset, top: a.y - circle.offset,
            width: circle.size, height: circle.size, background: circle.color,
          }}
        />
      ))}
      {teamLogo !== null && <TeamLogo team={teamLogo} x={a.x} y={a.y} />}
      <HallOfFameFigure drawing={figure} ax={a.x} ay={a.y} />

      {/* 빈 칸·잠긴 칸 아이콘은 A 가운데 (글러브 23 · 방망이 24 · 자물쇠 31) */}
      {current.kind !== '찬칸' && (
        <img
          className={styles.sprite}
          alt=""
          src={imageSrc(SLT_FRAME, hallOfFameIconOf(slot, current.state).image)}
          style={{
            left: a.x - Math.floor(hallOfFameIconOf(slot, current.state).width / 2),
            top: a.y - Math.floor(hallOfFameIconOf(slot, current.state).height / 2),
          }}
        />
      )}

      {/* 이름 막대 slt_frame 9 (82×15) 을 (A.x−41, A.y+40) + 글 (A.x−41, A.y+42, 폭 82) 가운데 */}
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, HALL_OF_FAME_SLOT_ART.nameBar.image)}
        style={{ left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx, top: a.y + HALL_OF_FAME_SLOT_ART.nameBar.dy }}
      />
      {current.kind === '찬칸' ? (
        <div
          className={styles.hofName}
          style={{
            left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx,
            top: a.y + HALL_OF_FAME_SLOT_ART.nameTextDy,
            width: HALL_OF_FAME_SLOT_ART.nameBar.width,
          }}
        >
          {current.name}
        </div>
      ) : (
        <img
          className={styles.sprite}
          alt={current.state === 5 ? 'LOCK' : 'EMPTY'}
          src={imageSrc(SLT_FRAME, hallOfFameBarLabelOf(current.state).image)}
          style={{
            left: a.x + HALL_OF_FAME_SLOT_ART.nameBar.dx
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.width - hallOfFameBarLabelOf(current.state).width) / 2),
            top: a.y + HALL_OF_FAME_SLOT_ART.nameBar.dy
              + Math.floor((HALL_OF_FAME_SLOT_ART.nameBar.height - hallOfFameBarLabelOf(current.state).height) / 2),
          }}
        />
      )}

      {/*
        딱지 — B(117 파란 막대 + img_text 159 "ABILITY") 만 그린다 (0x65744).
        ⚠️ **A 딱지는 원본도 명예의 전당(k 8)에서 안 그린다.** 공용 목록 0x63b15 가 A 딱지
        플래그 `[sp+0xb4]` 를 기본 1 로 두는데(0x63cea `movs r2,#1`), k 6·7·8·9 갈래가
        0x63da0~0x63da6 에서 0 으로 끈다 — 표 0xd1eac 가 라벨 157/159 를 적어 두어도
        그리는 쪽 0x65764~0x65768 이 `cmp r2,#0; beq` 로 A 를 통째로 건너뛴다.
        (0 으로 쓰는 곳 셋을 전수 확인했다 — A 가 그려지는 k 는 0·1·3·4·5 뿐이다.)
      */}
      {([['b', b] as const]).map(([side, point]) => {
        const tag = HALL_OF_FAME_TAGS[side]
        return (
          <div key={side}>
            <img
              className={styles.sprite}
              alt=""
              src={imageSrc(SLT_FRAME, tag.plate)}
              style={{ left: point.x + tag.plateDx, top: point.y + tag.plateDy }}
            />
            <img
              className={styles.sprite}
              alt="ABILITY"
              src={imageSrc(IMG_TEXT_FRAMES, tag.label)}
              style={{
                left: point.x - Math.floor(tag.labelWidth / 2),
                top: point.y + tag.labelDy,
              }}
            />
          </div>
        )
      })}

      {/*
        ABILITY 판 0x5aefc(…, B.x, B.y + 8, 종류, 기록, 0, 반지름 30) — 0x65690~0x65740: k 7(홈런더비 하위 16 0x2df20)은 **늘 종류 2**(타자 이름),
        그 밖(k 6 미션 · k 8 명예의 전당)은 칸 ≤ 4 면 종류 3(투수 이름) · 아니면 2. 축 최대치 0x5e864 = 800.
        ⚠️ 나리 145 등록이 어느 k 인지는 안 떴다 — 칸으로 가르는 쪽에 둔다.
      */}
      <AbilityRadarPanel center={chartCenter} radius={HALL_OF_FAME_CHART.radius} maximumLength={HALL_OF_FAME_CHART_MAXIMUM_LENGTH}
        labelFrames={(mode.kind === '선수고르기' && mode.purpose === '홈런더비') || slot >= HALL_OF_FAME_PITCHER_SLOTS
          ? ABILITY_RADAR_LABELS.batter : ABILITY_RADAR_LABELS.pitcher}
        targets={chartValues} restartKey={slot} />

      {/* 5×3 격자 0x7a571 종류 6 — 칸 바탕 없이(시작 넷째 인자 [격자+8] = 0) 칸 틀 · 상태 그림 · (145) 다른 편 덮개 (0x7ac2e) */}
      {slots.map((entry, index) => {
        if (index < view.firstSlot || index >= view.firstSlot + view.rows * HALL_OF_FAME_GRID.columns) return null
        const box = hallOfFameCellOf(index - view.firstSlot, view.firstRowY)
        const shake = index === slot ? bounce.offset : null
        const x = box.x + (shake?.dx ?? 0)
        const y = box.y + gridOpenCellDy(gridOpenShape, gridOpen.state, index - view.firstSlot) + (shake?.dy ?? 0)
        const typeIndex = entry.kind === '찬칸' && entry.figure !== null ? entry.figure.form >> 1 : null
        const isDimmed = isHallOfFameCellDimmed(mode.kind === '등록' ? mode.edition : null, index)
        return (
          <button
            key={index}
            type="button"
            className={styles.hofCell}
            aria-label={`${index + 1}번 슬롯`}
            aria-current={index === slot}
            data-slot={index}
            data-kind={entry.kind}
            data-state={entry.state}
            style={{ left: x, top: y, width: box.width, height: box.height }}
            onClick={() => { setSlot(index); pressSlot(index) }}
          >
            <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, HALL_OF_FAME_CELL_ART.frame.image)} style={{ left: 0, top: 0 }} />
            {hallOfFameCellImagesOf(index, entry.state, typeIndex).map((image) => {
              const at = hallOfFameCellImageTopLeftOf(image)
              return <img key={image.image} className={styles.sprite} alt="" data-cell-image={image.image}
                src={imageSrc(SLT_FRAME, image.image)} style={{ left: at.dx, top: at.dy }} />
            })}
            {isDimmed && (
              // 0x6b7d5(gfx, x, y, 39, 38, 둥글기 1, 0x80000000) — (w + 1)×(h + 1) 에서 네 모서리 점이 빠진 꼴, 한 겹이라 clip-path 로 깎는다
              <span className={styles.hofCellDim} data-part="덮개" style={{
                width: HALL_OF_FAME_CELL_ART.frame.width + 1, height: HALL_OF_FAME_CELL_ART.frame.height + 1,
                opacity: HALL_OF_FAME_CELL_ART.dimOpacity,
              }} />
            )}
          </button>
        )
      })}
      {/* 커서 0x7b3a0 → 0x7b432 — 열림 애니가 끝났고([격자+9]) 깜빡일 때([격자+0x18] % 8 ≤ 4) slt_frame 1 을 (x − 2, y − 2) */}
      {gridOpen.state.isDone && gridOpen.blink % 8 <= 4 && slot >= view.firstSlot && (
        <img className={styles.sprite} alt="" data-testid="명전-커서" src={imageSrc(SLT_FRAME, HALL_OF_FAME_CELL_ART.cursor.image)}
          style={{
            left: hallOfFameCellOf(slot - view.firstSlot, view.firstRowY).x + HALL_OF_FAME_CELL_ART.cursor.dx + bounce.offset.dx,
            top: hallOfFameCellOf(slot - view.firstSlot, view.firstRowY).y + HALL_OF_FAME_CELL_ART.cursor.dy + bounce.offset.dy,
          }} />
      )}

      </>)}

      {/* 말풍선 (0x65866) — 판 76×36 #2E4694 + 흰 테, 칸 두 개 70×14 #213473 */}
      {isBubbleOpen && (
        <div className={styles.hofBubble} role="menu" aria-label="명예의 전당 슬롯"
          style={{
            left: bubble.x, top: bubble.y,
            width: HALL_OF_FAME_BUBBLE.width, height: HALL_OF_FAME_BUBBLE.height,
            background: HALL_OF_FAME_BUBBLE.panelColor,
            border: `1px solid ${HALL_OF_FAME_BUBBLE.borderColor}`,
            borderRadius: HALL_OF_FAME_BUBBLE.cornerRadius,
          }}>
          {HALL_OF_FAME_BUBBLE.labels.map((label, index) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={styles.hofBubbleCell}
              aria-current={index === bubbleCursor}
              style={{
                left: HALL_OF_FAME_BUBBLE.cell.dx,
                top: cell.y + HALL_OF_FAME_BUBBLE.cell.dys[index] - bubble.y,
                width: HALL_OF_FAME_BUBBLE.cell.width,
                height: HALL_OF_FAME_BUBBLE.cell.height,
                background: HALL_OF_FAME_BUBBLE.cell.color,
                outline: index === bubbleCursor ? `1px solid ${HALL_OF_FAME_BUBBLE.selectedBorderColor}` : undefined,
              }}
              onClick={() => chooseBubble(index)}
            >
              <span className={styles.hofBubbleLabel} style={{ top: HALL_OF_FAME_BUBBLE.labelDy, width: HALL_OF_FAME_BUBBLE.cell.width }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      )}

      {frame === undefined
        ? <SpecialBands onBack={goBack} slides />
        : <ScreenFrame title={frame.title} gamePoint={frame.gamePoint} onBack={goBack} />}

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      {popupView !== null && <MessageBox text={popupView.text} buttons={popupView.buttons}
        {...(popupView.initialSelected === undefined ? {} : { initialSelected: popupView.initialSelected })} onAnswer={answerPopup} />}
    </RawScreen>
  )
}

function popupTextOf(popup: HallOfFamePopup): {
  readonly text: string
  readonly buttons: readonly string[]
  /** 처음 커서 — 0x749d5 를 부르는 자리만 준다 (안 주면 첫 칸) */
  readonly initialSelected?: number
} | null {
  // 히든 알림은 앱의 공용 창이 그린다
  if (popup.kind === '히든알림') return null
  if (popup.kind === '확인') return { text: HALL_OF_FAME_TEXT.confirm, buttons: ['예', '아니오'] }
  if (popup.kind === 'G부족') return { text: HALL_OF_FAME_TEXT.shortage, buttons: ['예', '아니오'] }
  if (popup.kind === '나중에') return { text: HALL_OF_FAME_TEXT.later, buttons: ['예', '아니오'] }
  if (popup.kind === '완료') return { text: HALL_OF_FAME_TEXT.done, buttons: ['확인'] }
  // 0x2ae3a 0x74ef5(…[128], 종류 2) 바로 뒤 0x2ae42 `0x749d5(popup, 1)` — 처음 커서 "아니오"
  if (popup.kind === '삭제확인') return { text: HALL_OF_FAME_TEXT.deleteConfirm, buttons: ['예', '아니오'], initialSelected: 1 }
  return { text: popup.text, buttons: popup.buttons }
}

/**
 * 격자 열림 애니의 꼴 — `0x79ed5(격자, 종류, 120, H/2 + dy, 표, 40, 5열, 줄, 0, 0, 1)`(0x651ae~0x651d8: 가로 · 세로틈 r5 = 0,
 * 가속 시프트 1) · 시작 `0x7a005(격자, [skin+0xe8], 1, 0)`(0x651dc~0x651ea).
 */
const hallOfFameGridOpenShapeOf = (rows: number): GridOpenShape => ({
  rows, columns: HALL_OF_FAME_GRID.columns, rowHeight: HALL_OF_FAME_GRID.rowHeight, rowGap: HALL_OF_FAME_GRID.verticalGap, shift: 1,
})

/** 말풍선 둘째 칸 — 슬롯에서 삭제 */
const HALL_OF_FAME_BUBBLE_DELETE = 1

/**
 * 말풍선 칸을 웹이 못 할 때의 안내 — 선물은 통신(🌐)이라 늘 이 글이다. 삭제는 `deletion` 을 안 넘긴 화면에서만 뜬다.
 * ⚠️ 원본 선물 칸은 막기 검사(StrMAINMENU[214]) 뒤 [127] 설명 · 통신(0x62956)이다 — 통신이라 옮기지 않았다.
 */
const HALL_OF_FAME_BUBBLE_NOTICES = [
  '친구에게 선물은!N통신이 필요합니다',
  '슬롯에서 삭제는!N여기서 할 수 없습니다',
] as const

type HallOfFameSlotView =
  | {
      readonly kind: '찬칸'
      readonly state: HallOfFameSlotState
      readonly name: string
      readonly chartValues: readonly number[]
      /** 몸 그림 — 옛 저장(생김새가 없는 명전 타자)이나 `figure` 를 안 준 나리는 null */
      readonly figure: HallOfFameFigureLook | null
    }
  | { readonly kind: '빈칸'; readonly state: HallOfFameSlotState }

const batterChartOf = (ability: BatterAbility) => [ability.hit, ability.power, ability.defense, ability.run]
const pitcherChartOf = (ability: PitcherAbility) => [ability.control, ability.velocity, ability.breaking, ability.stamina]

/** 칸 15개의 상태 (0x5eb8c) — `HallOfFameSlotState` 머리말 */
function hallOfFameSlotsOf(collection: Collection, mode: HallOfFameMode): readonly HallOfFameSlotView[] {
  return Array.from({ length: HALL_OF_FAME_SLOTS }, (_unused, index): HallOfFameSlotView => {
    // 홈런더비(목록 종류 1)는 투수 칸 0~4 를 채우지 않는다 (0x5ec8e → 0x5ed0e 건너뜀)
    if (mode.kind === '선수고르기' && mode.purpose === '홈런더비' && index < HALL_OF_FAME_PITCHER_SLOTS) {
      return { kind: '빈칸', state: 0 }
    }
    if (index === NARI_PITCHER_SLOT || index === NARI_BATTER_SLOT) {
      if (mode.kind === '보기') return { kind: '빈칸', state: 0 }
      const nari = index === NARI_PITCHER_SLOT ? mode.nari.투수 : mode.nari.타자
      return nari === null
        ? { kind: '빈칸', state: 2 }
        : { kind: '찬칸', state: 1, name: nari.name, chartValues: nari.equippedAbility, figure: nari.figure ?? null }
    }
    const entry = hallOfFameEntryOfSlot(index)
    if (entry === null) return { kind: '빈칸', state: 0 }
    if (!isHallOfFameSlotOpen(entry.side, entry.index)) return { kind: '빈칸', state: 5 }
    if (entry.side === '투수') {
      const famer = hallOfFamePitcherAt(collection, entry.index)
      return famer === null
        ? { kind: '빈칸', state: 4 }
        : {
            kind: '찬칸', state: 3, name: famer.name, chartValues: pitcherChartOf(famer.equippedAbility),
            figure: hallOfFameFigureLookOf(famer.look, famer.equipmentLevels === undefined ? undefined : pitcherChartOf(famer.equipmentLevels)),
          }
    }
    const famer = hallOfFameBatterAt(collection, entry.index)
    // 옛 저장(장비 얹은 값이 없는 선수)은 기본 능력치로 그린다
    return famer === null
      ? { kind: '빈칸', state: 4 }
      : {
          kind: '찬칸', state: 3, name: famer.name, chartValues: batterChartOf(famer.equippedAbility ?? famer.ability),
          figure: famer.look === undefined ? null
            : hallOfFameFigureLookOf(famer.look, famer.equipmentLevels === undefined ? undefined : batterChartOf(famer.equipmentLevels)),
        }
  })
}

/**
 * 명전 칸 몸 그림 — 기록 +0xb 의 폼(2 × 타입 + 손)·피부와 장비 니블, 팀은 늘 14 (0x65296).
 * 니블 차례는 능력치 차례 그대로다(부위 0~3 = rec[0x19] 윗·아랫 · rec[0x1a] 윗·아랫). 옛 저장(니블 없음)은 맨몸.
 */
function hallOfFameFigureLookOf(
  look: { readonly typeIndex: number; readonly handIndex: number; readonly skinIndex: number },
  nibbles: readonly number[] | undefined,
): HallOfFameFigureLook {
  const [first = 0, second = 0, third = 0, fourth = 0] = nibbles ?? []
  return {
    form: look.typeIndex * 2 + look.handIndex,
    skin: look.skinIndex,
    team: HALL_OF_FAME_FIGURE_TEAM,
    equipment: [first, second, third, fourth],
  }
}

/** team_logo 프레임 `팀` 을 (x, y) 가운데에 — 0xba815 로 크기를 얻어 (x − (w >> 1), y − (h >> 1)) */
function TeamLogo({ team, x, y }: { readonly team: number; readonly x: number; readonly y: number }) {
  const [size, setSize] = useState<{ readonly width: number; readonly height: number } | null>(null)
  return (
    <img className={styles.sprite} alt="" data-testid="명전-팀로고" src={imageSrc(TEAM_LOGO, team)}
      onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      style={{
        left: x - ((size?.width ?? 0) >> 1), top: y - ((size?.height ?? 0) >> 1),
        visibility: size === null ? 'hidden' : undefined,
      }} />
  )
}

/**
 * 처음 커서 칸 — 스페셜 27 은 진입 0x25fe6 이 격자 커서 (1, 0) 을 적는다. 미션 17 은 진입 0x2613c 가 목록 `+0x80` 을 0 으로
 * 두고(0x261be) 0x5eb8c 를 부른다 (⚠️ +0x80 이 커서 칸이라는 것은 유력). 나리 145(0x1ca10~0x1ca18) · 시즌 0xe2(0xe302~0xe30e)는
 * 격자 vt+0x14(0, 0) 로 칸 0 에 세운다. 홈런더비 16 은 셋째 인자 5 라 첫 칸이 슬롯 5 다.
 */
function initialHallOfFameSlotOf(mode: HallOfFameMode): number {
  if (mode.kind === '보기') return NARI_PITCHER_SLOT + 1
  return hallOfFameGridViewOf(mode).firstSlot
}

/** 막대 글씨 — 잠긴 칸(5)은 LOCK(114), 그 밖은 EMPTY(113) (0x653ee~0x65432) */
function hallOfFameBarLabelOf(state: HallOfFameSlotState) {
  return state === 5 ? HALL_OF_FAME_SLOT_ART.lock : HALL_OF_FAME_SLOT_ART.empty
}

/** A 가운데 아이콘 — 상태 2·4 면 투수 칸(≤ 4) 글러브 23 · 타자 칸 방망이 24, 그 밖(0·5)은 자물쇠 31 */
function hallOfFameIconOf(slot: number, state: HallOfFameSlotState) {
  if (state !== 2 && state !== 4) return HALL_OF_FAME_SLOT_ART.padlock
  return slot < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_SLOT_ART.glove : HALL_OF_FAME_SLOT_ART.bat
}

/**
 * 명전 목록의 격자 [목록+0x134] (진입이 넣는다) — 모두 `vt+0x1c(5열, 줄, 숫자키 꼴 1, 꼴 0x10)` 로 짓고
 * 막힌 칸 표 [+0x28] 의 몇 칸을 0 으로 지운다 (직접 떴다):
 * ```
 * 메인 메뉴 [메뉴+0x74] — 진입마다 다시 짓는다
 *   16 홈런더비  0x25e6c: (5, 2, 1, 0x10) · 막힘 [열] = 칸 5 (셋째 인자 5 를 더해 슬롯 10)      0x25e86~0x25eaa
 *   17 미션      0x2613c: (5, 3, 1, 0x10) · 막힘 [2·열] = 칸 10 (슬롯 10, 안 쓰는 칸)            0x26156~0x26180
 *   27 스페셜    0x25f8c: (5, 3, 1, 0x10) · 막힘 [0] · [열] · [2·열] = 첫 열(나리 0 · 5 · 슬롯 10) · 커서 (1, 0)  0x25fa6~0x25fe8
 * 나리 145 등록 [장면+0x284] — 나리 장면 생성자 0xf684 가 한 번 짓는다
 *   0xf810~0xf85a: (5, 3, 1, 0x10) · 막힘 [2·열] = 칸 10 — 진입 0x1c8ec 는 [목록+0x134] 에 넣고 커서 vt+0x14(0, 0) 만 (0x1ca06~0x1ca2a)
 * 시즌 0xe2 선수영입 [장면+0x9c] — 시즌 장면 생성자 0x3b14 가 한 번 짓는다
 *   0x3d60~0x3d94: (5, 3, 1, 0x10) · 막힌 칸 없음 — 진입 0xe1dc 는 [목록+0x134] 에 넣고 커서 vt+0x14(0, 0) 만 (0xe302~0xe320)
 *   곧 영입 목록은 안 쓰는 칸 10 에도 커서가 선다 (원본 그대로)
 * ```
 * 꼴 0x10 이라 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다. 옮기기 0x6c445 는 막힌 칸을 같은 방향으로 건너뛴다.
 */
function hallOfFameGridOf(mode: HallOfFameMode, owner: HallOfFameListOwner): AnnalsGridShape {
  const base = { columns: HALL_OF_FAME_GRID.columns, rows: HALL_OF_FAME_GRID.rows, wrapsColumns: true, wrapsRows: false } as const
  if (mode.kind === '보기') return { ...base, blockedCells: [0, 5, 10] }
  if (mode.kind === '선수고르기' && mode.purpose === '홈런더비') return { ...base, rows: 2, blockedCells: [5] }
  if (owner === '시즌') return base
  return { ...base, blockedCells: [10] }
}

/** 보이는 격자 — 첫 칸 번호(키 0x62568 의 셋째 인자)와 행 수(목록 위젯 0x1c 의 행 인자) */
interface HallOfFameGridView {
  readonly firstSlot: number
  readonly rows: number
  /** 격자 cy — 첫 줄 위쪽 y (0x65130~0x651d8) */
  readonly firstRowY: number
}

const FULL_GRID: HallOfFameGridView = { firstSlot: 0, rows: HALL_OF_FAME_GRID.rows, firstRowY: HALL_OF_FAME_GRID.firstRowY }

/**
 * 홈런더비 선수 고르기는 칸 5 부터 5×2 (0x25e6c 위젯 (5열, 2행) · 0x29ae0 셋째 인자 5).
 * 그리는 자리: 하위 16 그리기 0x2df20 = 공용 목록 k 7 — 0x65152~0x65158 이 cy = H/2 + 0x18 = 184 · 행 2 · 종류 4 로 둔다(확정).
 *   두 줄은 y 184 · 224 (미션·명전 k 6 · 8 은 H/2 + 0x13 = 179).
 */
function hallOfFameGridViewOf(mode: HallOfFameMode): HallOfFameGridView {
  if (mode.kind === '선수고르기' && mode.purpose === '홈런더비') return { firstSlot: NARI_BATTER_SLOT, rows: 2, firstRowY: HOME_RUN_DERBY_FIRST_ROW_Y }
  return FULL_GRID
}
