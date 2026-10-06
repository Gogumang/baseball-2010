import { useEffect, useState } from 'react'
import { MarkupText, RawScreen, ScreenOverlay } from '@/shared/ui'
import { GAME_VERSION, HELP_SECTIONS } from '@/shared/config/helpSections'
import { BODY_PANEL } from '@/pages/help/lib/helpLayout'
import { openHelpViewer, stepHelpViewer } from '@/pages/help/lib/helpViewer'
import type { HelpViewerKey, HelpViewerState } from '@/pages/help/lib/helpViewer'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

const SLT_FRAME = './sprites/slt_frame'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

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

/** 웹 키 → 원본 키 (위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16). '2'·'4'·'5'·'6'·'8' 은 0x637d0 이 안 본다 */
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
 * ⚠️ 근사한 곳: 판(0x58371)과 뷰어(0x58d10)의 안쪽 배치·쪽 나누기는 아직 미해독이라
 * 가운데 192 판에 기록연감 쪽 제목 줄을 썼다. 장 고르기와 쪽 보기가 그림에서 어떻게 다른지(0x58d10)도 안 읽어
 * 두 단계를 같은 그림으로 그린다. 쪽 넘기기·장 넘기기 단추는 웹판 편의다.
 */
export function HelpScreen({ onBack, chapter = 0, isChapterLocked = false, gamePoint }: HelpScreenProps) {
  const [viewer, setViewer] = useState<HelpViewerState>(() => openHelpViewer(chapter, isChapterLocked))
  const section = viewer.chapter
  const page = viewer.page

  const pages = HELP_SECTIONS[section]?.pages ?? []
  const pageCount = Math.max(pages.length, 1)
  /** 장마다 보이는 쪽수 (빈 StrHOWTO 항목은 뺀다 — `helpSections.ts`) */
  const pageCountOf = (chapterIndex: number) => Math.max(HELP_SECTIONS[chapterIndex]?.pages.length ?? 0, 1)
  /** 웹판 단추 — 단계와 상관없이 쪽 보기·장 고르기의 좌우와 같은 값을 낸다(단계는 그대로 둔다) */
  const moveBy = (isChapter: boolean, step: number) => {
    if (isChapter && isChapterLocked) return
    setViewer((previous) => {
      const next = stepHelpViewer(
        { ...previous, isChoosingChapter: isChapter }, step > 0 ? '오른' : '왼', false, pageCountOf(previous.chapter),
      )
      return next === '닫기' ? previous : { ...next, isChoosingChapter: previous.isChoosingChapter }
    })
  }
  const movePage = (step: number) => moveBy(false, step)
  const moveSection = (step: number) => moveBy(true, step)

  /** 경기 중 [조작방법] — 경기 장면 위에 얹힌다 (gamePoint 를 안 넘긴 쪽) */
  const isOverGame = gamePoint === undefined

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 경기 중 메뉴 하위 4 의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — 뒤에 깔린 경기 화면(스윙·이동·'*')은 아무 키도 못 받는다.
      // 창의 잡기 단계에서 먼저 받아 뒤쪽 듣개로 안 넘긴다
      if (isOverGame) event.stopPropagation()
      const key = viewerKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const next = stepHelpViewer(viewer, key, isChapterLocked, pageCountOf(viewer.chapter))
      if (next === '닫기') return onBack()
      setViewer(next)
    }
    window.addEventListener('keydown', onKeyDown, isOverGame)
    return () => window.removeEventListener('keydown', onKeyDown, isOverGame)
  })

  const body = (
    <>
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

      {gamePoint === undefined ? (
        // 경기 중 [조작방법] — 원본은 띠가 없고 CLR 로만 닫는다. 이 칸은 웹판 편의(터치)다
        <button
          type="button"
          className={styles.sectionButton}
          aria-label="닫기"
          style={{ left: BODY_PANEL.x + BODY_PANEL.width / 2 - 12, top: BODY_PANEL.y + BODY_PANEL.height - 22 }}
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
   * 단계 5 의 불투명도는 칠하기 함수 [0x15605d0] 본문을 못 읽어 단계/16 으로 둔다(경기 결과 판의 단계 8 과 같은 근사).
   */
  return (
    <ScreenOverlay>
      <div className={styles.overGameDim} style={{ opacity: POPUP_DIM_STAGE / DIM_STAGE_MAX }} />
      <div className={styles.overGameCenter}>
        <div className={styles.overGameStage}>{body}</div>
      </div>
    </ScreenOverlay>
  )
}

/** 팝업 덮개 단계 — 0x7473c `movs r3, #5` (F-ui-layout 1절) */
const POPUP_DIM_STAGE = 5
/** 단계의 끝 — 단계/16 근사 (CORRECTIONS: 반투명 L/16) */
const DIM_STAGE_MAX = 16
