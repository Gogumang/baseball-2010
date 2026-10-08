import { useEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import { originalKeyOf, type ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import {
  defensePlayResultOf,
  isDefensePlayFinished,
  startDefensePlay,
  stepDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
import type {
  DefenseKeyPress,
  DefensePlayInput,
  DefensePlayResult,
  DefensePlayState,
} from '@/features/defense-play/model/runDefensePlay'
import { activeSound } from '@/shared/api/audio/soundPort'
import { SLIDING_SOUND_EFFECT } from '@/entities/defense-controls/model/sliding'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import {
  EMPTY_HOME_RUN_SCORE_BOARD, RUN_SCORE_BOARD_TICKS, drawHomeRunScoreBoard, drawRunScoreBoard, homeRunScoreBoardRunIn,
  runScoreBoardHiddenScoresOf, runScoreBoardScoresOf,
} from '@/pages/defense/lib/runScoreBoard'
import type { HomeRunScoreBoard } from '@/pages/defense/lib/runScoreBoard'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'

/** 수비 장면 득점 점수판 0x41a64 의 재료 — 플레이가 시작될 때의 경기 (`lib/runScoreBoard`) */
export interface RunScoreBoardSource {
  /** 점수판 틀 0x41440 의 두 측 */
  readonly sides: readonly [ScoreboardSide, ScoreboardSide]
  /** 플레이 시작 때 두 점수 0xb69b0(st, 0/1) */
  readonly scores: readonly [number, number]
  /** st[9] — 지금 공격하는 측. 이 플레이의 득점(`held.scoreboardRuns`)이 이 측에 붙는다 */
  readonly battingSide: number
}

interface DefensePlaybackProps {
  /**
   * **미리 계산해 둔** 한 플레이의 매 틱 스냅샷. 홈런 비행 재생(`homeRunPlayback`)처럼
   * 사람이 끼어들 것이 없는 장면은 이 쪽을 쓴다.
   */
  readonly ticks?: readonly DefenseViewState[]
  /**
   * **실시간으로 돌릴** 타구. 주면 이 화면이 진행기를 **매 갱신 한 틱씩 직접 돌리고**
   * `keydown` 을 그 틱의 키로 넘긴다 — 사람이 주루·송구를 할 수 있는 갈래다.
   * `ticks` 와 같이 주면 이 쪽이 이긴다.
   */
  readonly input?: DefensePlayInput
  /**
   * 사람이 어느 쪽을 잡는가 — 조작 객체 `[+0xc]` (0 공격/주루 · 1 수비/송구).
   * **안 주면 자동이다**: 키를 눌러도 아무 일도 없고 CPU 규칙대로만 굴러간다.
   */
  readonly side?: ControlSide
  /** 마지막 틱까지 다 보여 준 뒤. 실시간 갈래는 그 플레이의 결과를 함께 넘긴다 */
  readonly onDone: (result?: DefensePlayResult) => void
  /** 다 본 뒤 잠깐 멈춰 두는 갱신 횟수 — 마지막 장면이 스치듯 지나가지 않게 */
  readonly holdUpdates?: number
  /**
   * 시즌 구장 잔디 — `stadium/defense.mpl` 줄 (`0x7885c`). `DefenseScreen` 과 같은 뜻이다.
   * 시즌 **홈경기**에서만 값이 오고, 그 밖에는 null(구운 그림 = 칸 3 특급천연잔디)이다.
   */
  readonly grassPalette?: number | null
  /**
   * 수비 장면 득점 점수판 0x41a64 — 주면 실시간 갈래에서 1점마다 20번 세운다. 안 주면 안 그린다.
   * 재생 갈래(`ticks`)는 주자가 홈 자리에 닿은 틱을 메시지 0x13 으로 보고, 타자주자가 달리는 재생(홈런 비행)이면
   * 홈런 갈래(간격 min(40/n, 20)로 1점씩), 아니면 보통 갈래로 센다 (`lib/runScoreBoard` 머리말).
   */
  readonly runScoreBoard?: RunScoreBoardSource
  readonly children?: React.ReactNode
}

/** 원작 경기 루프는 한 갱신에 한 틱이다 (0xc2198) */
const UPDATES_PER_TICK = 1
const DEFAULT_HOLD_UPDATES = 8

/**
 * **펌블(공 놓침) 소리 53** — 원본은 야수 동작 `0xd` 를 거는 `0xa1e60` 이 그 자리에서 낸다
 * (`shared/config/original/sounds` 53번: "선수 넘어짐 / 공 놓침", `+0xb4 = 15` 동안 먼지 애니).
 *
 * 펌블을 굴리는 곳은 진행기(`runDefensePlay` 의 0xb41d0 굴림)지만 그쪽은 순수 함수라 소리를 못 낸다 —
 * 틱을 실제로 돌리는 **이 화면**이 원본과 같은 틱에 낸다.
 */
const FUMBLE_SOUND = 53

/**
 * 수비 한 플레이를 보여 준다 — 갈래가 둘이다.
 *
 * 원본은 타구가 뜬 순간 경기 장면 상태가 0x11 → 0x13 → 0x17(수비 인플레이)로 넘어가
 * 공이 멈출 때까지 같은 루프를 돌면서 **매 갱신 눌린 키를 읽는다** (R10 · I 문서).
 *
 * - `ticks` 를 주면 **미리 계산해 둔 틱을 재생만** 한다 (홈런 비행 등).
 * - `input` 을 주면 **여기서 진행기를 한 틱씩 돌리며** 실시간 키를 먹인다 — 원본과 같은 모양이다.
 */
export function DefensePlayback({
  ticks,
  input,
  side,
  onDone,
  holdUpdates = DEFAULT_HOLD_UPDATES,
  grassPalette = null,
  runScoreBoard,
  children,
}: DefensePlaybackProps) {
  if (input !== undefined) {
    return (
      <LivePlayback
        input={input}
        side={side}
        onDone={onDone}
        holdUpdates={holdUpdates}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
      >
        {children}
      </LivePlayback>
    )
  }
  return (
    <RecordedPlayback
      ticks={ticks ?? []}
      onDone={onDone}
      holdUpdates={holdUpdates}
      grassPalette={grassPalette}
      runScoreBoard={runScoreBoard}
    >
      {children}
    </RecordedPlayback>
  )
}

interface RecordedPlaybackProps {
  readonly ticks: readonly DefenseViewState[]
  readonly onDone: (result?: DefensePlayResult) => void
  readonly holdUpdates: number
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly children?: React.ReactNode
}

/** 홈 자리 — 주자가 여기 닿은 틱이 메시지 0x13(주자 하나 홈인)이다 */
const HOME_PLATE = basePosition(0)
const isAtHome = (runner: { readonly x: number; readonly z: number }) =>
  runner.x === HOME_PLATE.x && runner.z === HOME_PLATE.z

/** 재생 갈래 득점 점수판의 셈 — 다음에 볼 틱 · 주자별 홈을 떠났나/밟았나 · 들어온 수 · 두 갈래 칸 */
interface RecordedBoardTally {
  readonly nextIndex: number
  readonly leftHome: ReadonlySet<number>
  readonly scored: ReadonlySet<number>
  readonly runs: number
  readonly timer: number
  readonly homeRun: HomeRunScoreBoard
}

const EMPTY_RECORDED_TALLY: RecordedBoardTally = {
  nextIndex: 0, leftHome: new Set(), scored: new Set(), runs: 0, timer: 0, homeRun: EMPTY_HOME_RUN_SCORE_BOARD,
}

/**
 * 재생 틱 하나를 지난다 — 홈을 떠난 적 있는 주자(타자주자는 홈에서 출발한다)가 홈 자리에 닿으면 1점(메시지 0x13).
 * 홈런 재생(타자주자가 달린다)은 홈런 갈래, 아니면 보통 갈래 타이머 20. 그 틱 그리기 한 번까지 돌린다.
 */
function stepRecordedBoard(
  tally: RecordedBoardTally, view: DefenseViewState, isHomeRun: boolean,
): { readonly tally: RecordedBoardTally; readonly visible: boolean; readonly hidden: number } {
  const leftHome = new Set(tally.leftHome)
  const scored = new Set(tally.scored)
  let { runs, timer, homeRun } = tally
  for (const runner of view.runners) {
    if (scored.has(runner.index)) continue
    if (!isAtHome(runner)) {
      leftHome.add(runner.index)
      continue
    }
    if (!leftHome.has(runner.index)) continue
    scored.add(runner.index)
    runs += 1
    if (isHomeRun) homeRun = homeRunScoreBoardRunIn(homeRun, runner.index === 0)
    else timer = RUN_SCORE_BOARD_TICKS
  }
  let visible: boolean
  let hidden: number
  if (isHomeRun) {
    const drawn = drawHomeRunScoreBoard(homeRun)
    homeRun = drawn.next
    visible = drawn.visible
    hidden = drawn.hiddenRuns
  } else {
    const drawn = drawRunScoreBoard(timer)
    timer = drawn.timerAfter
    visible = drawn.visible
    hidden = drawn.previousScore ? 1 : 0
  }
  return { tally: { nextIndex: tally.nextIndex + 1, leftHome, scored, runs, timer, homeRun }, visible, hidden }
}

/**
 * 미리 계산해 둔 틱을 차례대로 보여 주기만 한다 — 지금까지의 그 갈래 그대로다.
 *
 * ⚠️ **펌블 소리 53 은 여기서 내지 않는다.** 이 갈래로 오는 타구 판은 패턴 없이 온 홈런의 재생(`homeRunPlayback` — 시험·옛 호출)뿐이고
 * (그 밖은 견제 · 도루 · 폭투 판), 그 판은 난수 없이 돌려 펌블 굴림 자체가 없다. 화면 스냅샷(`DefenseViewState`)에는
 * 펌블 동작(0xd)도 `fumbled` 칸도 실려 오지 않으므로 여기서는 알 길도 없다.
 * 두 갈래는 `input` 이 있으면 실시간, 없으면 재생으로 **서로 배타**라 겹쳐 울릴 일도 없다.
 */
function RecordedPlayback({ ticks, onDone, holdUpdates, grassPalette, runScoreBoard, children }: RecordedPlaybackProps) {
  const update = useUpdateCounter(ticks.length > 0)
  const lastIndex = Math.max(0, ticks.length - 1)
  const index = Math.min(Math.floor(update / UPDATES_PER_TICK), lastIndex)
  const isFinished = ticks.length === 0 || update >= lastIndex * UPDATES_PER_TICK + holdUpdates
  /** 득점 점수판 셈 — 틱을 한 번씩만 지나도록 ref 로 든다 (재생 묶음이 바뀌면 처음부터) */
  const tallyRef = useRef<{ readonly ticks: readonly DefenseViewState[]; tally: RecordedBoardTally } | null>(null)
  const boardRef = useRef<readonly [number, number] | null>(null)

  useEffect(() => {
    if (isFinished) onDone()
  }, [isFinished, onDone])

  if (runScoreBoard !== undefined) {
    if (tallyRef.current === null || tallyRef.current.ticks !== ticks) {
      tallyRef.current = { ticks, tally: EMPTY_RECORDED_TALLY }
      boardRef.current = null
    }
    // 타자주자(칸 0)가 달리는 재생 = 홈런 비행 — 웹 재생 갈래의 다른 판(견제·도루·폭투)은 타자주자를 안 싣는다
    const isHomeRun = ticks[0]?.runners.some((runner) => runner.index === 0) === true
    const holder = tallyRef.current
    while (holder.tally.nextIndex <= index) {
      const view = ticks[holder.tally.nextIndex]
      if (view === undefined) break
      const stepped = stepRecordedBoard(holder.tally, view, isHomeRun)
      holder.tally = stepped.tally
      const runs = stepped.tally.runs
      const scores: readonly [number, number] = [
        runScoreBoard.scores[0] + (runScoreBoard.battingSide === 0 ? runs : 0),
        runScoreBoard.scores[1] + (runScoreBoard.battingSide === 1 ? runs : 0),
      ]
      boardRef.current = stepped.visible
        ? runScoreBoardHiddenScoresOf(scores, runScoreBoard.battingSide, stepped.hidden)
        : null
    }
  }

  const state = ticks[index]
  if (state === undefined) return null
  // 마지막 틱 = 플레이 끝(0x17 을 나간다, 0x35108 이 타이머 0) — 그 뒤 붙든 그림 위에는 판이 없다
  const board = index >= lastIndex ? null : boardRef.current
  return (
    <DefenseScreen state={state} grassPalette={grassPalette}>
      {runScoreBoard !== undefined && board !== null && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      {children}
    </DefenseScreen>
  )
}

interface LivePlaybackProps {
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly onDone: (result?: DefensePlayResult) => void
  readonly holdUpdates: number
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly children?: React.ReactNode
}

/** 득점 점수판이 이번 그리기에 보이는 모습 */
interface RunScoreBoardView {
  readonly scores: readonly [number, number]
}

/**
 * 진행기를 **매 갱신 한 틱씩** 직접 돌린다 (0xc2198).
 *
 * 원본 경기 장면은 매 틱 눌린 키를 `this+0x38` 에 담고 조작 객체(0x536bc)가 상태 0x17 갈래로 가른다.
 * 여기서는 `keydown` 을 줄 세워 두고 **한 틱에 한 개씩** 진행기에 먹인다.
 * 키 → 뜻은 진행기 안에서 `inPlayCommandOf` 가 한다 — 표를 여기서 다시 만들지 않는다.
 */
function LivePlayback({ input, side, onDone, holdUpdates, grassPalette, runScoreBoard, children }: LivePlaybackProps) {
  const update = useUpdateCounter(true)
  const stateRef = useRef<DefensePlayState | null>(null)
  const builtFromRef = useRef<DefensePlayInput | null>(null)
  const builtSideRef = useRef<ControlSide | undefined>(undefined)
  /** 이 플레이가 시작된 갱신 번호 — 갱신 계수는 화면이 서고부터 계속 오르므로 빼 준다 */
  const startedAtRef = useRef(0)
  /** 아직 진행기에 안 먹인 키들 */
  const pressesRef = useRef<DefenseKeyPress[]>([])
  /**
   * 이 플레이에서 펌블 소리 53 을 이미 냈는가.
   *
   * 진행기는 펌블을 한 플레이에 한 번만 굴리지만(`!fumbled` 게이트), 갱신이 건너뛰어 여러 틱을
   * 따라잡을 때 같은 갱신 안에서 두 번 보지 않게 여기서도 한 번으로 막는다.
   */
  const fumbleSoundPlayedRef = useRef(false)
  /** 득점 점수판 타이머 [+0x10f8] — 메시지 0x13(1점)마다 20, 그릴 때마다 1 씩 (0x52074 · 0x41b10) */
  const runBoardTimerRef = useRef(0)
  const [view, setView] = useState<DefenseViewState | null>(null)
  const [runBoard, setRunBoard] = useState<RunScoreBoardView | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 원본이 아는 키만 담는다 (숫자·방향·OK·CLR)
      if (originalKeyOf(event.key) === null) return
      // 누르고 있는 중인가 — 레이저 확정은 새로 누른 키만 받는다 (0x4e858 키 반복 계수 0)
      pressesRef.current.push({ key: event.key, isRepeat: event.repeat })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (builtFromRef.current !== input || builtSideRef.current !== side) {
      builtFromRef.current = input
      builtSideRef.current = side
      stateRef.current = startDefensePlay(withSide(input, side))
      startedAtRef.current = update
      pressesRef.current = []
      fumbleSoundPlayedRef.current = false
      runBoardTimerRef.current = 0
      setView(null)
      setRunBoard(null)
      setFinishedAt(null)
    }
    const state = stateRef.current
    if (state === null) return

    // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다
    const wanted = Math.floor((update - startedAtRef.current) / UPDATES_PER_TICK) + 1
    let running = state
    let moved = false
    let board: RunScoreBoardView | null = null
    while (running.tick < wanted && !isDefensePlayFinished(running)) {
      const runsBefore = running.held.scoreboardRuns
      running = stepDefensePlay(running, pressesRef.current.shift() ?? null)
      moved = true
      // 득점 점수판 0x41a64 — 점수판에 1점 오를 때마다(메시지 0x13) 타이머 20, 그 틱 그리기부터 센다.
      // 한 갱신에 여러 틱을 따라잡으면 마지막 틱 모습만 보인다
      if (runScoreBoard !== undefined) {
        if (running.held.scoreboardRuns > runsBefore) runBoardTimerRef.current = RUN_SCORE_BOARD_TICKS
        const drawn = drawRunScoreBoard(runBoardTimerRef.current)
        runBoardTimerRef.current = drawn.timerAfter
        const runs = running.held.scoreboardRuns
        const scores: readonly [number, number] = [
          runScoreBoard.scores[0] + (runScoreBoard.battingSide === 0 ? runs : 0),
          runScoreBoard.scores[1] + (runScoreBoard.battingSide === 1 ? runs : 0),
        ]
        board = drawn.visible
          ? { scores: runScoreBoardScoresOf(scores, runScoreBoard.battingSide, drawn.previousScore) }
          : null
        // 플레이가 끝난 틱 — 0x17 끝 0x528b0 의 0x35108 이 타이머를 0 으로 두고 상태를 나간다. 그 뒤로는 그리지 않는다
        if (isDefensePlayFinished(running)) {
          runBoardTimerRef.current = 0
          board = null
        }
      }
      // 펌블 소리 53 — 진행기가 `state.fumbled` 를 세우는 **그 틱**에 낸다 (0xb41d0 굴림 → 동작 0xd).
      // 플레이 끝에 몰아서 내면 아웃 콜(0x51b36)을 덮는다 — 소리 통로가 하나뿐이기 때문이다.
      if (running.fumbled && !fumbleSoundPlayedRef.current) {
        fumbleSoundPlayedRef.current = true
        activeSound().play(FUMBLE_SOUND)
      }
      // 슬라이딩 소리 10 — 진행기가 그 틱에 낸다고 표시한 대로 낸다. 한 플레이 한 번 잠금(+0x31c)은
      // 사람 키 갈래에만 있고 진행기가 이미 걸었다 — 자동 갈래(0x5268c)는 잠금이 없어 여기서도 안 막는다.
      // 원본 입구는 예약 0x6e498 이지만 그것도 지금 소리를 끊는 한 칸이라 통로 하나 `play` 와 같다.
      if (running.slidingSoundThisTick) activeSound().play(SLIDING_SOUND_EFFECT)
    }
    stateRef.current = running
    if (moved) {
      setView(running.ticks[running.ticks.length - 1] ?? null)
      setRunBoard(board)
    }
    if (isDefensePlayFinished(running) && finishedAt === null) setFinishedAt(update)
  }, [update, input, side, finishedAt, runScoreBoard])

  const isFinished = finishedAt !== null && update >= finishedAt + holdUpdates

  useEffect(() => {
    if (!isFinished) return
    const state = stateRef.current
    onDone(state === null ? undefined : defensePlayResultOf(state))
  }, [isFinished, onDone])

  if (view === null) return null
  return (
    <DefenseScreen state={view} grassPalette={grassPalette}>
      {runScoreBoard !== undefined && runBoard !== null && finishedAt === null && (
        <RunScoreBoard sides={runScoreBoard.sides} scores={runBoard.scores} />
      )}
      {children}
    </DefenseScreen>
  )
}

/**
 * 사람이 잡은 쪽을 진행기에 알려 준다 — 조작 객체 `[+0xc]`.
 *
 * `keyAt` 은 **부르지 않는다**: 실시간 갈래는 눌린 키를 `stepDefensePlay` 의 인자로 바로 넘긴다.
 * 그래도 `controls` 자체는 있어야 진행기가 "사람이 조작한다" 로 보고 키 갈래를 연다.
 */
function withSide(input: DefensePlayInput, side?: ControlSide): DefensePlayInput {
  if (side === undefined) return input
  return {
    ...input,
    controls: { side, keyAt: () => null },
  }
}
