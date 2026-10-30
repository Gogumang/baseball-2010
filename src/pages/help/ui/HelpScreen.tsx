import { useEffect, useMemo, useState } from 'react'
import { RawScreen, ScreenOverlay, useImgTextPalette3 } from '@/shared/ui'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { helpPageCountOf, helpPageRawOf, wrapHelpText } from '@/pages/help/lib/helpPages'
import { openHelpViewer, stepHelpViewer } from '@/pages/help/lib/helpViewer'
import type { HelpViewerState } from '@/pages/help/lib/helpViewer'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import { HELP_GRID_DIRECTIONS, viewerKeyOf } from './helpScreen/helpKeys'
import { HelpCloseFrame } from './helpScreen/HelpCloseFrame'
import { HelpViewerBody } from './helpScreen/HelpViewerBody'
import { useHelpPanel } from './helpScreen/useHelpPanel'

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

/** 장 고르기 → 쪽 보기 — OK(Enter) */
const HELP_OPEN_PAGE_OFFER: TouchKeyOffer = { key: 'Enter', label: '쪽 보기' }

/** 팝업 덮개 단계 — 0x7473c `movs r3, #5` (F-ui-layout 1절) */
const POPUP_DIM_STAGE = 5

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
  const lines = useMemo(() => wrapHelpText(helpPageRawOf(section, page)), [section, page])
  const lineCountOf = (state: HelpViewerState) => wrapHelpText(helpPageRawOf(state.chapter, state.page)).length
  const panel = useHelpPanel(isOverGame, onBack)

  /** 웹판 단추 — 단계와 상관없이 쪽 보기·장 고르기의 좌우와 같은 값을 낸다(단계는 그대로 둔다) */
  const moveBy = (isChapter: boolean, step: number) => {
    if (isChapter && isChapterLocked) return
    setViewer((previous) => {
      const next = stepHelpViewer({ ...previous, isChoosingChapter: isChapter }, step > 0 ? '오른' : '왼', false, helpPageCountOf(previous.chapter))
      return next === '닫기' ? previous : { ...next, isChoosingChapter: previous.isChoosingChapter }
    })
  }
  // 터치 기기 — 장 고르기의 OK(쪽 보기로)는 원본 그림에 글자 자리가 없어 '쪽 보기' 상황 버튼으로 낸다(r186 — 늘 있던 확인 버튼을
  // 걷었다). 버튼은 Enter 키 사건이라 아래 듣는 곳(0x637d0)과 같은 길이다
  useTouchKeyOffer(viewer.isChoosingChapter && panel.isBodyShown && !panel.isClosing ? HELP_OPEN_PAGE_OFFER : null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 경기 중 메뉴 하위 4 의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — 뒤에 깔린 경기 화면(스윙·이동·'*')은 아무 키도 못 받는다.
      // 창의 잡기 단계에서 먼저 받아 뒤쪽 듣개로 안 넘긴다
      if (isOverGame) event.stopPropagation()
      // 63804 는 [뷰어+0x314] ≠ 0 이면 키를 다 버린다. 그 칸은 앱 전역 객체 [0x1552cfc](메인 장면 +0x120 도 같은 것 — 23634)의
      // 장면 팝업 걸음이라 뷰어 skin 과 같은 객체지만, 뷰어를 열 때 0x63688 이 0 을 쓰고(63774) 메인 장면은 상태가 바뀔 때마다
      // 0x3299c 가 0 으로 지운다. 0 아닌 값은 뷰어가 아닌 메인 상태 21(0x29df8) · 27(0x2ad88 · 0x2ae56) · 28(0x2b234)의 팝업만
      // 쓴다 — 뷰어 키(메인 상태 7 · 10 의 0x2cd54, 경기 0x3ca36) 때는 늘 0 이라 버리는 길이 서지 않는다(r207, U-86)
      // 뷰어 키 0x637d0 은 맨 앞에서 격자 [skin+0x454] vt+0x18 이 돌려준 키를 0x5550c(skin, 키)에 넘긴다(637e2~637f0) — 갈래 없이
      // 늘. 그 격자는 뷰어 열기 0x63688 의 `vt+0x1c(3, 1, 1, 0x10)`(6371a) 로 [격자+4] = 숫자키 꼴 1 이라(0x6bfe8) '2' '4' '6' '8' 도
      // 방향으로 바뀌어 까딱임 방향 [skin+0x8c] 에 남는다(Q-10)
      const noted = HELP_GRID_DIRECTIONS[event.key]
      if (noted !== undefined) noteSkinShakeDirection(noted)
      const key = viewerKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const next = stepHelpViewer(viewer, key, isChapterLocked, helpPageCountOf(viewer.chapter), lineCountOf(viewer))
      if (next === '닫기') return panel.close()
      setViewer(next)
    }
    window.addEventListener('keydown', onKeyDown, isOverGame)
    return () => window.removeEventListener('keydown', onKeyDown, isOverGame)
  })

  /**
   * 장 이름 · 잠긴 제목 img_text 는 **팔레트 3**(#2949A5 · #10246B)으로 찍는다 — 0x58e30~0x58e58 · 0x58ff2~0x5901c 가
   * `0x913e5(img_text, 3)` 를 부른 뒤 0xba759 로 그린다(직접 떴다). 기본 팔레트(흰 글자)로 찍으면 흰 띠 위에서 안 보인다.
   */
  const namePalette = useImgTextPalette3()
  const body = (
    <>
      {panel.isBodyShown && (
        <HelpViewerBody
          viewer={viewer}
          lines={lines}
          panelHeight={panel.panelHeight}
          isAnimating={panel.isAnimating}
          isBlinkOn={panel.isBlinkOn}
          isChapterLocked={isChapterLocked}
          onMovePage={(step) => moveBy(false, step)}
          onMoveSection={(step) => moveBy(true, step)}
          namePalette={namePalette}
        />
      )}
      <HelpCloseFrame gamePoint={gamePoint} onBack={onBack} />
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
