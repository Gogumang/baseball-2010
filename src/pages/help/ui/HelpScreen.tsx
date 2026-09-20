import { useEffect, useState } from 'react'
import { MarkupText, RawScreen } from '@/shared/ui'
import {
  GAME_VERSION, HELP_LAST_BROWSABLE_CHAPTER, HELP_SECTIONS,
} from '@/shared/config/helpSections'
import { BODY_PANEL, FOOTER, HEADBAND, SCREEN } from '@/pages/help/lib/helpLayout'
import * as styles from '@/pages/help/ui/HelpScreen.css'

const GAME_FRAME = './sprites/game_frame'
const SLT_FRAME = './sprites/slt_frame'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface HelpScreenProps {
  readonly onBack: () => void
  /** 여는 장 — 메인 메뉴 [도움말](상태 7)은 **0**, [게임문의](상태 10)는 **6** (0x2668c) */
  readonly chapter?: number
  /** 상태 10 은 `[뷰어+0x45c] = 1` 로 장 이동을 잠근다 (0x2668c) */
  readonly isChapterLocked?: boolean
}

/**
 * 도움말 = 메인 메뉴 **상태 7** 의 StrHOWTO 뷰어 (그리기 0x2fc8c → 0x639a5 → 0x58d10 — S12 2절).
 *
 * ⚠️ **정정**: 앞서 옮긴 "상태 9 목록 + 상태 37 본문" 은 도움말이 아니라 **랭킹**이었다
 * (설명 글이 `StrMAINMENU[24 + 커서]` = "…의 순위를 확인합니다"). 랭킹 쪽 값은
 * `helpLayout.ts` 의 `RANKING_MENU_ITEMS`·`RANKING_TITLE_FRAMES` 에 남겨 두었다.
 *
 * 장은 원본 표 `0xd0b18 = [5,5,7,6,3,6,4]` 그대로 **일곱**이라(`helpSections.ts`)
 * 기본 조작·미션모드·환경설정까지 모두 이 화면에서 볼 수 있다. 메인 메뉴에서 돌아다닐 수 있는 장은
 * **0~5** 고(0x638be·0x63914), 장 6 게임문의는 상태 10 에서 잠긴 채 열린다.
 *
 * ⚠️ 근사한 곳: 판(0x58371)과 뷰어(0x58d10)의 안쪽 배치·쪽 나누기는 아직 미해독이라
 * 가운데 192 판에 기록연감 쪽 제목 줄을 썼고, 키도 웹판 나름이다
 * (원본은 좌우 키로 장을 넘긴다 — 0x637d0. 여기서는 좌우 = 쪽, 위아래 = 장).
 */
export function HelpScreen({ onBack, chapter = 0, isChapterLocked = false }: HelpScreenProps) {
  const [section, setSection] = useState(chapter)
  const [page, setPage] = useState(0)

  const pages = HELP_SECTIONS[section]?.pages ?? []
  const pageCount = Math.max(pages.length, 1)
  const movePage = (step: number) => setPage((previous) => (previous + step + pageCount) % pageCount)
  /** 장 넘기기 — 0~5 를 돌고 끝에서 되감는다 (0x638be `movs r4, #5` · 0x63914 `cmp r0, #4; bgt`) */
  const moveSection = (step: number) => {
    if (isChapterLocked) return
    const count = HELP_LAST_BROWSABLE_CHAPTER + 1
    setSection((previous) => (previous + step + count) % count)
    setPage(0)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        return onBack()
      }
      const pageStep = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (pageStep !== 0) {
        event.preventDefault()
        return movePage(pageStep)
      }
      const sectionStep = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (sectionStep !== 0) {
        event.preventDefault()
        moveSection(sectionStep)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <RawScreen>
      <div
        className={styles.panel}
        style={{ left: BODY_PANEL.x, top: BODY_PANEL.y, width: BODY_PANEL.width, height: BODY_PANEL.height }}
      />

      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, BODY_PANEL.bullet.image)}
        style={{ left: BODY_PANEL.bullet.x, top: BODY_PANEL.bullet.y }}
      />
      <div className={styles.bodyTitle} style={{ left: BODY_PANEL.titleX, top: BODY_PANEL.titleY }}>
        {HELP_SECTIONS[section]?.title ?? ''}
      </div>
      <div className={styles.pagerText} style={{ left: BODY_PANEL.pager.numberX, top: BODY_PANEL.pager.y }}>
        {page + 1}/{pageCount}
      </div>

      <div
        className={styles.bodyText}
        style={{
          left: BODY_PANEL.textX,
          top: BODY_PANEL.textY,
          width: BODY_PANEL.textWidth,
          height: BODY_PANEL.y + BODY_PANEL.height - BODY_PANEL.textY - 10,
        }}
      >
        <MarkupText raw={pages[page] ?? ''} replacements={[GAME_VERSION]} />
      </div>

      {/* 쪽 넘기기 화살 slt_frame 이미지 20 — 원본은 키지만 웹판은 누를 수 있게 둔다 */}
      <button
        type="button"
        className={styles.backButton}
        aria-label="이전 쪽"
        style={{ left: BODY_PANEL.pager.leftX, top: BODY_PANEL.pager.arrowY }}
        onClick={() => movePage(-1)}
      >
        <img src={imageSrc(SLT_FRAME, BODY_PANEL.pager.arrowImage)} alt="" />
      </button>
      <button
        type="button"
        className={styles.backButton}
        aria-label="다음 쪽"
        style={{ left: BODY_PANEL.pager.rightX, top: BODY_PANEL.pager.arrowY, transform: 'scaleX(-1)' }}
        onClick={() => movePage(1)}
      >
        <img src={imageSrc(SLT_FRAME, BODY_PANEL.pager.arrowImage)} alt="" />
      </button>

      {/* 장 넘기기 — 원본은 좌우 키(0x637d0), 웹판은 누를 수도 있게 둔다. 상태 10 은 잠긴다 */}
      {!isChapterLocked && (
        <>
          <button
            type="button"
            className={styles.sectionButton}
            aria-label="이전 장"
            style={{ left: BODY_PANEL.x + 6, top: BODY_PANEL.y + BODY_PANEL.height - 22 }}
            onClick={() => moveSection(-1)}
          >
            ‹ 앞 장
          </button>
          <button
            type="button"
            className={styles.sectionButton}
            aria-label="다음 장"
            style={{ left: BODY_PANEL.x + BODY_PANEL.width - 54, top: BODY_PANEL.y + BODY_PANEL.height - 22 }}
            onClick={() => moveSection(1)}
          >
            뒷 장 ›
          </button>
        </>
      )}

      <HelpBands onBack={onBack} />
    </RawScreen>
  )
}

/** 머리띠·바닥띠 0x54d95(메뉴, 0, 5) — 제목 "2010프로야구" + 바닥 되돌아가기 (P6 1-1) */
function HelpBands({ onBack }: { readonly onBack: () => void }) {
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
        <rect x={0} y={HEADBAND.band.y} width={SCREEN.width} height={HEADBAND.band.height} fill={HEADBAND.band.color} />
        <rect x={0} y={HEADBAND.line.y} width={SCREEN.width} height={HEADBAND.line.height} fill={HEADBAND.line.color} />
        <rect x={0} y={FOOTER.band.y} width={SCREEN.width} height={FOOTER.band.height} fill={FOOTER.band.color} />
        <rect x={0} y={FOOTER.line.y} width={SCREEN.width} height={1} fill={FOOTER.line.color} />
      </svg>
      {HEADBAND.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.tileImage)} style={{ left: x, top: HEADBAND.tileY }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.cornerImage)} style={{ left: HEADBAND.cornerX, top: HEADBAND.tileY }} />
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, HEADBAND.title.image)} style={{ left: HEADBAND.title.x, top: HEADBAND.title.y }} />
      {FOOTER.tileXs.map((x) => (
        <img key={x} className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.tileImage)} style={{ left: x, top: FOOTER.tileY }} />
      ))}
      <img className={styles.sprite} alt="" src={imageSrc(GAME_FRAME, FOOTER.cornerImage)} style={{ left: FOOTER.cornerX, top: FOOTER.tileY }} />
      <button
        type="button"
        className={styles.backButton}
        aria-label="되돌아가기"
        style={{ left: FOOTER.backIcon.x, top: FOOTER.backIcon.y }}
        onClick={onBack}
      >
        <img src={imageSrc(GAME_FRAME, FOOTER.backIcon.image)} alt="" />
      </button>
    </>
  )
}
