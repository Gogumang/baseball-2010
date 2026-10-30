import { useEffect, useRef, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { MessageBox } from '@/shared/ui'
import { inGameMenuOf } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuOpening } from '@/features/play-team-game/model/useInGameMenuState'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { NOT_ENOUGH_GAME_POINT, VERSUS_INNING_LIMIT_NOTICE } from '@/features/play-team-game/ui/inGameMenu/inGameMenuLooks'
import { confirmTextOf, isActionEnabled } from '@/features/play-team-game/ui/inGameMenu/inGameMenuChoice'
import { withMenuDefaults, type InGameMenuProps } from '@/features/play-team-game/ui/inGameMenu/inGameMenuProps'
import { PauseWindow } from '@/features/play-team-game/ui/inGameMenu/PauseWindow'

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
export function InGameMenu(props: InGameMenuProps) {
  const {
    mode,
    onContinue,
    onQuit,
    onOpenHelp,
    onOpenSettings,
    onAutoProgress,
    autoProgressCost,
    canAutoProgress,
    gamePoint,
    onRestart,
    cursor: initialCursor,
    onCursorChange,
    slidesIn,
    opening,
    bindCloser,
  } = withMenuDefaults(props)
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
  useMirrorRef(isMessageShownRef, confirming !== null || notice !== null)
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
  useMirrorRef(onCursorChangeRef, onCursorChange)
  const moveCursor = (next: number) => {
    setCursor(next)
    onCursorChangeRef.current?.(next)
  }

  const isEnabled = (action: InGameMenuAction) => isActionEnabled(action, props)

  /** 질문 · 알림 창을 띄운다 — 0x74ef5 는 창이 떠 있어 대기 칸에 적히고, 일시정지 창이 [+0x215] 로 닫힌 갱신에 0x75440 이 띄운다 */
  const askAfterClose = (show: () => void) => {
    if (windowCloseRef.current?.(show) !== true) show()
  }

  /** 뷰어 · 설정 판으로 넘어간다 — 울리던 소리를 끊고(0x6e418) 일시정지 창을 떠난다 */
  const handOffTo = (open: (() => void) | undefined) => {
    activeSound().stop()
    handedOffRef.current = true
    return open?.()
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
    if (action === '조작방법') return handOffTo(onOpenHelp)
    if (action === '설정') return handOffTo(onOpenSettings)
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

  /** 자동진행 [예] — 확정(하위 2 = 0x3c7d8)이 여기서 G포인트를 검사한다. 모자라면 StrGAME[5] 알림 뒤 경기로 */
  const confirmAutoProgress = () => {
    if (gamePoint === undefined || gamePoint < autoProgressCost) {
      handedOffRef.current = false
      setNotice({ text: NOT_ENOUGH_GAME_POINT, after: '경기' })
      return
    }
    onAutoProgress?.(autoProgressCost)
  }

  /** 질문 [예] 뒤 — 나가기 · 다시하기 · 자동진행 */
  const runConfirmed = (asked: InGameMenuAction) => {
    if (asked === '나가기') return onQuit?.()
    if (asked === '다시하기') return onRestart?.()
    confirmAutoProgress()
  }

  /** 질문 답 — 아니오 · CLR(키 표 −16 → −1, 0x3c55a~0x3c570)은 일시정지 팝업을 다시 띄운다(메뉴 커서 그대로) */
  const answerConfirm = (asked: InGameMenuAction, index: number) => {
    setConfirming(null)
    if (index !== 0) return reopenPauseWindow()
    handedOffRef.current = true
    runConfirmed(asked)
  }

  /**
   * '\*' 로 연 창([+0x290] = 0) 뒤의 질문 · 알림은 앞 창을 닫은 갱신이 0x754f8 첫 갈래 → 0x75440 → 75556 펼침으로 이어져 첫 그림이
   * 이미 높이 20 이다. 다시 띄운 창([+0x290] = 1)은 줄임(0x7558a) 끝의 0x75440 뒤 곧장 돌아가(755d8) 10 부터다.
   */
  const opensOneStepIn = pauseWindow.opening === '별표'

  if (notice !== null) {
    return (
      <MessageBox
        text={notice.text}
        buttons={['확인']}
        dimOpacity={POPUP_DIM_OPACITY}
        closesWithoutShrink
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
        }}
      />
    )
  }

  if (confirming !== null) {
    const text = confirmTextOf(confirming, mode, autoProgressCost)
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
        onAnswer={(index) => answerConfirm(confirming, index)}
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
