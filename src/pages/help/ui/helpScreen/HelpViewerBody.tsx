import type { CSSProperties, ReactElement } from 'react'
import { CommonPanel, InsetBox } from '@/shared/ui'
import { HELP_PANEL_FULL_HEIGHT, HELP_VIEWER, SCREEN } from '@/pages/help/lib/helpLayout'
import { HELP_TEXT_BOX, helpPageCountOf, isHelpRatingPage, type wrapHelpText } from '@/pages/help/lib/helpPages'
import type { HelpViewerState } from '@/pages/help/lib/helpViewer'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { HelpPager } from './HelpPager'
import { HelpScrollBar } from './HelpScrollBar'
import { HelpTextLines } from './HelpTextLines'
import { HelpViewerTitle } from './HelpViewerTitle'
import { RatingTable } from './RatingTable'

/** 웹판 단추 줄 — 원본은 키뿐이라 판 아래(y = 판 끝 + 4)에 둔다 */
export const HELP_WEB_BUTTON_TOP = HELP_VIEWER.centerY + HELP_PANEL_FULL_HEIGHT / 2 + 4

/** 장 넘기기 — 원본은 좌우 키(0x637d0), 웹판은 누를 수도 있게 둔다. 상태 10 은 잠긴다 */
function SectionButtons({ onMoveSection }: { readonly onMoveSection: (step: number) => void }) {
  const { x0, panelWidth } = HELP_VIEWER
  return (
    <>
      <button
        type="button"
        className={styles.sectionButton}
        aria-label="이전 장"
        style={{ left: x0 + 6, top: HELP_WEB_BUTTON_TOP }}
        onClick={() => onMoveSection(-1)}
      >
        ‹ 앞 장
      </button>
      <button
        type="button"
        className={styles.sectionButton}
        aria-label="다음 장"
        style={{ left: x0 + panelWidth - 54, top: HELP_WEB_BUTTON_TOP }}
        onClick={() => onMoveSection(1)}
      >
        뒷 장 ›
      </button>
    </>
  )
}

/**
 * 뷰어 판 한 장 (그리기 `0x58fd4` — `helpLayout` 의 `HELP_VIEWER` 표): 판 · 장 머리 · 쪽 번호와 화살 · 본문 상자 · 스크롤 막대 ·
 * 글 11줄(장 6 둘째 쪽은 등급표 0x54330). **장 고르기와 쪽 보기의 그림 차이는 무엇이 깜빡이느냐뿐이다** — 장 고르기는 장 테두리가
 * 깜빡이고 쪽 화살이 늘 보이며, 쪽 보기는 반대다(0x59090 · 0x59196)
 */
export function HelpViewerBody({
  viewer,
  lines,
  panelHeight,
  isAnimating,
  isBlinkOn,
  isChapterLocked,
  onMovePage,
  onMoveSection,
  namePalette,
}: {
  readonly viewer: HelpViewerState
  readonly lines: ReturnType<typeof wrapHelpText>
  readonly panelHeight: number
  readonly isAnimating: boolean
  readonly isBlinkOn: boolean
  readonly isChapterLocked: boolean
  readonly onMovePage: (step: number) => void
  readonly onMoveSection: (step: number) => void
  /** 장 이름 글자의 팔레트 3 (`useImgTextPalette3`) */
  readonly namePalette: { readonly definition: ReactElement; readonly style: CSSProperties }
}) {
  const { chapter: section, page } = viewer
  const { x0, panelWidth, centerY } = HELP_VIEWER
  const panelTop = centerY - Math.trunc(panelHeight / 2)
  // 자르기 창 0xbae25 — 연출 중에는 판 안쪽(위아래 5 씩 안), 다 열리면 판보다 위아래 5 씩 넓게 (0x58de4 · 0x58ef8)
  const clipTop = isAnimating ? panelTop + 5 : panelTop - 5
  const clipHeight = isAnimating ? Math.max(panelHeight - 10, 0) : panelHeight + 10
  return (
    <>
      {namePalette.definition}
      {/* 판 0x55e60(skin, W/2, H/2, 192, +0x90, 0, 0x22, …) — [+0x45c] 면 (띠 0, 0, 제목 탭 1) 아니면 (띠 0x10, 0, 0) (0x58dea~0x58ec6) */}
      <CommonPanel x={x0} y={panelTop} width={panelWidth} height={panelHeight} topBand={isChapterLocked ? 0 : 0x10} titleTab={isChapterLocked} />
      <div className={styles.clip} style={{ left: 0, top: clipTop, width: SCREEN.width, height: clipHeight }}>
        <div style={{ position: 'absolute', left: 0, top: -clipTop, width: SCREEN.width, height: SCREEN.height }}>
          <HelpViewerTitle
            section={section}
            isChapterLocked={isChapterLocked}
            showsHighlight={!viewer.isChoosingChapter || isBlinkOn}
            namePaletteStyle={namePalette.style}
          />
          <HelpPager page={page} pageCount={helpPageCountOf(section)} showsArrows={viewer.isChoosingChapter || isBlinkOn} onMovePage={onMovePage} />
          {/* 본문 상자 0xbb28d(x0 + 5, y0 + 0x24, 0xac, 0xab, 정렬 1) (0x59208~0x5921a) */}
          <InsetBox x={HELP_VIEWER.innerBox.x} y={HELP_VIEWER.innerBox.y} width={HELP_VIEWER.innerBox.width} height={HELP_VIEWER.innerBox.height} />
          <HelpScrollBar lineCount={lines.length} scrollTop={viewer.scrollTop} isChoosingChapter={viewer.isChoosingChapter} />
          {isHelpRatingPage(section, page) ? (
            <RatingTable />
          ) : (
            <HelpTextLines lines={lines.slice(viewer.scrollTop, viewer.scrollTop + HELP_TEXT_BOX.visibleLines)} firstLine={viewer.scrollTop} />
          )}
        </div>
      </div>
      {!isChapterLocked && <SectionButtons onMoveSection={onMoveSection} />}
    </>
  )
}
