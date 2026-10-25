import { useEffect, useMemo, useRef, useState } from 'react'
import { CommonPanel, InsetBox, PressArea, RawScreen, ScreenOverlay, SpriteNumber, useImgTextPalette3 } from '@/shared/ui'
import { tapKey, useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { stopSkinFrameSlide } from '@/shared/lib/skinFrameSlide/skinFrameSlide'
import { FRAME_SLIDE_BODY_FIRST_DRAW } from '@/widgets/screen-frame/lib/frameSlide'
import {
  HELP_PAGER_GLYPH_HEIGHT,
  HELP_PANEL_FULL_HEIGHT,
  HELP_PANEL_OPEN_HEIGHTS,
  HELP_VIEWER,
  SCREEN,
  helpPagerOf,
  helpPanelCloseHeightsFrom,
  helpPanelHeightAfterCloseDraw,
  helpPanelHeightAfterOpenDraw,
} from '@/pages/help/lib/helpLayout'
import {
  HELP_RATING_TABLE,
  HELP_SCROLL_BAR,
  HELP_TEXT_BOX,
  helpPageCountOf,
  helpPageRawOf,
  helpScrollKnobTopOf,
  helpScrollMetricsOf,
  isHelpRatingPage,
  wrapHelpText,
} from '@/pages/help/lib/helpPages'
import { openHelpViewer, stepHelpViewer } from '@/pages/help/lib/helpViewer'
import type { HelpViewerKey, HelpViewerState } from '@/pages/help/lib/helpViewer'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

const SLT_FRAME = './sprites/slt_frame'
const SLT_FRAMES = './sprites/slt_frame/frames'
const NUM = './sprites/num'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`
const frameSrc = imageSrc

interface HelpScreenProps {
  readonly onBack: () => void
  /** 여는 장 — 메인 메뉴 [도움말](상태 7)·경기 중 [조작방법]은 **0**, [게임문의](상태 10)는 **6** (0x2668c · 0x3c260) */
  readonly chapter?: number
  /** 상태 10 은 `[뷰어+0x45c] = 1` 로 장 이동을 잠근다 (0x2668c) */
  readonly isChapterLocked?: boolean
  /**
   * 전역 G(`mgr+0x64`) — 메인 메뉴 도움말(상태 7) 그리기 0x2fc8c 끝의 머리띠 `0x54d95(skin, 0, 5)` 는 제목 0 이라
   * G포인트(0x54a60)도 그린다(0x550dc). 넘기면 머리띠를 G 까지 그린다.
   *
   * **안 넘기면 머리띠·바닥띠가 없다** — 경기 중 [조작방법]이다: 일시정지 그리기 0x3cdd0 의 갈래 4(0x3ce54)는
   * 뷰어 `0x639a5(skin)` 하나만 부르고 바탕 0x58371 도 머리띠 0x54d95 도 안 부른다.
   * 그때는 닫을 길이 CLR 키뿐이라 웹판만 판 안에 [닫기] 칸을 둔다.
   */
  readonly gamePoint?: number
}

/**
 * 웹 키 → 원본 키 (위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16).
 * '2'·'8' 은 쪽 보기의 줄 넘기기 0x61ce4 만 받는다. '4'·'5'·'6' 은 0x637d0 이 안 본다.
 */
const viewerKeyOf = (key: string): HelpViewerKey | null => {
  switch (key) {
    case 'ArrowUp': return '위'
    case 'ArrowDown': return '아래'
    case 'ArrowLeft': return '왼'
    case 'ArrowRight': return '오른'
    case 'Enter':
    case ' ': return 'OK'
    case 'Escape':
    case 'Backspace': return 'CLR'
    case '2': return '2'
    case '8': return '8'
    default: return null
  }
}

/** 장 고르기 → 쪽 보기 — OK(Enter) */
const HELP_OPEN_PAGE_OFFER: TouchKeyOffer = { key: 'Enter', label: '쪽 보기' }

/**
 * StrHOWTO 뷰어 — 메인 메뉴 **상태 7** [도움말]·상태 10 [게임문의]·경기 중 메뉴 [조작방법](하위 4) 이 함께 쓴다
 * (열기 `0x63688` · 키 `0x637d0` · 그리기 `0x639a5` → `0x58d10` — S12 2절).
 *
 * ⚠️ **정정**: 앞서 옮긴 "상태 9 목록 + 상태 37 본문" 은 도움말이 아니라 **랭킹**이었다
 * (설명 글이 `StrMAINMENU[24 + 커서]` = "…의 순위를 확인합니다"). 랭킹 쪽 값은
 * `helpLayout.ts` 의 `RANKING_MENU_ITEMS`·`RANKING_TITLE_FRAMES` 에 남겨 두었다.
 *
 * 장은 원본 표 `0xd0b18 = [5,5,7,6,3,6,4]` 그대로 **일곱**이라(`helpSections.ts`)
 * 기본 조작·미션모드·환경설정까지 모두 이 화면에서 볼 수 있다. 돌아다닐 수 있는 장은
 * **0~5** 고(0x638be·0x63914), 장 6 게임문의는 상태 10 에서 잠긴 채 열린다.
 *
 * 키는 원본 0x637d0 그대로 두 단계다(`helpViewer.ts`): **장 고르기**(여는 때)에서 좌우 = 장 · OK/아래 = 쪽 보기 · CLR = 닫기,
 * **쪽 보기**에서 좌우 = 쪽 · CLR = 장 고르기로.
 *
 * 그리기는 `0x58fd4` 그대로다(`helpLayout` 의 `HELP_VIEWER` 표): 장 띠·장 이름·테두리, 쪽 번호·화살, 본문 상자,
 * 스크롤 막대, 글 11줄(`wrapHelpText` — 0x6ef4c 줄 나누기), 장 6 둘째 쪽은 등급표(0x54330).
 * **장 고르기와 쪽 보기의 그림 차이는 무엇이 깜빡이느냐뿐이다** — 장 고르기는 장 테두리(프레임 61)가 깜빡이고 쪽 화살이 늘 보이며,
 * 쪽 보기는 반대다(0x59090 · 0x59196). 판은 열 때 4프레임에 걸쳐 커지고, 메인 메뉴에서는 CLR 로 닫을 때 4프레임에 걸쳐 줄어든다
 * (`HELP_PANEL_*_HEIGHTS`). 경기 중은 `[뷰어+0x125]` 라 CLR 이 곧장 닫는다.
 *
 * 판 0x55e60 은 원본 선 목록 그대로(`CommonPanel`) — 잠기지 않은 뷰어([+0x45c] = 0)는 위 띠 16(0x58eb6), 잠긴 뷰어(상태 10)는
 * 제목 탭(0x58e1a)이다. 본문 상자 0xbb28d 는 `InsetBox`, 쪽 번호는 num.pzx 숫자 그림 0x585ac(`helpPagerOf`)다.
 * 글은 원본 줄 나누기(한글 9·영문 5·자간 1)로 나눈 뒤 웹 글꼴로 그린다. 쪽 넘기기·장 넘기기·닫기 단추는 웹판 편의다.
 * 쪽 보기 → 장 고르기(CLR)가 쓰는 `+0x80 = 0` 의 뜻은 안 읽었다.
 */
export function HelpScreen({ onBack, chapter = 0, isChapterLocked = false, gamePoint }: HelpScreenProps) {
  const [viewer, setViewer] = useState<HelpViewerState>(() => openHelpViewer(chapter, isChapterLocked))
  const section = viewer.chapter
  const page = viewer.page
  /** 경기 중 [조작방법] — 경기 장면 위에 얹힌다 (gamePoint 를 안 넘긴 쪽) */
  const isOverGame = gamePoint === undefined

  const pageCount = helpPageCountOf(section)
  const isRatingPage = isHelpRatingPage(section, page)
  const lines = useMemo(() => wrapHelpText(helpPageRawOf(section, page)), [section, page])
  const lineCountOf = (state: HelpViewerState) => wrapHelpText(helpPageRawOf(state.chapter, state.page)).length

  // 경기 중 [조작방법] — 0x3c158 이 뷰어를 0x63689(skin, 0) 로 열자마자(+0x84 = 1) 3c26a 에서 [skin+0x84] = 0 으로 지운다.
  // 머리띠가 없는 화면이라 미끄러짐 없이 바로 본문이고, 전역 칸은 내려온 채가 된다 (r168). 들어옴은 첫 그림보다 앞이다
  useState(() => {
    if (isOverGame) stopSkinFrameSlide()
    return null
  })
  /** 그린 횟수 — 깜빡임(+0x410)이 센다 */
  const tick = useUpdateCounter()
  /**
   * 본문 몇째 그림인가 — 메인 메뉴 7 · 10 은 뷰어 열기 0x63688 이 [skin+0x84] = 1 · [+0x86] = 1 을 써(63728~63730) 머리띠가
   * 미끄러지고, 그리기 0x58d10 은 [skin+0x84] ≠ 0 이면(58d54~58d60) 판도 글도 없이 593aa 로 끝난다 — 깜빡임 +0x410 은 그 앞
   * 58d14 에서 오른다. 판 여닫기(+0x90)도 본문에서만 걸음을 가므로 본문 첫 그림부터 센다 (r168).
   */
  const bodyTick = isOverGame ? tick : tick - FRAME_SLIDE_BODY_FIRST_DRAW
  const isBodyShown = bodyTick >= 0
  /**
   * 닫기 연출 — CLR 을 받은 본문 그리기 번호와 그 뒤 그릴 높이들 (메인 메뉴만 — 경기 중은 +0x125 라 곧장 닫는다).
   * CLR 을 다시 받으면 그때 높이 칸에서 걸음 1 로 다시 줄인다(0x6385c · 0x6388a — U-86, `helpPanelCloseHeightsFrom`)
   */
  const [closing, setClosing] = useState<{ readonly from: number; readonly heights: readonly number[] } | null>(null)
  const closingStep = closing === null ? null : Math.max(0, bodyTick - closing.from)
  const panelHeight =
    closing !== null && closingStep !== null
      ? closing.heights[Math.min(closingStep, closing.heights.length - 1)]
      : (HELP_PANEL_OPEN_HEIGHTS[Math.max(0, bodyTick)] ?? HELP_PANEL_FULL_HEIGHT)
  const isAnimating = panelHeight < HELP_PANEL_FULL_HEIGHT
  /** [skin+0x410] — 0x58d14 가 그릴 때마다 올린 뒤의 값으로 본다 (앱에 하나, U-90) */
  const blinkCounter = useSkinBlinkCounter(tick)
  const isBlinkOn = !isAnimating && blinkCounter % 8 <= 3

  const hasClosedRef = useRef(false)
  useEffect(() => {
    if (closing === null || closingStep === null || closingStep < closing.heights.length || hasClosedRef.current) return
    // 닫기 끝(+0x98)이 선 다음 갱신에 0x637d0 이 1 을 돌려준다
    hasClosedRef.current = true
    onBack()
  }, [closing, closingStep, onBack])

  /** 0x63850 · 0x6387e — `+0x125`(경기 장면)면 곧장 닫고, 아니면 닫기 연출을 건다 */
  const close = () => {
    if (isOverGame) return onBack()
    setClosing((previous) => {
      // 지금 그림 뒤의 높이 칸 — 여는 중 · 다 열린 판이면 열기 걸음 뒤, 닫는 중이면 닫기 걸음 뒤(끝이 섰으면 바닥 10)
      const start = previous === null
        ? helpPanelHeightAfterOpenDraw(bodyTick)
        : helpPanelHeightAfterCloseDraw(previous.heights, Math.max(0, bodyTick - previous.from))
      return { from: Math.max(0, bodyTick), heights: helpPanelCloseHeightsFrom(start) }
    })
  }

  /** 웹판 단추 — 단계와 상관없이 쪽 보기·장 고르기의 좌우와 같은 값을 낸다(단계는 그대로 둔다) */
  const moveBy = (isChapter: boolean, step: number) => {
    if (isChapter && isChapterLocked) return
    setViewer((previous) => {
      const next = stepHelpViewer(
        { ...previous, isChoosingChapter: isChapter }, step > 0 ? '오른' : '왼', false, helpPageCountOf(previous.chapter),
      )
      return next === '닫기' ? previous : { ...next, isChoosingChapter: previous.isChoosingChapter }
    })
  }
  // 터치 기기 — 장 고르기의 OK(쪽 보기로)는 원본 그림에 글자 자리가 없어 '쪽 보기' 상황 버튼으로 낸다(r186 — 늘 있던 확인 버튼을
  // 걷었다). 버튼은 Enter 키 사건이라 아래 듣는 곳(0x637d0)과 같은 길이다
  useTouchKeyOffer(viewer.isChoosingChapter && isBodyShown && closingStep === null ? HELP_OPEN_PAGE_OFFER : null)
  const movePage = (step: number) => moveBy(false, step)
  const moveSection = (step: number) => moveBy(true, step)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 경기 중 메뉴 하위 4 의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — 뒤에 깔린 경기 화면(스윙·이동·'*')은 아무 키도 못 받는다.
      // 창의 잡기 단계에서 먼저 받아 뒤쪽 듣개로 안 넘긴다
      if (isOverGame) event.stopPropagation()
      // 63804 는 [뷰어+0x314] ≠ 0 이면 키를 다 버린다. 그 칸은 앱 전역 객체 [0x1552cfc](메인 장면 +0x120 도 같은 것 — 23634)의
      // 장면 팝업 걸음이라 뷰어 skin 과 같은 객체지만, 뷰어를 열 때 0x63688 이 0 을 쓰고(63774) 메인 장면은 상태가 바뀔 때마다
      // 0x3299c 가 0 으로 지운다. 0 아닌 값은 뷰어가 아닌 메인 상태 21(0x29df8) · 27(0x2ad88 · 0x2ae56) · 28(0x2b234)의 팝업만
      // 쓴다 — 뷰어 키(메인 상태 7 · 10 의 0x2cd54, 경기 0x3ca36) 때는 늘 0 이라 버리는 길이 서지 않는다(r207, U-86)
      const key = viewerKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const next = stepHelpViewer(viewer, key, isChapterLocked, helpPageCountOf(viewer.chapter), lineCountOf(viewer))
      if (next === '닫기') return close()
      setViewer(next)
    }
    window.addEventListener('keydown', onKeyDown, isOverGame)
    return () => window.removeEventListener('keydown', onKeyDown, isOverGame)
  })

  const { x0, panelWidth, centerY } = HELP_VIEWER
  const panelTop = centerY - Math.trunc(panelHeight / 2)
  // 자르기 창 0xbae25 — 연출 중에는 판 안쪽(위아래 5 씩 안), 다 열리면 판보다 위아래 5 씩 넓게 (0x58de4 · 0x58ef8)
  const clipTop = isAnimating ? panelTop + 5 : panelTop - 5
  const clipHeight = isAnimating ? Math.max(panelHeight - 10, 0) : panelHeight + 10
  const showsTitleHighlight = !viewer.isChoosingChapter || isBlinkOn
  const showsPageArrows = viewer.isChoosingChapter || isBlinkOn
  const pager = helpPagerOf(page, pageCount)
  const knobTop = helpScrollKnobTopOf(lines.length, viewer.scrollTop)
  const { knobLength, maxTop } = helpScrollMetricsOf(lines.length)
  const visibleLines = lines.slice(viewer.scrollTop, viewer.scrollTop + HELP_TEXT_BOX.visibleLines)

  const tabBox = HELP_VIEWER.tabBoxes[section]
  const name = HELP_VIEWER.names[section]
  /**
   * 장 이름 · 잠긴 제목 img_text 는 **팔레트 3**(#2949A5 · #10246B)으로 찍는다 — 0x58e30~0x58e58 · 0x58ff2~0x5901c 가
   * `0x913e5(img_text, 3)` 를 부른 뒤 0xba759 로 그린다(직접 떴다). 기본 팔레트(흰 글자)로 찍으면 흰 띠 위에서 안 보인다.
   */
  const namePalette = useImgTextPalette3()
  /** 웹판 단추 줄 — 원본은 키뿐이라 판 아래(y = 판 끝 + 4)에 둔다 */
  const webButtonTop = centerY + HELP_PANEL_FULL_HEIGHT / 2 + 4

  const viewerBody = isBodyShown && (
    <>
      {namePalette.definition}
      {/* 판 0x55e60(skin, W/2, H/2, 192, +0x90, 0, 0x22, …) — [+0x45c] 면 (띠 0, 0, 제목 탭 1) 아니면 (띠 0x10, 0, 0) (0x58dea~0x58ec6) */}
      <CommonPanel
        x={x0}
        y={panelTop}
        width={panelWidth}
        height={panelHeight}
        topBand={isChapterLocked ? 0 : 0x10}
        titleTab={isChapterLocked}
      />

      <div className={styles.clip} style={{ left: 0, top: clipTop, width: SCREEN.width, height: clipHeight }}>
        <div style={{ position: 'absolute', left: 0, top: -clipTop, width: SCREEN.width, height: SCREEN.height }}>
          {isChapterLocked || tabBox === undefined || name === undefined ? (
            // 잠김(장 6) — 띠 없이 img_text 프레임 26 (0x58e3c~0x58e8a)
            <img
              className={styles.sprite}
              alt="게임문의"
              src={frameSrc(IMG_TEXT_FRAMES, HELP_VIEWER.lockedTitle.frame)}
              style={{
                ...namePalette.style,
                left: HELP_VIEWER.lockedTitle.x - Math.trunc(HELP_VIEWER.lockedTitle.width / 2),
                top: HELP_VIEWER.lockedTitle.y,
              }}
            />
          ) : (
            <>
              {/* 장 띠 slt_frame 프레임 55~60 + 그 상자 안 장 이름 img_text (0x58f22~0x5908c) */}
              <img
                className={styles.sprite}
                alt=""
                src={frameSrc(SLT_FRAMES, HELP_VIEWER.tab.firstFrame + section)}
                style={{ left: HELP_VIEWER.tab.x, top: HELP_VIEWER.tab.y }}
              />
              <img
                className={styles.sprite}
                alt={`장 ${section + 1}`}
                src={frameSrc(IMG_TEXT_FRAMES, name.frame)}
                style={{
                  ...namePalette.style,
                  left: x0 + tabBox[0] + Math.trunc((tabBox[2] - name.width) / 2),
                  top: HELP_VIEWER.y0 + tabBox[1] + 2,
                }}
              />
              {/* 장 테두리 프레임 61 — 쪽 보기면 늘, 장 고르기면 깜빡인다 (0x59090~0x590ec) */}
              {showsTitleHighlight && (
                <img
                  className={styles.sprite}
                  alt=""
                  data-testid="장테두리"
                  src={frameSrc(SLT_FRAMES, HELP_VIEWER.highlightFrame)}
                  style={{ left: x0 + tabBox[0], top: HELP_VIEWER.y0 + tabBox[1] - 2 }}
                />
              )}
            </>
          )}

          {/* 쪽 번호 — num.pzx 숫자 0x585ac 두 자리 + 사이 "/" 이미지 0x65 (0x59102~0x59192) */}
          <div role="img" aria-label={`${page + 1}/${pageCount}`}>
            <SpriteNumber glyphs={pager.page.glyphs} right={pager.page.right} boxTop={pager.y}
              boxHeight={HELP_PAGER_GLYPH_HEIGHT} folder={NUM} />
            <img className={styles.sprite} alt="" src={imageSrc(NUM, pager.slash.image)}
              style={{ left: pager.slash.x, top: pager.slash.y }} />
            <SpriteNumber glyphs={pager.count.glyphs} right={pager.count.right} boxTop={pager.y}
              boxHeight={HELP_PAGER_GLYPH_HEIGHT} folder={NUM} />
          </div>

          {/* 쪽 화살 slt_frame 이미지 20 — 장 고르기면 늘, 쪽 보기면 깜빡인다 (0x59196~0x59204). 웹판은 누를 수도 있다 */}
          <button
            type="button"
            className={styles.backButton}
            aria-label="이전 쪽"
            style={{ left: HELP_VIEWER.pageArrow.leftX, top: HELP_VIEWER.pageArrow.y }}
            onClick={() => movePage(-1)}
          >
            <img src={imageSrc(SLT_FRAME, HELP_VIEWER.pageArrow.image)} alt="" style={{ opacity: showsPageArrows ? 1 : 0 }} />
          </button>
          <button
            type="button"
            className={styles.backButton}
            aria-label="다음 쪽"
            style={{ left: HELP_VIEWER.pageArrow.rightX, top: HELP_VIEWER.pageArrow.y, transform: 'scaleX(-1)' }}
            onClick={() => movePage(1)}
          >
            <img src={imageSrc(SLT_FRAME, HELP_VIEWER.pageArrow.image)} alt="" style={{ opacity: showsPageArrows ? 1 : 0 }} />
          </button>

          {/* 본문 상자 0xbb28d(x0 + 5, y0 + 0x24, 0xac, 0xab, 정렬 1) (0x59208~0x5921a) */}
          <InsetBox
            x={HELP_VIEWER.innerBox.x}
            y={HELP_VIEWER.innerBox.y}
            width={HELP_VIEWER.innerBox.width}
            height={HELP_VIEWER.innerBox.height}
          />

          {/* 스크롤 막대 0x58c10 — 바탕 · 위아래 화살(slt_frame 이미지 78) · 흰 손잡이 */}
          <div
            className={styles.scrollTrack}
            style={{ left: HELP_SCROLL_BAR.x, top: HELP_SCROLL_BAR.y, width: HELP_SCROLL_BAR.width, height: HELP_SCROLL_BAR.height }}
          />
          <img
            className={styles.sprite}
            alt=""
            src={imageSrc(SLT_FRAME, HELP_VIEWER.scrollCap.image)}
            style={{ left: HELP_SCROLL_BAR.x, top: HELP_SCROLL_BAR.y - 4 }}
          />
          <img
            className={styles.sprite}
            alt=""
            src={imageSrc(SLT_FRAME, HELP_VIEWER.scrollCap.image)}
            style={{
              left: HELP_SCROLL_BAR.x,
              top: HELP_SCROLL_BAR.y + HELP_SCROLL_BAR.trackLength + 1,
              transform: 'scaleY(-1)',
            }}
          />
          {/* 웹 덧붙임 — 막대 위 · 아래 끝 화살(7×5) 위 투명 칸: 원본 ↑ · ↓ 키 한 번. 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만) */}
          {maxTop > 0 && !viewer.isChoosingChapter && (
            <>
              <PressArea label="위 줄" onPress={() => tapKey('ArrowUp')}
                rect={{ x: HELP_SCROLL_BAR.x - 4, y: HELP_SCROLL_BAR.y - 10, width: 15, height: 14 }} />
              <PressArea label="아래 줄" onPress={() => tapKey('ArrowDown')}
                rect={{ x: HELP_SCROLL_BAR.x - 4, y: HELP_SCROLL_BAR.y + HELP_SCROLL_BAR.trackLength - 2, width: 15, height: 14 }} />
            </>
          )}
          <div
            className={styles.scrollKnob}
            data-testid="스크롤손잡이"
            style={{ left: HELP_SCROLL_BAR.x + 1, top: HELP_SCROLL_BAR.y + knobTop + 1, width: 4, height: knobLength }}
          />

          {isRatingPage ? (
            <RatingTable />
          ) : (
            visibleLines.map((line, index) => (
              <div
                key={viewer.scrollTop + index}
                className={styles.textLine}
                style={{
                  left: HELP_TEXT_BOX.x,
                  top: HELP_TEXT_BOX.y + index * HELP_TEXT_BOX.lineHeight,
                  width: HELP_TEXT_BOX.width,
                  textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
                }}
              >
                {line.segments.map((segment, segmentIndex) => (
                  <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
                    {segment.text}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 장 넘기기 — 원본은 좌우 키(0x637d0), 웹판은 누를 수도 있게 둔다. 상태 10 은 잠긴다 */}
      {!isChapterLocked && (
        <>
          <button
            type="button"
            className={styles.sectionButton}
            aria-label="이전 장"
            style={{ left: x0 + 6, top: webButtonTop }}
            onClick={() => moveSection(-1)}
          >
            ‹ 앞 장
          </button>
          <button
            type="button"
            className={styles.sectionButton}
            aria-label="다음 장"
            style={{ left: x0 + panelWidth - 54, top: webButtonTop }}
            onClick={() => moveSection(1)}
          >
            뒷 장 ›
          </button>
        </>
      )}
    </>
  )

  const body = (
    <>
      {viewerBody}
      {gamePoint === undefined ? (
        // 경기 중 [조작방법] — 원본은 띠가 없고 CLR 로만 닫는다. 이 칸은 웹판 편의(터치)다
        <button
          type="button"
          className={styles.sectionButton}
          aria-label="닫기"
          style={{ left: x0 + panelWidth / 2 - 12, top: webButtonTop }}
          onClick={onBack}
        >
          닫기
        </button>
      ) : (
        // 7 · 10 들어옴 0x2668c → 뷰어 열기 0x63688 이 미끄러짐을 세운다 (63728~63730, r168 정정 — 예전엔 false)
        // 되돌아가기 표시는 CLR 키 그대로(r186) — 쪽 보기면 장 고르기로, 장 고르기면 닫기 연출 뒤 닫는다(위 듣는 곳 0x637d0).
        // 예전에는 onBack 을 바로 불러 쪽 보기에서도 도움말이 통째로 닫혔다
        <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={() => tapKey('Escape')} />
      )}
    </>
  )

  if (!isOverGame) return <RawScreen>{body}</RawScreen>

  /*
   * 경기 중 [조작방법] — 원본은 경기 장면을 그대로 둔 채 그 위에 뷰어만 그린다:
   * 0x3c212 가 일시정지 팝업을 닫고 같은 팝업(0x741a0 → 그리기 0x3cdd0 갈래 4 = 뷰어 0x639a5)을 다시 띄우면
   * 0x75440 → 0x741a0 이 +0x250 = 1 · +0x24d = 1 을 세운다. 경기 프레임 0x52c50 은 0x52efe 에서
   * `[+0x24f](경기 장면 0x3301c 가 1) && 팝업 && [+0x250] == 0` 일 때만 장면을 건너뛰므로 **다시 띄운 첫 프레임에 장면을 한 번 그리고**,
   * 팝업 그리기 0x746cc 가 그 위를 0x74704~0x7474a 로 **검정 단계 5** 로 한 번 덮은 뒤 +0x250 · +0x24d 를 지운다.
   * 그 뒤로는 장면도 덮개도 다시 안 그려 **멈춘 장면 + 어둡게** 가 뷰어 뒤에 남는다(경기 갱신도 0x754f9 가 막는다).
   * 덮개는 [0x15605d0] = 색 덮기 0x9b3f4 에 색 0x1400748(0,0,0) 을 넘긴 것이라(0x74726~0x74744) 검정 몫 = (5 + 1)/16 이다.
   */
  // 뷰어는 공용 팝업 0x741a0 안이라 키를 통째로 가져간다 — 누름도 경기 화면의 누름 칸(0xe '확인' 7 · '*' 따위)보다 위에 둔다(r195)
  return (
    <ScreenOverlay zIndex={SCREEN_LAYERS.COMMON_WINDOW}>
      <div className={styles.overGameDim} style={{ opacity: colorStepCoverOpacityOf(POPUP_DIM_STAGE) }} />
      <div className={styles.overGameCenter}>
        <div className={styles.overGameStage}>{body}</div>
      </div>
    </ScreenOverlay>
  )
}

/** 팝업 덮개 단계 — 0x7473c `movs r3, #5` (F-ui-layout 1절) */
const POPUP_DIM_STAGE = 5

/** 게임물 등급표 — 장 6 둘째 쪽(빈 StrHOWTO[33]) 자리 (0x54330, `HELP_RATING_TABLE`) */
function RatingTable() {
  const table = HELP_RATING_TABLE
  return (
    <div
      className={styles.ratingTable}
      data-testid="등급표"
      style={{ left: table.x, top: table.y, width: table.width + 1, height: table.height + 1, background: table.fill }}
    >
      <div className={styles.ratingLine} style={{ left: table.dividerX, top: 0, width: 1, height: table.height }} />
      {table.rows.map(([label, value], row) => (
        <div key={label}>
          <span className={styles.ratingText} style={{ left: table.labelX, top: row * table.rowHeight + table.textDy, color: table.text }}>
            {label}
          </span>
          <span className={styles.ratingText} style={{ left: table.valueX, top: row * table.rowHeight + table.textDy, color: table.text }}>
            {value}
          </span>
          <div className={styles.ratingLine} style={{ left: 0, top: (row + 1) * table.rowHeight, width: table.width, height: 1 }} />
        </div>
      ))}
    </div>
  )
}
