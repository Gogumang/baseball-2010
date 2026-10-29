import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import { type TradeRequest, NO_TRADE_REQUEST } from '@/entities/season-mode/model/tradeRequest'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import type { LeaderKind } from '@/entities/awards/model/leaderboard'
import { type SeasonMenuCursors, INITIAL_SEASON_MENU_CURSORS, menuCursorsOnEnter } from '@/entities/season-mode/model/seasonStateMachine'
import { type SeasonEventCursor, START_SEASON_EVENT_CURSOR } from '@/entities/season-mode/model/seasonEventFlow'
import type { SeasonEntryEdit, SeasonEventPlayback, SeasonIncomeEvaluation } from '@/app/model/seasonSession/types/session'
import type { SeasonSceneStateContext } from '@/app/model/seasonSession/state/useSeasonSceneState'

/** `useSeasonSession` 몸통 문장 38~54 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonUiState(ctx: SeasonSceneStateContext) {
  const { scene, save } = ctx
  /** 엔트리 편집 0xe0 — 편집 객체와 목록 */
  const [entryEdit, setEntryEdit] = useState<SeasonEntryEdit | null>(null)
  /** 이벤트 재생 0xd3 — 트는 이벤트와 돌아갈 상태 */
  const [eventPlayback, setEventPlayback] = useState<SeasonEventPlayback | null>(null)
  /** this+0x148 — CPU 트레이드 요청 (장면 객체 칸, 저장 안 함) */
  const [tradeRequest, setTradeRequest] = useState<TradeRequest>(NO_TRADE_REQUEST)
  /** 관리 메뉴 진입의 요청 알림 [203] (팝업 0x27) 이 떠 있는가 */
  const [isTradeRequestAlertOpen, setTradeRequestAlertOpen] = useState(false)
  const [trainingResult, setTrainingResult] = useState<SeasonTrainingResult | null>(null)
  const [outingPlace, setOutingPlace] = useState<number | null>(null)
  const [outingResultText, setOutingResultText] = useState<string | null>(null)
  const [incomeEvaluation, setIncomeEvaluation] = useState<SeasonIncomeEvaluation | null>(null)
  /** 0xed 진입 0xe7ac → 0x8dd60 이 굴린 시즌 MVP 순위 종류(표 0xd4f34 의 rand(0..6)) — 376 창 · 378/379 가 읽는다 */
  const seasonMvpKindRef = useRef<LeaderKind | null>(null)
  /** 관리 메뉴·구단관리 메뉴 객체의 커서 — 장면 생성(0x3b14)에서 0, 상태를 오가도 남는다 */
  const [menuCursors, setMenuCursors] = useState<SeasonMenuCursors>(INITIAL_SEASON_MENU_CURSORS)
  /** 이전 상태 this+0x24 — 진입 갈래(0x4efc · 0x47d8)가 본다 */
  const previousScene = useRef(scene)
  useLayoutEffect(() => {
    const previous = previousScene.current
    if (previous === scene) return
    previousScene.current = scene
    const record = save?.state.record
    if (record === undefined) return
    setMenuCursors((cursors) => menuCursorsOnEnter(cursors, scene, previous, record))
  }, [save, scene])
  const moveMenuCursor = useCallback((menu: keyof SeasonMenuCursors, index: number) => {
    setMenuCursors((cursors) => ({ ...cursors, [menu]: index }))
  }, [])
  const playbackSerialRef = useRef(0)
  /**
   * 이벤트 관리자 읽기 객체의 커서(+0x28 · +0x2c) — 관리자는 장면 0x105 를 만들 때(0x3b14) 새로 생긴다.
   * 웹은 훅이 서는 때와 경기를 마치고 돌아오는 때(`finishGame`)를 그 자리로 본다.
   */
  const eventCursorRef = useRef<SeasonEventCursor>(START_SEASON_EVENT_CURSOR)
  /**
   * 새 선수 플래그 this+0xf9 — 장면을 만들 때 0(0x401e), 진입 분기 0xcb 가 **새 시즌 초기화 0xcc 에서 왔을 때만** 1
   * (4c5a~4c78). 웹은 팀을 고른 직후(`chooseTeam`)가 그 자리다. 관리 메뉴 첫 폴링이 400 을 틀고 지운다.
   */
  const newPlayerFlagRef = useRef(false)
  /**
   * mgr+0x304 — 장면 0x105 셋업 0x3b14 가 1, 관리 메뉴 0xc9 의 확인 키(0x8f82 — −5 · '5')만 0. 폴링 0x8be80 이 reader+0x34 로
   * 베껴 판정의 490 쿨다운 검사(ad00e~ad054)를 건너뛰게 한다. 웹은 훅이 서는 때 · 들어와 장면을 세울 때(`constructScene`) ·
   * 경기를 마치고 돌아오는 때를 셋업으로 본다
   */
  const freshSceneRef = useRef(true)
  return {
    entryEdit,
    setEntryEdit,
    eventPlayback,
    setEventPlayback,
    tradeRequest,
    setTradeRequest,
    isTradeRequestAlertOpen,
    setTradeRequestAlertOpen,
    trainingResult,
    setTrainingResult,
    outingPlace,
    setOutingPlace,
    outingResultText,
    setOutingResultText,
    incomeEvaluation,
    setIncomeEvaluation,
    seasonMvpKindRef,
    menuCursors,
    setMenuCursors,
    moveMenuCursor,
    playbackSerialRef,
    eventCursorRef,
    newPlayerFlagRef,
    freshSceneRef,
  }
}

/** `useSeasonUiState` 까지 선 값 */
export type SeasonUiStateContext = SeasonSceneStateContext & ReturnType<typeof useSeasonUiState>
