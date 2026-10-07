import { useEffect, useMemo, useRef, useState } from 'react'
import { RawScreen, ScreenOverlay } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import {
  BODY_PANEL,
  HELP_PANEL_CLOSE_HEIGHTS,
  HELP_PANEL_FULL_HEIGHT,
  HELP_PANEL_OPEN_HEIGHTS,
  HELP_VIEWER,
  SCREEN,
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

const SLT_FRAME = './sprites/slt_frame'
const SLT_FRAMES = './sprites/slt_frame/frames'
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
 * ⚠️ 근사한 곳: 판 0x55e60 · 본문 상자 0xbb28d 의 색과 테두리, 쪽 번호 숫자 그림(num.pzx 0x585ac)은 웹 글자로 둔다.
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

  /** 그린 횟수 — 깜빡임(+0x410)과 판 여닫기(+0x90)가 센다 */
  const tick = useUpdateCounter()
  /** CLR 로 닫기 연출을 시작한 그리기 번호 (메인 메뉴만 — 경기 중은 +0x125 라 곧장 닫는다) */
  const [closingFrom, setClosingFrom] = useState<number | null>(null)
  const closingStep = closingFrom === null ? null : tick - closingFrom
  const panelHeight =
    closingStep !== null
      ? HELP_PANEL_CLOSE_HEIGHTS[Math.min(closingStep, HELP_PANEL_CLOSE_HEIGHTS.length - 1)]
      : (HELP_PANEL_OPEN_HEIGHTS[tick] ?? HELP_PANEL_FULL_HEIGHT)
  const isAnimating = panelHeight < HELP_PANEL_FULL_HEIGHT
  const isBlinkOn = !isAnimating && tick % 8 <= 3

  const hasClosedRef = useRef(false)
  useEffect(() => {
    if (closingStep === null || closingStep < HELP_PANEL_CLOSE_HEIGHTS.length || hasClosedRef.current) return
    // 닫기 끝(+0x98)이 선 다음 갱신에 0x637d0 이 1 을 돌려준다
    hasClosedRef.current = true
    onBack()
  }, [closingStep, onBack])

  /** 0x63850 · 0x6387e — `+0x125`(경기 장면)면 곧장 닫고, 아니면 닫기 연출을 건다 */
  const close = () => {
    if (isOverGame) return onBack()
    setClosingFrom((previous) => previous ?? tick)
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
  const movePage = (step: number) => moveBy(false, step)
  const moveSection = (step: number) => moveBy(true, step)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 경기 중 메뉴 하위 4 의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — 뒤에 깔린 경기 화면(스윙·이동·'*')은 아무 키도 못 받는다.
      // 창의 잡기 단계에서 먼저 받아 뒤쪽 듣개로 안 넘긴다
      if (isOverGame) event.stopPropagation()
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
  const knobTop = helpScrollKnobTopOf(lines.length, viewer.scrollTop)
  const { knobLength } = helpScrollMetricsOf(lines.length)
  const visibleLines = lines.slice(viewer.scrollTop, viewer.scrollTop + HELP_TEXT_BOX.visibleLines)

  const tabBox = HELP_VIEWER.tabBoxes[section]
  const name = HELP_VIEWER.names[section]
  /** 웹판 단추 줄 — 원본은 키뿐이라 판 아래(y = 판 끝 + 4)에 둔다 */
  const webButtonTop = centerY + HELP_PANEL_FULL_HEIGHT / 2 + 4

  const body = (
    <>
      <div
        className={styles.panel}
        style={{ left: x0, top: panelTop, width: panelWidth, height: panelHeight }}
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

          <div className={styles.pagerText} style={{ left: BODY_PANEL.pager.numberX, top: BODY_PANEL.pager.y }}>
            {page + 1}/{pageCount}
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

          <div
            className={styles.innerBox}
            style={{
              left: HELP_VIEWER.innerBox.x,
              top: HELP_VIEWER.innerBox.y,
              width: HELP_VIEWER.innerBox.width,
              height: HELP_VIEWER.innerBox.height,
            }}
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
        <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={onBack} />
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
  return (
    <ScreenOverlay>
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
