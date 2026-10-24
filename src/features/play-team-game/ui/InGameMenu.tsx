import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { activeSound } from '@/shared/api/audio/soundPort'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite, MessageBox, PressArea, RoundBox, SolidStamp } from '@/shared/ui'
import { useImgTextPalette3 } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import {
  IN_GAME_MENU_LABEL_FRAMES,
  IN_GAME_MENU_LABELS,
  IN_GAME_MENU_SLIDE_END,
  IN_GAME_MENU_TITLE_FRAME,
  inGameMenuLayoutOf,
  inGameMenuOf,
  inGameMenuSlideAt,
  quitConfirmTextOf,
  REPLAY_CONFIRM,
} from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction, InGameMenuLayout } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuCloser, InGameMenuOpening } from '@/features/play-team-game/model/useInGameMenuState'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as styles from '@/features/play-team-game/ui/InGameMenu.css'

const IMG_TEXT_FRAMES = './sprites/img_text/frames'
/** ui/num.pzx — 칸 번호 0xba689 의 글꼴 [[[장면+0x1014]+8]+8], 기준 그림 0 */
const NUM = './sprites/num'
/** num 그림 0~9 의 폭 (public/sprites/num/000~009.png — "1" 만 4, 나머지 8 · 높이 모두 10) */
const NUM_DIGIT_WIDTHS = [8, 4, 8, 8, 8, 8, 8, 8, 8, 8] as const

/**
 * 판 색 — 0x3ce8c 리터럴 0xc8335fcd(칠) · 0x3ce96 `0xc8 << 24`(테두리). 윗바이트 0xc8 은 알파라 0x6b7d4 · 0x6aa64 가
 * 0x1400698(gc, 4, 알파) 로 반투명을 켠다(F 4절). ⚠️ 미확인: 섞기 식은 단말 몫(바이너리에 없음) — 알파/255 로 근사했다.
 */
const BOX_ALPHA = (0xc8 / 0xff).toFixed(4)
const BOX_FILL = `rgba(51, 95, 205, ${BOX_ALPHA})`
const BOX_EDGE = `rgba(0, 0, 0, ${BOX_ALPHA})`
/** 칸 칠 — 고른 칸 0x1400748(0xff, 0xd8, 0) · 아닌 칸 0x1400748(0x33, 0x5f, 0xcd) (0x3cf70 · 0x3cf78 · 0x3cfee · 0x3d040) */
const PILL_SELECTED = '#FFD800'
const PILL_NORMAL = '#335FCD'
/** 막힌 자동진행 칸 이름 — 효과 0xb(단색) 0x1400748(0x80, 0x80, 0x80) (0x3cfa4~0x3cfae) */
const DISABLED_LABEL = '#808080'
/** img_text 팔레트 4 (#7B797B · #525152) — "MENU" 머리. 흰 글자 그림(R=G=B)을 두 색으로 잇는 1차식 */
const PALETTE4_MATRIX = '2.5625 0 0 0 -2.08015  0 2.5 0 0 -2.02549  0 0 2.5625 0 -2.08015  0 0 0 1 0'

/**
 * StrGAME[3]/[4] — "자동진행을 하시겠습니까? %d G포인트가 소모됩니다" (R10 7절 116행에 원문이 있다).
 * `%d` 는 `sprintf` 로 비용이 들어간다 (0x3c67e = 100 · 0x3c694 = 30).
 */
const autoProgressConfirmOf = (cost: number) =>
  `!C!cFFFFFF자동진행을 하시겠습니까?!N!cFFFF00${cost} G포인트!cFFFFFF가 소모됩니다`

/** StrGAME[2] — 대전모드 6회 제한 알림 (`base/extracted/StrGAME.json` [2] 원문 그대로) */
const VERSUS_INNING_LIMIT_NOTICE = '!C!cFFFFFF대전모드는 6회까지만!N자동진행 가능합니다'

/** StrGAME[5] — G포인트 부족 알림 (`0x3c7d8`, `base/extracted/StrGAME.json` [5] 원문 그대로) */
const NOT_ENOUGH_GAME_POINT =
  '!C!cFFFFFF자동진행을 할 수 없습니다!N!cFF0000G포인트가 부족합니다!cFFFFFF!N!N[!cFFFF00스페셜!cFFFFFF] [!cFFFF00G포인트충전!cFFFFFF]!N에서 충전할 수 있습니다'

interface InGameMenuProps {
  /** 전역 게임 모드 — 표 0xcfcfc 의 행을 고른다 */
  readonly mode: number
  /** 메뉴를 닫고 경기로 돌아간다 (칸 "계속하기", CLR·'*' 와 같다) */
  readonly onContinue: () => void
  /** 칸 "메인메뉴"(나가기). 안 넘기면 칸이 잠긴다 */
  readonly onQuit?: () => void
  /** 칸 "게임방법" (`0x3c212` → StrHOWTO 뷰어) */
  readonly onOpenHelp?: () => void
  /** 칸 "환경설정" (`0x3c326` — 경기 중 환경설정 작은 판) */
  readonly onOpenSettings?: () => void
  /**
   * 칸 "자동진행" — **비용을 치를 수 있을 때만** 부른다. 인자는 깎아야 할 G포인트다.
   * 앱은 이 값만큼 저장의 G포인트를 줄이면 된다 (`저장+0x64`, 상한 99999).
   */
  readonly onAutoProgress?: (cost: number) => void
  /** 자동진행 비용 (`autoProgressCostOf`) */
  readonly autoProgressCost?: number
  /**
   * 대전모드 6회 제한을 통과했는가 (`canAutoProgress`). 거짓이면 그리기 0x3cdd0 이 칸 이름을 회색 단색으로 찍고(3cf0a~3cf12 —
   * 모드 8·9 에서 [경기+0x6b] > 5), 고르면 StrGAME[2] 알림만 뜬다(0x3c60c).
   */
  readonly canAutoProgress?: boolean
  /** 지금 가진 G포인트. 안 넘기면 비용을 검사할 수 없어 자동진행 칸이 잠긴다 */
  readonly gamePoint?: number
  /** 칸 "재도전"(다시하기, StrGAME[7], `0x3c706`) — 미션·홈런더비 행에만 있다 */
  readonly onRestart?: () => void
  /**
   * 처음 띄울 커서 칸 (메뉴 객체 +0xf30 의 커서). [조작방법]·[설정]에서 돌아오면 원본은 커서를 그대로 둔다
   * (`useInGameMenuState` 머리말) — 부르는 쪽이 `onCursorChange` 로 받아 둔 값을 다시 넘긴다. 기본 0.
   */
  readonly cursor?: number
  readonly onCursorChange?: (cursor: number) => void
  /**
   * '\*' 로 **새로 연** 메뉴인가 — 0x3c02c 만 [장면+0x1954] 를 0 으로 되돌려 판이 왼쪽에서 밀려 든다(`inGameMenuSlideAt`).
   * [조작방법]·[설정]에서 돌아오면 거짓(0x44 그대로). 기본 거짓.
   */
  readonly slidesIn?: boolean
  /** 창이 어떻게 떴는가(`useInGameMenuState` 의 `opening`) — 펼침 · 닫힘 갱신 수가 갈린다. 기본 '별표' */
  readonly opening?: InGameMenuOpening
  /** 여는 곳의 닫기(CLR · '*' · 계속)를 창에 맡긴다 (`useInGameMenuState` 의 `bindCloser`) */
  readonly bindCloser?: (closer: InGameMenuCloser | null) => void
}

/**
 * **경기 중 메뉴 '\*'** — 일시정지 팝업 0x741a0(그리기 0x3cdd0 · 키 0x3c158)의 판과 질문 창.
 *
 * 판은 화면 왼쪽 아래의 반투명 파란 둥근 칸(0x5eec5) · "MENU" · 칸마다 둥근 칠 · 번호(num) · 이름 그림(img_text)이다
 * (`inGameMenuLayoutOf`). 칸 목록은 전역 모드가 고르는 표 `0xcfcfc` 그대로다 — `model/inGameMenu` 참고.
 * 질문(나가기 · 다시하기 · 자동진행)은 공용 창 0x74ef5(종류 2 예/아니오 · 종류 1 알림) — `MessageBox`.
 * 여는 곳(경기 화면)이 240×320 판 위 층(inset 0)에 놓는다. 마우스 길은 칸 그림 자리의 투명 누름 칸이다.
 *
 * 키(0x3c158 하위 0 → 격자 0x6c031, 1열 · 꼴 0x230 · 숫자키 꼴 2): ↑↓ 세로 감기 · 숫자 d 는 칸 d − 1 로 옮기고 곧바로 OK ·
 * OK 고름 · CLR · '\*' 닫기(0x3c1a8). 소리는 없다(0x3c17e~0x3c1fc 에 소리 부름이 없다).
 * 닫힘은 공용 창의 [+0x215] 갈래다(`PauseWindow`) — 여는 곳은 `useInGameMenuState` 의 `close` 를 쓰고 `bindCloser` 로 창에 맡긴다.
 */
export function InGameMenu({
  mode,
  onContinue,
  onQuit,
  onOpenHelp,
  onOpenSettings,
  onAutoProgress,
  autoProgressCost = 0,
  canAutoProgress = true,
  gamePoint,
  onRestart,
  cursor: initialCursor = 0,
  onCursorChange,
  slidesIn = false,
  opening = '별표',
  bindCloser,
}: InGameMenuProps) {
  const [confirming, setConfirming] = useState<InGameMenuAction | null>(null)
  const actions = inGameMenuOf(mode)
  /** 질문 창에서 돌아와도 같은 메뉴 객체라 커서가 남는다 */
  const [cursor, setCursor] = useState(() => (initialCursor >= 0 && initialCursor < actions.length ? initialCursor : 0))
  /**
   * 알림 — `after` 는 닫힌 뒤의 길: '메뉴' 는 대전 6회 알림(하위 6 · 닫힘 콜백 0x3c159 → 0x3cd5c 가 메뉴를 다시 띄운다),
   * '경기' 는 자동진행 [예] 뒤 G포인트 부족(하위 2 0x3c7d8 — 닫힘 콜백 없이 하위 0 으로 두고 끝, 아래 `NOT_ENOUGH_GAME_POINT`)
   */
  const [notice, setNotice] = useState<{ readonly text: string; readonly after: '메뉴' | '경기' } | null>(null)
  /** 일시정지 창 한 벌 — 질문 [아니오] · 알림 [확인] 이 창을 새로 띄울 때(0x75440 → 0x741a0) 늘린다 */
  const [pauseWindow, setPauseWindow] = useState<{ readonly serial: number; readonly opening: InGameMenuOpening; readonly slidesIn: boolean }>(
    () => ({ serial: 0, opening, slidesIn }),
  )
  /**
   * 일시정지 창이 아직 서 있는가 — 질문 [예](나가기 · 다시하기 · 자동진행) · [조작방법] · [설정] 으로 넘어간 뒤면 거짓이라 여는 곳의
   * 닫기가 곧바로 닫는다. 질문 · 알림 창이 떠 있는 동안은 그 창이 키를 잡는다(`MessageBox`).
   */
  const handedOffRef = useRef(false)
  const isMessageShownRef = useRef(false)
  isMessageShownRef.current = confirming !== null || notice !== null
  /** 서 있는 창의 닫기 — 창이 키를 안 받으면 거짓 */
  const windowCloseRef = useRef<((onClosed: () => void) => boolean) | null>(null)

  useEffect(() => {
    if (bindCloser === undefined) return undefined
    bindCloser((finish) => {
      if (handedOffRef.current) return false
      // 질문 · 알림 창이 떠 있거나 일시정지 창이 펼치는 · 줄이는 중이면 키를 안 본다 (0x754f8 → 0x75556 · 0x7558a 갈래)
      if (isMessageShownRef.current) return true
      windowCloseRef.current?.(finish)
      return true
    })
    return () => bindCloser(null)
  }, [bindCloser])

  const onCursorChangeRef = useRef(onCursorChange)
  onCursorChangeRef.current = onCursorChange
  const moveCursor = (next: number) => {
    setCursor(next)
    onCursorChangeRef.current?.(next)
  }

  /** 앱이 손잡이를 안 넘긴 칸은 잠근다 — 원본에는 없는 웹판 가드다 */
  const isEnabled = (action: InGameMenuAction): boolean => {
    switch (action) {
      case '계속':
        return true
      case '조작방법':
        return onOpenHelp !== undefined
      case '설정':
        return onOpenSettings !== undefined
      case '자동진행':
        return onAutoProgress !== undefined && gamePoint !== undefined
      case '다시하기':
        return onRestart !== undefined
      case '나가기':
        return onQuit !== undefined
    }
  }

  /** 질문 · 알림 창을 띄운다 — 0x74ef5 는 창이 떠 있어 대기 칸에 적히고, 일시정지 창이 [+0x215] 로 닫힌 갱신에 0x75440 이 띄운다 */
  const askAfterClose = (show: () => void) => {
    if (windowCloseRef.current?.(show) !== true) show()
  }

  /** 점프표 0xcff84 */
  const choose = (action: InGameMenuAction) => {
    if (!isEnabled(action)) return
    // [계속하기](0x3c1fe) — [창+0x215] = 1 · 하위 0. 여는 곳의 닫기가 창의 닫힘을 탄다
    if (action === '계속') return onContinue()
    // [조작방법](코드 1 0x3c212 → 하위 4) · [설정](코드 2 0x3c326 → 하위 5)은 뷰어를 세운 뒤 일시정지 팝업을 다시 띄우기
    // 직전(0x3c2f8 · 0x3c45c)에 울리던 소리를 끊는다(0x6e418)
    // 이 갈래는 [창+0x215] = 1 · 하위 4|5 와 함께 **[창+0x290] = 0** 을 쓴다(0x3c310~0x3c31a · 0x3c474~0x3c47e) — 어떻게 연 창이든
    // 다음 갱신 첫 갈래가 줄임 없이 닫고 대기 칸(같은 0x741a0)을 띄운다. 그동안 그리기 콜백 0x3cdd0 은 하위 4 면 뷰어 0x639a5(skin)
    // 하나(0x3ce54), 하위 5 면 설정 판 0x593c9(skin, [장면+0xf94], 8) 하나(0x3ce60)만 그리고 메뉴 판(0x3ce76~)은 건너뛴다 —
    // 키를 받은 그림부터 뷰어 · 설정 판이다. 웹이 곧바로 넘어가는 것과 같다
    if (action === '조작방법') {
      activeSound().stop()
      handedOffRef.current = true
      return onOpenHelp?.()
    }
    if (action === '설정') {
      activeSound().stop()
      handedOffRef.current = true
      return onOpenSettings?.()
    }
    // 대전모드는 6회를 넘기면 질문 없이 StrGAME[2] 알림만 뜬다 (0x3c60c — 0x74ef5 종류 1 · 0x7442d · 하위 6 · [창+0x215])
    if (action === '자동진행' && !canAutoProgress) {
      return askAfterClose(() => setNotice({ text: VERSUS_INNING_LIMIT_NOTICE, after: '메뉴' }))
    }
    // 나가기 0x3c504 · 자동진행 0x3c67e~ · 다시하기 0x3c706 — 0x74ef5 → 0x7442d(닫힘 콜백 0x3c159) · [창+0x215] = 1 · 하위 1|2|3
    askAfterClose(() => setConfirming(action))
  }

  /** 질문 [아니오] · 알림 [확인] — 닫힘 콜백(하위 1 0x3c7a6 · 하위 6 0x3cd5c)이 일시정지 창을 다시 띄운다(밀려 들기부터) */
  const reopenPauseWindow = () => {
    setPauseWindow((previous) => ({ serial: previous.serial + 1, opening: '질문뒤', slidesIn: true }))
  }

  /**
   * '\*' 로 연 창([+0x290] = 0) 뒤의 질문 · 알림은 앞 창을 닫은 갱신이 0x754f8 첫 갈래 → 0x75440 → 75556 펼침으로 이어져 첫 그림이
   * 이미 높이 20 이다. 다시 띄운 창([+0x290] = 1)은 줄임(0x7558a) 끝의 0x75440 뒤 곧장 돌아가(755d8) 10 부터다.
   */
  const opensOneStepIn = pauseWindow.opening === '별표'

  if (notice !== null) {
    return (
      <MessageBox text={notice.text} buttons={['확인']} dimOpacity={POPUP_DIM_OPACITY} closesWithoutShrink
        opensOneStepIn={notice.after === '메뉴' && opensOneStepIn}
        onAnswer={() => {
          const after = notice.after
          setNotice(null)
          // 대전 6회 알림(하위 6) — 닫힘 콜백 0x3c159 → 0x3cd5c 가 일시정지 창을 다시 띄운다
          if (after === '메뉴') return reopenPauseWindow()
          // G포인트 부족(하위 2 0x3c7d8 → 0x3c812~0x3c838): 0x74ef5(…, StrGAME[5], 종류 0x81) 뒤 하위 0 으로 두고 끝난다 — 0x7442d 가
          // 없어 이 알림의 닫힘 콜백은 없다(질문 창의 [+0x228] 은 0x742a8 이 0x74330 에서 지우고, 대기 칸 [+0x3c0] 은 0x75440 이
          // 옮긴 뒤 0x754e6 에서 지운다). 알림이 닫히면 창이 하나도 없어 경기가 이어진다 — 메뉴를 다시 띄우지 않는다
          handedOffRef.current = true
          onContinue()
        }} />
    )
  }

  if (confirming !== null) {
    const text =
      confirming === '나가기'
        ? quitConfirmTextOf(mode)
        : confirming === '다시하기'
          ? REPLAY_CONFIRM
          : autoProgressConfirmOf(autoProgressCost)
    // 질문 창이 뜨는 갱신은 0x74ef4 가 [+0x250] = 1 이라 경기 장면을 한 번 다시 그리고(52efe) 그 위를 한 번 어둡게 덮는다 —
    // 메뉴 판은 그때 지워진다. 경기 장면 [창+0x24e] = 1 이라 답하면 줄임 없이 다음 갱신에 닫힌다(`closesWithoutShrink`).
    // '별표' 창 뒤의 질문은 첫 그림이 이미 높이 20 이다(`opensOneStepIn`)
    return (
      <MessageBox
        key={confirming}
        text={text}
        buttons={['예', '아니오']}
        dimOpacity={POPUP_DIM_OPACITY}
        closesWithoutShrink
        opensOneStepIn={opensOneStepIn}
        onAnswer={(index) => {
          const asked = confirming
          setConfirming(null)
          // 아니오 · CLR(키 표 −16 → −1, 0x3c55a~0x3c570)은 일시정지 팝업을 다시 띄운다 — 메뉴 커서 그대로
          if (index !== 0) return reopenPauseWindow()
          handedOffRef.current = true
          if (asked === '나가기') return onQuit?.()
          if (asked === '다시하기') return onRestart?.()
          // 자동진행 — 확정(예) 하위 2 = 0x3c7d8 이 여기서 G포인트를 검사한다
          if (gamePoint === undefined || gamePoint < autoProgressCost) {
            handedOffRef.current = false
            setNotice({ text: NOT_ENOUGH_GAME_POINT, after: '경기' })
            return
          }
          onAutoProgress?.(autoProgressCost)
        }}
      />
    )
  }

  return (
    <PauseWindow
      key={pauseWindow.serial}
      opening={pauseWindow.opening}
      slidesIn={pauseWindow.slidesIn}
      actions={actions}
      cursor={cursor}
      canAutoProgress={canAutoProgress}
      isEnabled={isEnabled}
      onMoveCursor={moveCursor}
      onChoose={choose}
      onRequestClose={() => onContinue()}
      windowCloseRef={windowCloseRef}
    />
  )
}

/**
 * **일시정지 창 한 벌** — 0x741a0(창, 목표 높이 0, 그리기 0x3cdd1, 키 0x3c159, 장면). 목표 높이 0 이라 판 0x744c4 는 안 긋고
 * (0x7478a) 그리기 콜백 0x3cdd0 이 메뉴 판을 그린다. 펼치는 동안([+0x214])은 그리기 콜백을 안 부르고(0x7479c) 뒤 어둡게만 남는다.
 * 닫힘은 키 콜백이 [창+0x215] = 1 을 쓰는 것뿐이고(0x3c1a8 CLR · '*' · 0x3c1fe 계속 · 질문 갈래들 — 0x742a9 는 안 부른다),
 * 그동안 그리기 콜백은 돌아 메뉴가 그대로 남고 키는 안 본다(0x7558a). '별표' 창은 [+0x290] = 0 이라 다음 갱신에, 그 밖은 폭
 * 240 → 120 → 닫힘 두 갱신 뒤에 내려간다(`InGameMenuOpening`).
 */
function PauseWindow({
  opening, slidesIn, actions, cursor, canAutoProgress, isEnabled, onMoveCursor, onChoose, onRequestClose, windowCloseRef,
}: {
  readonly opening: InGameMenuOpening
  readonly slidesIn: boolean
  readonly actions: readonly InGameMenuAction[]
  readonly cursor: number
  readonly canAutoProgress: boolean
  readonly isEnabled: (action: InGameMenuAction) => boolean
  readonly onMoveCursor: (cursor: number) => void
  readonly onChoose: (action: InGameMenuAction) => void
  /** CLR · '*' (0x3c1a8) — 여는 곳의 닫기(계속과 같다) */
  readonly onRequestClose: () => void
  readonly windowCloseRef: { current: ((onClosed: () => void) => boolean) | null }
}) {
  // 레이아웃이 없는 환경(시험)에서는 `MessageBox` 처럼 펼침 · 닫힘을 건너뛴다
  const dimRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((dimRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({
    targetHeight: 0,
    expands: opening !== '별표',
    opensAtOnce: opening === '복귀',
    skipsMotion: hasNoLayout,
  })
  const motionRef = useRef(motion)
  motionRef.current = motion
  // 창이 키를 받을 때만 닫는다 — 펼침 · 줄임 중이면 그 키는 버려지지만(0x75556 · 0x7558a) 닫기 요청은 받은 셈이다
  useLayoutEffect(() => {
    windowCloseRef.current = (onClosed) => {
      const current = motionRef.current
      if (!current.acceptsKeys()) return true
      return current.close('줄임', onClosed)
    }
    return () => {
      windowCloseRef.current = null
    }
  }, [windowCloseRef])

  /** 그린 횟수 — 밀려 들기 [장면+0x1954] 를 정한다. 그리기 콜백은 펼치는 동안 안 돈다(0x7479c) */
  const isShown = motion.openingHeight === null
  const [slideFrame, setSlideFrame] = useState(() => (slidesIn ? 0 : Number.POSITIVE_INFINITY))
  const slide = Number.isFinite(slideFrame) ? inGameMenuSlideAt(slideFrame) : IN_GAME_MENU_SLIDE_END
  useEffect(() => {
    if (!isShown || slide >= IN_GAME_MENU_SLIDE_END) return
    const timer = setAppTickInterval(() => setSlideFrame((frame) => frame + 1))
    return () => timer()
  }, [isShown, slide])

  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const latest = useRef({ actions, onMoveCursor, onChoose, onRequestClose })
  latest.current = { actions, onMoveCursor, onChoose, onRequestClose }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const { actions: current, onMoveCursor: move, onChoose: choose, onRequestClose: requestClose } = latest.current
      // 펼치는 동안('별표' 창 말고) · 줄이는 동안은 키 콜백 0x3c158 을 안 부른다
      if (!motionRef.current.acceptsKeys()) return
      const count = current.length
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        // 꼴 0x20 — 세로 감기
        const step = event.key === 'ArrowDown' ? 1 : -1
        const next = (cursorRef.current + step + count) % count
        cursorRef.current = next
        return move(next)
      }
      // 숫자키 꼴 2(0x6c100~0x6c14e) — 숫자 d 를 칸 d − 1('0' 은 9)로 옮기고 −5(OK)
      if (/^[0-9]$/.test(event.key)) {
        const index = event.key === '0' ? 9 : Number(event.key) - 1
        if (index >= count) return
        event.preventDefault()
        cursorRef.current = index
        move(index)
        const action = current[index]
        if (action !== undefined) choose(action)
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const action = current[cursorRef.current]
        if (action !== undefined) choose(action)
        return
      }
      // CLR(−16) — 0x3c1a8: [장면+0x1084] = 1 · 하위 0 · [창+0x215] = 1. 여는 곳이 같은 키를 받아도 창이 이미 줄이는 중이라
      // 두 번 닫지 않는다. '*'(0x2a)도 같은 갈래지만 여는 곳의 `toggle` 이 받는다(여기서도 받으면 닫힌 뒤 다시 연다)
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const layout = inGameMenuLayoutOf(actions.length, slide)
  return (
    <>
      {/*
        창 뒤 어둡게 — 경기 장면 생성자 0x3301c 가 [창+0x24f] = 1 · [창+0x24c] = 1 을 세운다. 일시정지 창 0x741a0 이 띄울 때
        (0x74228) [창+0x24f] 를 [창+0x24e] 로 옮기므로 0x746cc 는 **한 번** — 연 그림에 검정 단계 5 = 6/16 — 덮는다.
        메뉴 동안 경기를 다시 안 그려 그 한 겹이 멈춘 그림 위에 남는다 (`popupDim`).
      */}
      <div ref={dimRef} className={styles.dim} data-testid="경기-메뉴-어둡게"
        style={{ background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
      {isShown && !motion.isClosed && (
        <>
          <MenuPanel layout={layout} actions={actions} cursor={cursor} canAutoProgress={canAutoProgress} />
          <div role="listbox" aria-label="경기 중 메뉴">
            {actions.map((action, index) => {
              const row = layout.rows[index]
              if (row === undefined) return null
              return (
                <PressArea
                  key={action}
                  label={IN_GAME_MENU_LABELS[action]}
                  rect={{ x: row.pill.x, y: row.pill.y, width: row.pill.width + 1, height: row.pill.height + 1 }}
                  option={{ isSelected: index === cursor }}
                  isDisabled={!isEnabled(action)}
                  onPress={() => {
                    if (!motionRef.current.acceptsKeys()) return
                    cursorRef.current = index
                    onMoveCursor(index)
                    onChoose(action)
                  }}
                />
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

/** 그리기 0x3cdd0 하위 0~3 갈래 — 둥근 칸 · "MENU" · 칸들 (`inGameMenuLayoutOf` 머리말) */
function MenuPanel({ layout, actions, cursor, canAutoProgress }: {
  readonly layout: InGameMenuLayout
  readonly actions: readonly InGameMenuAction[]
  readonly cursor: number
  readonly canAutoProgress: boolean
}) {
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const palette4Id = `in-game-menu-p4-${useId().replace(/:/g, '')}`
  const { box, title } = layout
  return (
    <div className={styles.panel} data-testid="경기-메뉴-판" data-slide={box.x + 0x45}>
      {palette3.definition}
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={palette4Id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={PALETTE4_MATRIX} />
        </filter>
      </svg>
      <RoundBox x={box.x} y={box.y} width={box.width} height={box.height} round={4} shine shineLength={0x3c} shineStep={2}
        fill={BOX_FILL} edge={BOX_EDGE} testId="경기-메뉴-칸" />
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={IN_GAME_MENU_TITLE_FRAME} origins={textOrigins} x={title.x} y={title.y}
        style={{ filter: `url(#${palette4Id})` }} />
      {actions.map((action, index) => {
        const row = layout.rows[index]
        if (row === undefined) return null
        const isSelected = index === cursor
        const isGrey = action === '자동진행' && !canAutoProgress
        const frame = IN_GAME_MENU_LABEL_FRAMES[action]
        const digit = row.digit.value % 10
        const digitWidth = NUM_DIGIT_WIDTHS[digit] ?? 8
        return (
          <div key={action} data-testid={`경기-메뉴-칸-${index}`} data-selected={isSelected} data-grey={isGrey}>
            <RoundFill x={row.pill.x} y={row.pill.y} width={row.pill.width} height={row.pill.height}
              color={isSelected ? PILL_SELECTED : PILL_NORMAL} />
            {isGrey ? (
              <SolidStamp folder={IMG_TEXT_FRAMES} frame={frame} origins={textOrigins} x={row.label.x} y={row.label.y}
                color={DISABLED_LABEL} />
            ) : (
              <FrameSprite folder={IMG_TEXT_FRAMES} frame={frame} origins={textOrigins} x={row.label.x} y={row.label.y}
                {...(isSelected ? { style: palette3.style } : {})} />
            )}
            {/* 0xba689 정렬 2 — 왼쪽 = 가운데 + (0 − 폭) >> 1 (0xba5e4~0xba5ee) */}
            <img className={styles.sprite} alt="" src={`${NUM}/${String(digit).padStart(3, '0')}.png`}
              style={{ left: row.digit.centerX + ((0 - digitWidth) >> 1), top: row.digit.y }} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * 둥근 칠 0x6b7d4(x, y, w, h, 둥글기 4, 색) — 칠(x+1, y+1, w−1, h−1) 위에 두 칸 안쪽에서 시작하는 선 넷, (w+1)×(h+1)
 * (`shared/lib/commonPanel` 의 `roundFillOf` 와 같은 식)
 */
function RoundFill({ x, y, width: w, height: h, color }: {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string
}) {
  return (
    <svg className={styles.paint} width={w + 1} height={h + 1} viewBox={`0 0 ${w + 1} ${h + 1}`} shapeRendering="crispEdges"
      style={{ left: x, top: y }} aria-hidden>
      <rect x={1} y={1} width={w - 1} height={h - 1} fill={color} />
      <rect x={2} y={0} width={w - 3} height={1} fill={color} />
      <rect x={2} y={h} width={w - 3} height={1} fill={color} />
      <rect x={0} y={2} width={1} height={h - 3} fill={color} />
      <rect x={w} y={2} width={1} height={h - 3} fill={color} />
    </svg>
  )
}
