import { useEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'
import { originalKeyOf, type ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import {
  acceptsFastForwardKey,
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
  EMPTY_HOME_RUN_SCORE_BOARD, closesDefenseScene, drawRunScoreBoardScene, isHomeRunHitCode, runScoreBoardHiddenScoresOf,
  runScoreBoardRunIn,
} from '@/pages/defense/lib/runScoreBoard'
import type { HomeRunScoreBoard } from '@/pages/defense/lib/runScoreBoard'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'
import { createParticleScene, type ParticleScene } from '@/entities/particle/model/particleScene'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import {
  DEFENSE_SCENE_START,
  defenseEffectsOf,
  defenseTickFactsOf,
  endDefenseEffects,
  fastForwardDefenseEffects,
  sceneMemoryOf,
  stepDefenseEffects,
  tickBeforeOf,
  updateDefenseEffectsWithoutDraw,
  type DefenseEffects,
  type DefenseSceneMemory,
} from '@/pages/defense/lib/defenseHomeRunEffects'
import { DefenseDistanceBoard, DefenseHomeRunText, DefenseParticles } from '@/pages/defense/ui/DefenseEffectsLayer'

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
  /**
   * 경기 장면 동안 남는 HOMERUN 글자 칸(+0x1962 반짝임 셈 …)과 표시 비거리 +0x36 — 실시간 갈래의 홈런 연출이 판마다 이어 쓴다
   * (`lib/defenseHomeRunEffects`). 부르는 쪽이 경기(장면) 하나 동안 들고 있는 ref 를 넘긴다. 안 주면 판마다 장면 new 의 0 이다.
   */
  readonly sceneMemory?: { current: DefenseSceneMemory }
  /**
   * 재생 갈래(`ticks`)가 **볼넷 · 사구 밀어내기 판**(종류 2, `features/defense-play/model/walkPlay`)인가.
   * - 타자주자(칸 0)가 달리지만 홈런 비행이 아니다 — 득점 점수판을 보통 갈래로 센다.
   * - state[0xb] ∈ {3, 4} 라 판 동안 · 닫힌 뒤 갱신에 온 키가 0x519cc 를 지나 +0xfe7 을 세우고 52b26 이 그 그림 안에서
   *   판 끝 · +0x1094 셈을 다 돌아 0x35108 로 끝낸다 — 키를 받은 그림에서 재생을 끝낸다.
   */
  readonly freePassPlay?: boolean
  readonly children?: React.ReactNode
}

/** 판이 닫힌 뒤 갱신(+0x1094 셈 · 그리기 · 파티클 틱) — 탭이 잠들었다 돌아와도 한 번에 이만큼만 따라잡는다 */
const MAX_CLOSED_CATCH_UP = 30

/** 원작 경기 루프는 한 갱신에 한 틱이다 (0xc2198) */
const UPDATES_PER_TICK = 1

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
  grassPalette = null,
  runScoreBoard,
  sceneMemory,
  freePassPlay = false,
  children,
}: DefensePlaybackProps) {
  if (input !== undefined) {
    return (
      <LivePlayback
        input={input}
        side={side}
        onDone={onDone}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
        sceneMemory={sceneMemory}
      >
        {children}
      </LivePlayback>
    )
  }
  return (
    <RecordedPlayback
      ticks={ticks ?? []}
      onDone={onDone}
      grassPalette={grassPalette}
      runScoreBoard={runScoreBoard}
      freePassPlay={freePassPlay}
    >
      {children}
    </RecordedPlayback>
  )
}

interface RecordedPlaybackProps {
  readonly ticks: readonly DefenseViewState[]
  readonly onDone: (result?: DefensePlayResult) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly freePassPlay: boolean
  readonly children?: React.ReactNode
}

/** 홈 자리 — 주자가 여기 닿은 틱이 메시지 0x13(주자 하나 홈인)이다 */
const HOME_PLATE = basePosition(0)
const isAtHome = (runner: { readonly x: number; readonly z: number }) =>
  runner.x === HOME_PLATE.x && runner.z === HOME_PLATE.z

/** 재생 갈래 득점 점수판의 셈 — 다음에 볼 갱신 · 주자별 홈을 떠났나/밟았나 · 들어온 수 · 점수판 칸 · 닫힌 셈 */
interface RecordedBoardTally {
  readonly nextIndex: number
  readonly leftHome: ReadonlySet<number>
  readonly scored: ReadonlySet<number>
  readonly runs: number
  /** [+0x10f8] 타이머 · [+0x10fc] 수 · [+0x1101] 간격 · [+0x1100] 홈런 판 섰음 — 두 갈래가 같이 쓴다 */
  readonly board: HomeRunScoreBoard
  /** +0x1094 — 판이 닫힌(마지막 틱 뒤) 갱신 수 */
  readonly closedCount: number
  /** 0x35108 을 지났다 (0x17 끝) */
  readonly ended: boolean
  /** 마지막 그리기에서 판이 섰나 · 공격 쪽에서 뺄 점수 */
  readonly visible: boolean
  readonly hidden: number
}

const EMPTY_RECORDED_TALLY: RecordedBoardTally = {
  nextIndex: 0, leftHome: new Set(), scored: new Set(), runs: 0, board: EMPTY_HOME_RUN_SCORE_BOARD, closedCount: 0,
  ended: false, visible: false, hidden: 0,
}

/**
 * 재생 갱신 하나를 지난다. 마지막 틱까지는 그 틱의 갱신 — 홈을 떠난 적 있는 주자(타자주자는 홈에서 출발한다)가 홈 자리에 닿으면
 * 1점(메시지 0x13, 홈런 재생은 그 주자 칸으로 홈런 갈래). 마지막 틱 뒤는 닫힌 갱신(+0x1094 — `closesDefenseScene`).
 * 끝나지 않았으면 그 갱신 그리기 한 번까지 돌린다.
 */
function stepRecordedBoard(
  tally: RecordedBoardTally, view: DefenseViewState, isHomeRun: boolean, isClosed: boolean,
): RecordedBoardTally {
  const leftHome = new Set(tally.leftHome)
  const scored = new Set(tally.scored)
  let { runs, board, closedCount } = tally
  if (isClosed) {
    closedCount += 1
    // 52a1c — 홈런 판이 서 있는 동안은 안 닫는다
    if (closesDefenseScene(closedCount, isHomeRun, board)) {
      return { ...tally, nextIndex: tally.nextIndex + 1, closedCount, ended: true, visible: false, hidden: 0 }
    }
  } else {
    for (const runner of view.runners) {
      if (scored.has(runner.index)) continue
      if (!isAtHome(runner)) {
        leftHome.add(runner.index)
        continue
      }
      if (!leftHome.has(runner.index)) continue
      scored.add(runner.index)
      runs += 1
      board = runScoreBoardRunIn(board, runner.index, isHomeRun, false)
    }
  }
  const drawn = drawRunScoreBoardScene(board, isHomeRun)
  return {
    nextIndex: tally.nextIndex + 1, leftHome, scored, runs, board: drawn.next, closedCount, ended: false,
    visible: drawn.visible, hidden: drawn.hidden,
  }
}

/**
 * 미리 계산해 둔 틱을 차례대로 보여 주기만 한다 — 한 갱신에 한 틱, 마지막 틱(관문이 닫힌 틱) 뒤로는 원본 닫힌 갈래대로
 * +0x1094 가 11 이 되는 갱신(홈런 재생은 홈런 점수판이 내려갈 때까지 더)에 끝낸다 — 그동안 마지막 그림과 점수판을 그린다.
 *
 * ⚠️ **펌블 소리 53 은 여기서 내지 않는다.** 이 갈래로 오는 타구 판은 패턴 없이 온 홈런의 재생(`homeRunPlayback` — 시험·옛 호출)뿐이고
 * (그 밖은 견제 · 도루 · 폭투 판), 그 판은 난수 없이 돌려 펌블 굴림 자체가 없다. 화면 스냅샷(`DefenseViewState`)에는
 * 펌블 동작(0xd)도 `fumbled` 칸도 실려 오지 않으므로 여기서는 알 길도 없다.
 * 두 갈래는 `input` 이 있으면 실시간, 없으면 재생으로 **서로 배타**라 겹쳐 울릴 일도 없다.
 * ⚠️ 0x357e0(결과 코드 24~26)은 재생 틱에 없어 "타자주자가 달리는 재생 = 홈런 비행" 으로 읽는다.
 */
function RecordedPlayback({ ticks, onDone, grassPalette, runScoreBoard, freePassPlay, children }: RecordedPlaybackProps) {
  const update = useUpdateCounter(ticks.length > 0)
  const lastIndex = Math.max(0, ticks.length - 1)
  const index = Math.min(Math.floor(update / UPDATES_PER_TICK), lastIndex)
  /** 셈 — 갱신을 한 번씩만 지나도록 ref 로 든다 (재생 묶음이 바뀌면 처음부터) */
  const tallyRef = useRef<{ readonly ticks: readonly DefenseViewState[]; tally: RecordedBoardTally } | null>(null)
  if (tallyRef.current === null || tallyRef.current.ticks !== ticks) {
    tallyRef.current = { ticks, tally: EMPTY_RECORDED_TALLY }
  }
  // 타자주자(칸 0)가 달리는 재생 = 홈런 비행 — 웹 재생 갈래의 다른 판(견제·도루·폭투)은 타자주자를 안 싣는다.
  // 밀어내기 판(종류 2)은 타자주자를 싣지만 홈런이 아니다(0x357e0 은 결과 코드 24~26)
  const isHomeRun = !freePassPlay && ticks[0]?.runners.some((runner) => runner.index === 0) === true
  /** 0x519cc 키 건너뛰기를 받았다 — 그 그림 안에서 0x35108 까지 끝난다 */
  const [skipped, setSkipped] = useState(false)
  useEffect(() => {
    setSkipped(false)
    if (!freePassPlay) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 처리 0x53420 이 키마다 끝에 메시지 0x587 → 0x519cc — 원본이 아는 키만
      if (originalKeyOf(event.key) === null) return
      setSkipped(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [freePassPlay, ticks])
  const holder = tallyRef.current
  while (ticks.length > 0 && !holder.tally.ended && holder.tally.nextIndex <= update) {
    const at = holder.tally.nextIndex
    const view = ticks[Math.min(at, lastIndex)]
    if (view === undefined) break
    holder.tally = stepRecordedBoard(holder.tally, view, isHomeRun, at > lastIndex)
  }
  const isFinished = ticks.length === 0 || holder.tally.ended || skipped

  useEffect(() => {
    if (isFinished) onDone()
  }, [isFinished, onDone])

  const state = ticks[index]
  if (state === undefined) return null
  let board: readonly [number, number] | null = null
  if (runScoreBoard !== undefined && holder.tally.visible && !holder.tally.ended) {
    const runs = holder.tally.runs
    const scores: readonly [number, number] = [
      runScoreBoard.scores[0] + (runScoreBoard.battingSide === 0 ? runs : 0),
      runScoreBoard.scores[1] + (runScoreBoard.battingSide === 1 ? runs : 0),
    ]
    board = runScoreBoardHiddenScoresOf(scores, runScoreBoard.battingSide, holder.tally.hidden)
  }
  return (
    <DefenseScreen state={state} grassPalette={grassPalette}>
      {board !== null && runScoreBoard !== undefined && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      {children}
    </DefenseScreen>
  )
}

interface LivePlaybackProps {
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly onDone: (result?: DefensePlayResult) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly sceneMemory?: { current: DefenseSceneMemory }
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
function LivePlayback({
  input, side, onDone, grassPalette, runScoreBoard, sceneMemory, children,
}: LivePlaybackProps) {
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
  /**
   * 득점 점수판 칸 — 타이머 [+0x10f8] · 수 [+0x10fc] · 간격 [+0x1101] · 홈런 판 [+0x1100] (`lib/runScoreBoard`).
   * 메시지 0x13(1점)마다 0x357e0 이면 홈런 갈래, 아니면 타이머 20 — 그릴 때마다 줄인다. 판이 닫힌 뒤에도 0x35108 까지 그린다.
   */
  const boardRef = useRef<HomeRunScoreBoard>(EMPTY_HOME_RUN_SCORE_BOARD)
  /** +0x1094 — 관문이 닫힌 뒤 지난 갱신 수 (판 시작 0) */
  const closedCountRef = useRef(0)
  const [view, setView] = useState<DefenseViewState | null>(null)
  const [runBoard, setRunBoard] = useState<RunScoreBoardView | null>(null)
  /** 0x35108(0x17 끝)을 지났다 — 닫힌 뒤 11 번째 갱신, 홈런 점수판이 선 홈런 타구는 내려갈 때까지 더, 키 건너뛰기면 그 그림 */
  const [ended, setEnded] = useState(false)
  /**
   * 홈런 연출(HOMERUN 글자 · 홈런 효과 · 파티클 · 비거리 판 — `lib/defenseHomeRunEffects`). 원본 한 그림 = 진행기 한 틱이라 틱마다
   * 갱신(홈런 갈래) → 그리기(글자 · 유지 그림의 효과 틱) → 파티클 틱 차례로 돌고, 판이 닫힌 뒤 갱신에도 그리기 · 파티클 틱은 돈다.
   * 난수는 진행기와 같은 경기 난수(`input.random`)다 — 진행기 굴림 뒤에 그 그림의 효과 · 파티클 굴림이 든다.
   */
  const effectsRef = useRef<DefenseEffects>(defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START))
  // 0x17 진입 0x46418 이 4673e 에서 파티클 관리자를 비운다(0x6dee4) — 타석 화면(0x11 · 0x13)의 타격 불꽃은 여기로 안 이어진다
  const particlesRef = useRef<ParticleScene>(createParticleScene())
  /** 마지막으로 돈 갱신 — 판이 닫힌 뒤 건너뛴 갱신을 따라잡는다 */
  const closedUpdateRef = useRef<number | null>(null)
  const [effectsView, setEffectsView] = useState<{
    readonly text: HomeRunTextFrame | null
    readonly distanceBoard: number | null
    readonly version: number
  }>({ text: null, distanceBoard: null, version: 0 })
  /** 0x357e0 — 이 타구의 결과 코드 [+0xfd4] 가 24~26(홈런성)인가. 타석이 묶어 둔 쏜 공(`contactOfOutcome`)에서 읽는다 */
  const homeRunHit = isHomeRunHitCode(contactOfOutcome(input.outcome)?.resultCode)

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
      boardRef.current = EMPTY_HOME_RUN_SCORE_BOARD
      closedCountRef.current = 0
      effectsRef.current = defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START)
      particlesRef.current = createParticleScene()
      closedUpdateRef.current = null
      setEnded(false)
      setView(null)
      setRunBoard(null)
      setEffectsView({ text: null, distanceBoard: null, version: 0 })
    } else if (ended) {
      return
    }
    const state = stateRef.current
    if (state === null) return

    /** 득점 점수판 그리기 0x41a64 한 번 — 공격 쪽 점수는 지금 점수판 득점에서 그 갈래가 숨기는 만큼 뺀다 */
    const drawBoard = (runs: number): RunScoreBoardView | null => {
      const drawn = drawRunScoreBoardScene(boardRef.current, homeRunHit)
      boardRef.current = drawn.next
      if (runScoreBoard === undefined || !drawn.visible) return null
      const scores: readonly [number, number] = [
        runScoreBoard.scores[0] + (runScoreBoard.battingSide === 0 ? runs : 0),
        runScoreBoard.scores[1] + (runScoreBoard.battingSide === 1 ? runs : 0),
      ]
      return { scores: runScoreBoardHiddenScoresOf(scores, runScoreBoard.battingSide, drawn.hidden) }
    }

    // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다
    const wanted = Math.floor((update - startedAtRef.current) / UPDATES_PER_TICK) + 1
    let running = state
    let moved = false
    let board: RunScoreBoardView | null | undefined
    const effectsPorts = { particles: particlesRef.current, random: input.random, configOf: particleConfigOf }
    let effectsFrame: ReturnType<typeof stepDefenseEffects> | null = null
    let skippedNow = false
    // 키 건너뛰기(+0xfe7)가 서면 52b26~52b40 이 한 그림 안에서 판 끝까지 되풀이한다 — 따라잡을 틱 수와 상관없이 끝까지 돈다
    while ((running.tick < wanted || running.fastForward) && !isDefensePlayFinished(running)) {
      const tickBefore = tickBeforeOf(running)
      const wasFastForward = running.fastForward
      // 건너뛰는 동안은 그 그림의 키 처리(0x498d4)가 다시 오지 않는다
      running = stepDefensePlay(running, wasFastForward ? null : pressesRef.current.shift() ?? null)
      moved = true
      const facts = defenseTickFactsOf(tickBefore, running, isDefensePlayFinished(running))
      if (running.fastForward && !wasFastForward) {
        // 0x519cc 는 이 틱 갱신보다 먼저 — 글자 끄기 · 효과 칸 버리기 · 파티클 치우기 · 홈런 점수판 [+0x1100] = 0
        effectsRef.current = fastForwardDefenseEffects(effectsRef.current, particlesRef.current)
        boardRef.current = { ...boardRef.current, active: false }
      }
      // 득점 점수판 — 이 틱의 메시지 0x13 들(0x51fb8). 0x357e0 && +0xfe7 == 0 이면 홈런 갈래
      for (const slot of running.runInsThisTick) {
        boardRef.current = runScoreBoardRunIn(boardRef.current, slot, homeRunHit, running.fastForward)
      }
      if (running.fastForward) {
        // 건너뛰는 동안은 그리기 · 프레임 끝 파티클 틱이 없다 — 갱신 쪽(글자 켜기 · +0x36)만
        effectsRef.current = updateDefenseEffectsWithoutDraw(effectsRef.current, facts)
        skippedNow = true
      } else {
        // 홈런 연출 — 이 틱의 갱신 · 그리기 · 프레임 끝 파티클 틱 (진행기 굴림 뒤)
        effectsFrame = stepDefenseEffects(effectsRef.current, facts, effectsPorts)
        effectsRef.current = effectsFrame.effects
        // 득점 점수판 0x41a64 (그리기 0x46e62). 한 갱신에 여러 틱을 따라잡으면 마지막 틱 모습만 보인다
        board = drawBoard(running.held.scoreboardRuns)
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
    const finished = isDefensePlayFinished(running)
    // 닫힌 뒤(+0x1094 를 세는 갱신)에 온 키도 0x519cc 를 지난다 — 받으면 52b26 이 남은 셈을 이 그림 안에서 다 돈다
    if (!moved && finished && pressesRef.current.length > 0) {
      pressesRef.current = []
      if (acceptsFastForwardKey(running)) {
        effectsRef.current = fastForwardDefenseEffects(effectsRef.current, particlesRef.current)
        boardRef.current = { ...boardRef.current, active: false }
        skippedNow = true
      }
    }
    let endsNow = false
    if (skippedNow && finished) {
      // 판 끝 → +0x1094 11 번(+0x1100 은 0x519cc 가 내렸다) → 0x35108 이 이 그림 안에서 끝났다
      endsNow = true
    } else if (!moved && finished) {
      // 판이 닫힌 뒤 갱신 — 갱신은 529f0(+0x1094 셈, 판 칸 · 글자 없음), 그리기는 비거리 판 · 득점 점수판, 프레임 끝 파티클 틱.
      // 진행기가 닫은 갱신은 위에서 돌았다. 갱신을 건너뛴 만큼 따라잡는다(진행기 틱과 같은 상한)
      const closedFrames = Math.min(update - (closedUpdateRef.current ?? update - 1), MAX_CLOSED_CATCH_UP)
      for (let frame = 0; frame < closedFrames; frame += 1) {
        closedCountRef.current += 1
        if (closesDefenseScene(closedCountRef.current, homeRunHit, boardRef.current)) {
          endsNow = true
          break
        }
        effectsFrame = stepDefenseEffects(effectsRef.current, null, effectsPorts)
        effectsRef.current = effectsFrame.effects
        board = drawBoard(running.held.scoreboardRuns)
      }
    }
    closedUpdateRef.current = update
    if (moved) setView(running.ticks[running.ticks.length - 1] ?? null)
    if (endsNow) {
      // 0x35108 — 타이머 [+0x10f8] = 0 · +0x1100 = 0 · 글자 끄기 · 파티클 치우기 (아래 끝 효과)
      boardRef.current = { ...boardRef.current, timer: 0, active: false }
      setRunBoard(null)
      setEffectsView((previous) => ({ text: null, distanceBoard: null, version: previous.version + 1 }))
      setEnded(true)
      return
    }
    if (board !== undefined) setRunBoard(board)
    if (effectsFrame !== null) {
      const drawn = effectsFrame
      setEffectsView((previous) => ({ text: drawn.text, distanceBoard: drawn.distanceBoard, version: previous.version + 1 }))
    }
  }, [update, input, side, ended, runScoreBoard, sceneMemory, homeRunHit])

  useEffect(() => {
    if (!ended) return
    // 0x17 끝 0x35108 — 글자를 끄고 파티클을 치운다. 장면에 남는 칸(글자 칸 · +0x36)은 부르는 쪽 ref 로 돌려준다
    effectsRef.current = endDefenseEffects(effectsRef.current, particlesRef.current)
    if (sceneMemory !== undefined) sceneMemory.current = sceneMemoryOf(effectsRef.current)
    const state = stateRef.current
    onDone(state === null ? undefined : defensePlayResultOf(state))
  }, [ended, onDone, sceneMemory])

  if (view === null) return null
  // 0x46c88 차례 — 비거리 판(0x46cb6) → … → HOMERUN 글자(0x46e5c) → 득점 점수판(0x46e62), 그 뒤 프레임 끝 파티클(0x6dd68)
  return (
    <DefenseScreen state={view} grassPalette={grassPalette}>
      {effectsView.distanceBoard !== null && <DefenseDistanceBoard value={effectsView.distanceBoard} />}
      {effectsView.text !== null && <DefenseHomeRunText frame={effectsView.text} />}
      {runScoreBoard !== undefined && runBoard !== null && !ended && (
        <RunScoreBoard sides={runScoreBoard.sides} scores={runBoard.scores} />
      )}
      <DefenseParticles scene={particlesRef.current} version={effectsView.version} />
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
