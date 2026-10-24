import { useEffect, useRef, useState } from 'react'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import {
  appTickOfGameSceneTick, gameSceneTickNow, isCommonWindowShown, isGameSceneFrozen, useMarksGameScene,
} from '@/shared/lib/commonWindow/commonWindow'
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
import { withClosedThrowKeys } from '@/features/defense-play/model/defenseScene'
import { drawnFieldingErrorsOf, drawnFumbleCheerOf, type DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { deepLandingCheerSoundIdOf, runInCheerSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import {
  EMPTY_HOME_RUN_SCORE_BOARD, closesDefenseScene, drawRunScoreBoardScene, isHomeRunHitCode, runScoreBoardHiddenScoresOf,
  runScoreBoardRunIn,
} from '@/pages/defense/lib/runScoreBoard'
import type { HomeRunScoreBoard } from '@/pages/defense/lib/runScoreBoard'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { RunScoreBoard } from '@/pages/defense/ui/RunScoreBoard'
import { clearParticles, type ParticleScene } from '@/entities/particle/model/particleScene'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'
import { useClaimSceneParticles } from '@/widgets/particles/model/useClaimSceneParticles'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
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
import { ballParticleShotsOf, type BallParticleShot } from '@/pages/defense/lib/ballParticles'
import { cameraBoundsOf, centerOn, screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
import * as screenStyles from '@/pages/defense/ui/DefenseScreen.css'
import {
  liveRunnerPlayRandomOf,
  startLiveRunnerPlay,
  type LiveRunnerPlay,
  type LiveRunnerStepper,
} from '@/features/defense-play/model/liveRunnerPlay'

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
   * **실시간으로 돌릴 주자 판**(사람 수비의 도루 · 폭투 · 견제 — `features/defense-play/model/liveRunnerPlay`). 주면 진행기를
   * 매 갱신 한 틱씩 돌리며 `keydown` 을 그 틱의 키로 넘긴다(송구 키 → +0x160). `input` 이 없을 때만 본다.
   */
  readonly runnerPlay?: LiveRunnerPlay
  /**
   * 사람이 어느 쪽을 잡는가 — 조작 객체 `[+0xc]` (0 공격/주루 · 1 수비/송구).
   * **안 주면 자동이다**: 키를 눌러도 아무 일도 없고 CPU 규칙대로만 굴러간다.
   */
  readonly side?: ControlSide
  /** 마지막 틱까지 다 보여 준 뒤. 실시간 갈래는 그 플레이의 결과를 함께 넘긴다 */
  readonly onDone: (result?: DefensePlayResult) => void
  /**
   * 이 판의 그림들이 올린 **실책 +0x2e** (야수 그리기 0x43278 4381a~43904 — `features/defense-play/model/fieldingErrors`).
   * 그린 틱마다 세어 두었다가 `onDone` **바로 앞에** 한 번 넘긴다(없으면 안 부른다). 키 건너뛰기(+0xfe7)로 안 그린 틱은 안 센다
   */
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
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
 * 받은 키 줄 — 키마다 받은 장면 틱을 함께 든다. 원본은 키 콜백이 [+0x20] 에 적기만 하고 다음 틀의 0xbca05 → 키 0x498d4(52d9e) →
 * 0x53420 이 그 틀의 갱신보다 먼저 처리한다(`sceneKeyLatch`) — 받은 틱의 갱신에는 먹이지 않고 그 뒤 갱신부터 먹인다.
 * 웹은 한 갱신에 하나씩 먹인다(⚠️ 근사 — 원본 받은 칸은 하나라 한 틀에 둘이 오면 뒤 키만 남는다).
 */
function takePressFor(presses: DefenseKeyPress[], ticks: number[], sceneTick: number | null): DefenseKeyPress | null {
  const arrived = ticks[0]
  if (arrived === undefined || (sceneTick !== null && arrived >= sceneTick)) return null
  ticks.shift()
  return presses.shift() ?? null
}

/**
 * **펌블 함성 29** — 펌블 갈래 b4274~b4286 은 야수 +0xb8 = 6 · 메시지 0xbc2(처리기는 `bx lr`)뿐이고 동작 잠금 · 동작 0xd 가 없다
 * (53 을 내는 0xa1e60 은 필살타법 타구에 맞은 야수 몫이다 — CORRECTIONS 077c6ff · de278ad). 소리는 0x17 그리기 0x46c88 →
 * 야수 그리기 0x43278 의 0x4381a~0x43870 이 낸다:
 * ```
 * 437a4  +0xb4(동작 잠금) > 0 이면 먼지 애니 갈래 — 아니면 43818
 * 4381a  +0xb8 > 0 && +0xb8 == 6 → [+0xec]+0x2e += 1(9999 로 자름) · 0xa755d([…+0x230], 3) · 0x6e499(소리, 0x1d = 29, 0)  ; 예약
 * ```
 * +0xb8 은 야수 틱 0xa1284(a12da)가 잠금이 없을 때 틱마다 −1 한다. 한 그림의 차례는 G1 0x3f060(목록 틱 — 야수 틱) →
 * 슬롯 2(플레이 틱 — 펌블 굴림 0xb41d0) → G3 그리기라, **펌블이 난 틱의 그림**만 6 을 본다 → 그 틱에 29 한 번.
 * 키 건너뛰기(+0xfe7) 동안은 52b26 이 G1 → G2 만 되풀이하고 그리지 않아 소리가 없다.
 * 한 판에 펌블이 둘 나면 원본은 두 번 낸다 — 웹도 그린 틱마다 야수 칸(+0xb8 == 6)을 보고 낸다(`drawnFumbleCheerOf`).
 * 필살타법 타구에 맞은 야수의 53(0xa1e60 a1e82 즉시 재생)은 진행기 칸 `tickSounds` 의 차례(판정 콜 바로 뒤)로 그 틱에 낸다.
 *
 * 펌블을 굴리는 곳은 진행기(`runDefensePlay` 의 0xb41d0 굴림)지만 그쪽은 순수 함수라 소리를 못 낸다 —
 * 틱을 실제로 돌리는 **이 화면**이 원본과 같은 틱에 낸다.
 */
const FUMBLE_CHEER_SOUND = 29

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
  runnerPlay,
  side,
  onDone,
  onFieldingErrors,
  grassPalette = null,
  runScoreBoard,
  sceneMemory,
  freePassPlay = false,
  children,
}: DefensePlaybackProps) {
  // 수비 판(0x17)은 갱신마다 앱 전역 파티클 관리자를 직접 굴리고 그린다(그리기 0x46c88 → 프레임 끝 0x6de84 · 0x6dd69)
  useClaimSceneParticles()
  // 수비 판도 경기 장면 0x104 의 한 상태(0x17)다 — 0x3874 가 장면 객체를 new 하는 것은 장면 전환 때뿐이라 타석 화면이 내려가고 이
  // 판이 서도 장면은 그대로다(결과 코드 +0xfd4 · 파티클 관리자가 남는다). 타석 화면을 내리고 이 판만 그리는 길(`GameRoute` ·
  // `MissionRoutes`)에서도 경기 장면이 서 있다고 센다 — 공용 창이 뜨면 이 판도 멈춘다(`isGameSceneFrozen`)
  useMarksGameScene()
  if (input !== undefined) {
    return (
      <LivePlayback
        input={input}
        side={side}
        onDone={onDone}
        onFieldingErrors={onFieldingErrors}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
        sceneMemory={sceneMemory}
      >
        {children}
      </LivePlayback>
    )
  }
  if (runnerPlay !== undefined) {
    return (
      <LiveRunnerPlayback
        play={runnerPlay}
        onDone={onDone}
        onFieldingErrors={onFieldingErrors}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoard}
      >
        {children}
      </LiveRunnerPlayback>
    )
  }
  return (
    <RecordedPlayback
      ticks={ticks ?? []}
      onDone={onDone}
      onFieldingErrors={onFieldingErrors}
      grassPalette={grassPalette}
      runScoreBoard={runScoreBoard}
      freePassPlay={freePassPlay}
    >
      {children}
    </RecordedPlayback>
  )
}

/**
 * 이 그림의 공 그리기 0x36dfc 가 쏠 파티클 (`lib/ballParticles`) — 화면 좌표는 카메라 오프셋을 더한 것이다.
 * 원본 카메라는 그 그림의 0x3f060(목록 틱, 플레이 틱 앞)이 옮긴 자리다. 웹 화면은 갱신마다 앞 그림의 대상으로 카메라를 옮긴 뒤
 * 그리므로 **이 갱신에 화면이 적은 오프셋**이 같은 자리다. 첫 그림(아직 안 그림)은 화면 진입의 가운데 맞춤(공 (x, z))과 같다.
 * ⚠️ 한 갱신에 여러 틱을 따라잡으면 그 틱들은 같은 오프셋으로 쏜다(근사).
 */
function ballShotsAt(
  drawn: DefenseViewState | undefined,
  cameraOffset: { readonly x: number; readonly y: number } | null,
): readonly BallParticleShot[] {
  if (drawn === undefined) return []
  const offset =
    cameraOffset ??
    screenOffsetOf(
      centerOn(
        cameraBoundsOf(screenStyles.SCREEN_WIDTH, screenStyles.SCREEN_HEIGHT),
        drawn.cameraTarget ?? { x: drawn.ball.x, z: drawn.ball.z },
      ),
    )
  return ballParticleShotsOf(drawn, offset)
}

/**
 * **주자 판 · 재생 갈래의 공 그리기 파티클** — 0x17 진입 0x46418 이 파티클 관리자를 비우고(4673e 0x6dee4), 그림마다 0x46c88 이 공 그리기
 * 0x36dfc(판 종류를 안 본다 — `features/defense-play/model/ballParticleFacts`)로 튐 파티클을 쏘고 프레임 끝 0x6de84 가 굴린다.
 * 판이 닫힌 뒤 그림(+0x1094 셈)도 마지막 그림의 공을 그대로 그린다. 0x35108(끝) · 키 건너뛰기 0x519cc 가 치운다.
 * 주자 판에는 홈런 연출(글자 · 효과)이 없어 연출 칸은 빈 장면에서 시작한다.
 */
interface BallParticleRun {
  readonly scene: ParticleScene
  effects: DefenseEffects
  version: number
  cleared: boolean
}

function startBallParticleRun(): BallParticleRun {
  // 0x17 진입 0x46418 의 4673e — 앱 전역 관리자를 갈래 없이 비운다(0x6dee4, 굴림 없음)
  const scene = sceneParticleScene()
  clearParticles(scene)
  return { scene, effects: defenseEffectsOf(DEFENSE_SCENE_START), version: 0, cleared: false }
}

/** 그림 하나 — 공 그리기의 파티클을 쏘고 프레임 끝 파티클 틱을 돌린다 */
function drawBallParticles(
  run: BallParticleRun,
  drawn: DefenseViewState | undefined,
  cameraOffset: { readonly x: number; readonly y: number } | null,
  random: RandomPort,
  sceneTick: number | null,
): void {
  if (run.cleared) return
  const frame = stepDefenseEffects(
    run.effects,
    null,
    // 53048 — 공용 창이 서 있는 그림은 관리자 틱이 없다(위 `effectsPorts` 와 같은 게이트). 관리자 틱은 앱 틀당 한 번
    {
      particles: run.scene,
      random: isCommonWindowShown() ? undefined : random,
      configOf: particleConfigOf,
      ...(sceneTick === null ? {} : { appTick: appTickOfGameSceneTick(sceneTick) }),
    },
    ballShotsAt(drawn, cameraOffset),
  )
  run.effects = frame.effects
  run.version += 1
}

/** 0x35108 · 0x519cc — 파티클을 치운다 */
function clearBallParticles(run: BallParticleRun): void {
  if (run.cleared) return
  run.effects = endDefenseEffects(run.effects, run.scene)
  run.cleared = true
  run.version += 1
}

/**
 * 미리 돌린 재생 갈래의 파티클 굴림 — ⚠️ 근사: 원본은 경기 난수로 판 틱 굴림 사이사이에 굴리지만, 이 갈래의 판은 이미 다 돌았고
 * 경기 흐름도 그 뒤 굴림을 먼저 써 버렸다. 경기 난수를 건드리지 않게 그림 전용 난수로 굴린다
 */
const RECORDED_PARTICLE_SEED = 0x36dfc

interface RecordedPlaybackProps {
  readonly ticks: readonly DefenseViewState[]
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
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
  /** 이 갱신에 보낸 메시지 0x13 의 주자 칸들 — 0x51fb8 머리의 함성(`runInCheerSoundIdOf`)을 고른다 */
  readonly runIns: readonly number[]
}

const EMPTY_RECORDED_TALLY: RecordedBoardTally = {
  nextIndex: 0, leftHome: new Set(), scored: new Set(), runs: 0, board: EMPTY_HOME_RUN_SCORE_BOARD, closedCount: 0,
  ended: false, visible: false, hidden: 0, runIns: [],
}

/**
 * 재생 갱신 하나가 보낸 메시지 0x13 들의 함성 — 0x51fb8 머리 51fb8~51fdc (홈런성이 아니면 60, 홈런성이면 주자 칸 0 일 때만 30).
 * 갱신을 한 번씩만 지나는 셈(ref) 안에서 부르므로 한 번씩만 난다
 */
function playRunInCheers(tally: RecordedBoardTally, homeRunHit: boolean): void {
  for (const slot of tally.runIns) {
    const cheer = runInCheerSoundIdOf(slot, homeRunHit)
    if (cheer !== null) activeSound().play(cheer)
  }
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
  const runIns: number[] = []
  if (isClosed) {
    closedCount += 1
    // 52a1c — 홈런 판이 서 있는 동안은 안 닫는다
    if (closesDefenseScene(closedCount, isHomeRun, board)) {
      return { ...tally, nextIndex: tally.nextIndex + 1, closedCount, ended: true, visible: false, hidden: 0, runIns }
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
      runIns.push(runner.index)
      board = runScoreBoardRunIn(board, runner.index, isHomeRun, false)
    }
  }
  const drawn = drawRunScoreBoardScene(board, isHomeRun)
  return {
    nextIndex: tally.nextIndex + 1, leftHome, scored, runs, board: drawn.next, closedCount, ended: false,
    visible: drawn.visible, hidden: drawn.hidden, runIns,
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
 * 0x357e0(결과 코드 [경기+0xfd4] 24~26) — 주자 판(견제 · 도루 · 폭투 · 밀어내기)의 틱은 판이 열린 때의 값(`sceneResultCode`)을 싣고
 * 와 그것으로 본다(견제는 앞 공의 값이 남아 홈런 뒤 첫 공 앞 견제면 참이다). ⚠️ 그 값이 없는 재생(패턴 없이 온 홈런 재생)은
 * "타자주자가 달리는 재생 = 홈런 비행" 으로 읽는다.
 */
function RecordedPlayback({
  ticks, onDone, onFieldingErrors, grassPalette, runScoreBoard, freePassPlay, children,
}: RecordedPlaybackProps) {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u */
  const updateStartTickRef = useRef<number | null>(null)
  const update = useGameSceneUpdateCounter(ticks.length > 0, updateStartTickRef)
  const lastIndex = Math.max(0, ticks.length - 1)
  const index = Math.min(Math.floor(update / UPDATES_PER_TICK), lastIndex)
  /** 셈 — 갱신을 한 번씩만 지나도록 ref 로 든다 (재생 묶음이 바뀌면 처음부터) */
  const tallyRef = useRef<{ readonly ticks: readonly DefenseViewState[]; tally: RecordedBoardTally } | null>(null)
  if (tallyRef.current === null || tallyRef.current.ticks !== ticks) {
    tallyRef.current = { ticks, tally: EMPTY_RECORDED_TALLY }
  }
  /** 그린 틱이 올린 실책 (0x43278) — 재생 묶음이 바뀌면 비운다 */
  const errorsRef = useRef<{ readonly ticks: readonly DefenseViewState[]; readonly errors: DrawnFieldingError[] } | null>(null)
  if (errorsRef.current === null || errorsRef.current.ticks !== ticks) {
    errorsRef.current = { ticks, errors: [] }
  }
  const drawnErrors = errorsRef.current.errors
  // 주자 판은 판이 열린 때의 [경기+0xfd4] 를 싣고 온다(`sceneResultCode` — null 은 정해지지 않은 값이라 거짓으로 본다).
  // 싣지 않은 재생은 타자주자(칸 0)가 달리는 재생 = 홈런 비행. 밀어내기 판(종류 2)은 타자주자를 싣지만 홈런이 아니다
  const sceneResultCode = ticks[0]?.sceneResultCode
  const isHomeRun =
    sceneResultCode !== undefined
      ? isHomeRunHitCode(sceneResultCode)
      : !freePassPlay && ticks[0]?.runners.some((runner) => runner.index === 0) === true
  /** 0x519cc 키 건너뛰기를 받았다 — 그 그림 안에서 0x35108 까지 끝난다 */
  const [skipped, setSkipped] = useState(false)
  useEffect(() => {
    setSkipped(false)
    if (!freePassPlay) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 처리 0x53420 이 키마다 끝에 메시지 0x587 → 0x519cc — 원본이 아는 키만
      if (originalKeyOf(event.key) === null) return
      // 공용 창이 서 있으면 52cc6 이 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다
      if (isGameSceneFrozen()) return
      setSkipped(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [freePassPlay, ticks])
  const particlesRef = useRef<{ readonly ticks: readonly DefenseViewState[]; readonly run: BallParticleRun; readonly random: RandomPort } | null>(
    null,
  )
  if (particlesRef.current === null || particlesRef.current.ticks !== ticks) {
    particlesRef.current = { ticks, run: startBallParticleRun(), random: createSeededRandom(RECORDED_PARTICLE_SEED) }
  }
  const particles = particlesRef.current
  const cameraOffsetRef = useRef<{ readonly x: number; readonly y: number } | null>(null)
  const holder = tallyRef.current
  while (ticks.length > 0 && !holder.tally.ended && holder.tally.nextIndex <= update) {
    const at = holder.tally.nextIndex
    const view = ticks[Math.min(at, lastIndex)]
    if (view === undefined) break
    // G2 만 닫힌 그림(`closingListFrame`)은 그려지지만 슬롯 2 는 529f0 — 닫힌 셈(+0x1094)의 첫 갱신이다
    holder.tally = stepRecordedBoard(holder.tally, view, isHomeRun, at > lastIndex || view.closingListFrame === true)
    // 미리 돌린 주자 판이 그 틱에 낸 소리 — 판정 콜(플레이 틱 b4562 의 메시지 0xbba → 0x51a56: 9 → 17 · 13 → 62/20)과 자동 슬라이딩
    // 10(0x5268c). 원본은 판을 연 자리가 아니라 결과 코드가 선 그 틱에 낸다 — 진행기가 그림에 실은 차례(`tickSoundIds`) 그대로다.
    // 판이 닫힌 뒤 갱신(마지막 그림을 다시 쓰는 갱신)은 소리가 없다. 득점 함성(아래)은 실시간 주자 판(`LiveRunnerPlayback`)과 같이
    // 그 뒤에 낸다 — ⚠️ 원본은 득점 0xaa0a8(525fc)이 자동 슬라이딩(52670)보다 먼저라 한 틱에 둘 다 나면 차례가 다르다(근사)
    if (at <= lastIndex) for (const soundId of view.tickSoundIds ?? []) activeSound().play(soundId)
    playRunInCheers(holder.tally, isHomeRun)
    // 그 갱신의 그리기 — 공 그리기 0x36dfc 의 파티클 · 프레임 끝 파티클 틱. 0x35108 로 끝난 갱신은 안 그린다
    const recordedStartTick = updateStartTickRef.current
    if (!holder.tally.ended) {
      drawBallParticles(particles.run, view, cameraOffsetRef.current, particles.random, recordedStartTick === null ? null : recordedStartTick + at)
    }
    // 같은 그리기의 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e (판 틱만. ⚠️ 닫힌 갱신의 다시 그리기는 안 센다)
    if (!holder.tally.ended && at <= lastIndex) drawnErrors.push(...drawnFieldingErrorsOf(view.fielders))
  }
  const isFinished = ticks.length === 0 || holder.tally.ended || skipped
  if (isFinished) clearBallParticles(particles.run)

  // 넘길 곳은 늘 최신 것 — 부르는 쪽이 그릴 때마다 새 함수를 줘도 끝(onDone)을 다시 부르지 않게 의존에서 뺀다
  const onFieldingErrorsRef = useRef(onFieldingErrors)
  onFieldingErrorsRef.current = onFieldingErrors
  useEffect(() => {
    if (!isFinished) return
    if (drawnErrors.length > 0) onFieldingErrorsRef.current?.(drawnErrors)
    onDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 실책 묶음은 재생 묶음(ticks)마다 하나다
  }, [isFinished, onDone])

  const tickState = ticks[index]
  if (tickState === undefined) return null
  // 마지막 틱(관문이 닫힌 틱) 뒤 갱신 — 0x3f060 의 G1(3f0b8)이 닫혀 카메라가 선다
  const state = Math.floor(update / UPDATES_PER_TICK) > lastIndex ? frozenCamera(tickState) : tickState
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
    <DefenseScreen state={state} grassPalette={grassPalette} cameraOffsetRef={cameraOffsetRef}>
      {board !== null && runScoreBoard !== undefined && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      <DefenseParticles scene={particles.run.scene} version={particles.run.version} />
      {children}
    </DefenseScreen>
  )
}

interface LiveRunnerPlaybackProps {
  readonly play: LiveRunnerPlay
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
  readonly grassPalette: number | null
  readonly runScoreBoard?: RunScoreBoardSource
  readonly children?: React.ReactNode
}

/**
 * 사람이 잡은 **주자 판**(도루 · 폭투 · 견제)을 매 갱신 한 틱씩 돌린다 — 타구 판(`LivePlayback`)과 같은 모양이다.
 * 눌린 키를 줄 세워 한 틱에 하나씩 진행기에 먹이고(상태 0x17 키 0x53420 → 수비면 송구 0x588 → +0x160, 공격이면 주루 0x5331c →
 * 0x582 · 0x584 와 OK 슬라이딩 0x585 — 어느 쪽인지는 판의 `side`), 관문이 닫힌 뒤로는 재생 갈래와
 * 같은 닫힌 갱신(+0x1094 가 11 이 되는 갱신에 0x35108)과 득점 점수판 셈(`stepRecordedBoard`)을 지난다.
 */
function LiveRunnerPlayback({ play, onDone, onFieldingErrors, grassPalette, runScoreBoard, children }: LiveRunnerPlaybackProps) {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u */
  const updateStartTickRef = useRef<number | null>(null)
  const update = useGameSceneUpdateCounter(true, updateStartTickRef)
  const stepperRef = useRef<{ readonly play: LiveRunnerPlay; readonly stepper: LiveRunnerStepper; readonly startedAt: number } | null>(
    null,
  )
  if (stepperRef.current === null || stepperRef.current.play !== play) {
    stepperRef.current = { play, stepper: startLiveRunnerPlay(play), startedAt: update }
  }
  const pressesRef = useRef<DefenseKeyPress[]>([])
  /** 줄의 키마다 받은 장면 틱 (`takePressFor`) */
  const pressTicksRef = useRef<number[]>([])
  const tallyRef = useRef<{ readonly play: LiveRunnerPlay; tally: RecordedBoardTally } | null>(null)
  const particlesRef = useRef<{ readonly play: LiveRunnerPlay; readonly run: BallParticleRun } | null>(null)
  const cameraOffsetRef = useRef<{ readonly x: number; readonly y: number } | null>(null)
  if (tallyRef.current === null || tallyRef.current.play !== play) {
    tallyRef.current = { play, tally: EMPTY_RECORDED_TALLY }
    pressesRef.current = []
    pressTicksRef.current = []
  }
  if (particlesRef.current === null || particlesRef.current.play !== play) {
    particlesRef.current = { play, run: startBallParticleRun() }
  }
  /** 그린 틱이 올린 실책 (0x43278) — 판이 바뀌면 비운다 */
  const errorsRef = useRef<{ readonly play: LiveRunnerPlay; readonly errors: DrawnFieldingError[] } | null>(null)
  if (errorsRef.current === null || errorsRef.current.play !== play) {
    errorsRef.current = { play, errors: [] }
  }
  const drawnErrors = errorsRef.current.errors

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 원본이 아는 키만 담는다 (숫자·방향·OK·CLR)
      if (originalKeyOf(event.key) === null) return
      // 공용 창이 서 있으면 52cc6 이 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다
      if (isGameSceneFrozen()) return
      pressesRef.current.push({ key: event.key, isRepeat: event.repeat })
      pressTicksRef.current.push(gameSceneTickNow())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { stepper, startedAt } = stepperRef.current
  // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다 (`LivePlayback` 과 같은 상한은 진행기의 판 끝이 정한다)
  const wanted = Math.floor((update - startedAt) / UPDATES_PER_TICK) + 1
  let guard = 0
  while (!stepper.finished && stepper.tick < wanted && guard < MAX_CLOSED_CATCH_UP) {
    // 이 걸음은 갱신 (startedAt + 틱) — 그 장면 틱보다 앞 틱에 받은 키만 먹인다
    const updateStartTick = updateStartTickRef.current
    stepper.step(
      takePressFor(pressesRef.current, pressTicksRef.current, updateStartTick === null ? null : updateStartTick + startedAt + stepper.tick),
    )
    // 그 틱의 소리 차례대로 — 슬라이딩 10(사람 OK 키 0x518da → 0x5199c · 자동 0x5268c)과 판정 콜(플레이 틱 b4562 의 메시지 0xbba →
    // 0x51a56 → 9 는 0x51c14 의 17 · 13 은 0x51b36 의 62/20). 콜은 판 끝이 아니라 결과 코드가 선 이 틱에 난다
    for (const soundId of stepper.soundsThisTick) activeSound().play(soundId)
    guard += 1
  }
  const ticks = stepper.ticks
  const lastIndex = Math.max(0, ticks.length - 1)
  // 판 동안은 그려진 틱까지, 닫힌 뒤로는 닫힌 갱신(+0x1094)을 센다
  const holder = tallyRef.current
  const particles = particlesRef.current
  const random = liveRunnerPlayRandomOf(play)
  const seen = update - startedAt
  while (ticks.length > 0 && !holder.tally.ended && holder.tally.nextIndex <= seen) {
    const at = holder.tally.nextIndex
    if (at > lastIndex && !stepper.finished) break
    const view = ticks[Math.min(at, lastIndex)]
    if (view === undefined) break
    // 주자 판(도루 · 폭투 · 견제)의 0x357e0 은 판이 열린 때 남은 [경기+0xfd4](`sceneResultCode`)를 본다 — 0x11 진입(3deea)이
    // 공마다 0 으로 지우고 스윙 판정(5130e)만 덮어, 도루 · 폭투는 이 공의 값(안 휘둘렀으면 0), 견제는 앞 공의 값이다
    const homeRunHit = isHomeRunHitCode(view.sceneResultCode)
    holder.tally = stepRecordedBoard(holder.tally, view, homeRunHit, at > lastIndex || view.closingListFrame === true)
    playRunInCheers(holder.tally, homeRunHit)
    // 그 갱신의 그리기 — 공 그리기 0x36dfc 의 튐 파티클 · 프레임 끝 파티클 틱(경기 난수 — 그 틱 진행기 굴림 뒤).
    // 0x35108 로 끝난 갱신은 안 그린다. ⚠️ 판 틱을 미리 몇 틱 앞서 돌린 갱신(따라잡기)은 굴림 차례가 그 틱들 뒤로 몰린다(근사)
    const runnerStartTick = updateStartTickRef.current
    if (!holder.tally.ended && random !== undefined) {
      drawBallParticles(particles.run, view, cameraOffsetRef.current, random, runnerStartTick === null ? null : runnerStartTick + startedAt + at)
    }
    // 같은 그리기의 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e (판 틱만. ⚠️ 닫힌 갱신의 다시 그리기는 안 센다)
    if (!holder.tally.ended && at <= lastIndex) drawnErrors.push(...drawnFieldingErrorsOf(view.fielders))
  }
  const isFinished = stepper.finished && holder.tally.ended
  if (isFinished) clearBallParticles(particles.run)

  const onFieldingErrorsRef = useRef(onFieldingErrors)
  onFieldingErrorsRef.current = onFieldingErrors
  useEffect(() => {
    if (!isFinished) return
    if (drawnErrors.length > 0) onFieldingErrorsRef.current?.(drawnErrors)
    // 판이 닫힌 뒤(+0x1094 셈) 온 키 · 판 끝까지 못 먹인 키도 키 처리 0x53420 을 지난다 — 사람 수비면 송구 0x533c8 → 0x588 → vt60 이
    // +0x160 에 적고, 닫힌 판에서는 쓰는 곳(b4660)이 없어 다음 판으로 남는다(`withClosedThrowKeys`)
    const result = stepper.result()
    const scene = withClosedThrowKeys(result.scene, pressesRef.current, play.side ?? '수비')
    onDone(scene === result.scene ? result : { ...result, scene })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 실책 묶음은 판(play)마다 하나다
  }, [isFinished, onDone, stepper])

  const tickState = ticks[Math.min(Math.max(0, seen), lastIndex)]
  if (tickState === undefined) return null
  // 판이 닫힌 뒤 갱신 — 0x3f060 의 G1(3f0b8)이 닫혀 카메라가 선다
  const state = stepper.finished && seen > lastIndex ? frozenCamera(tickState) : tickState
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
    <DefenseScreen state={state} grassPalette={grassPalette} cameraOffsetRef={cameraOffsetRef}>
      {board !== null && runScoreBoard !== undefined && <RunScoreBoard sides={runScoreBoard.sides} scores={board} />}
      <DefenseParticles scene={particles.run.scene} version={particles.run.version} />
      {children}
    </DefenseScreen>
  )
}

interface LivePlaybackProps {
  readonly input: DefensePlayInput
  readonly side?: ControlSide
  readonly onDone: (result?: DefensePlayResult) => void
  readonly onFieldingErrors?: (errors: readonly DrawnFieldingError[]) => void
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
  input, side, onDone, onFieldingErrors, grassPalette, runScoreBoard, sceneMemory, children,
}: LivePlaybackProps) {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u */
  const updateStartTickRef = useRef<number | null>(null)
  const update = useGameSceneUpdateCounter(true, updateStartTickRef)
  const stateRef = useRef<DefensePlayState | null>(null)
  const builtFromRef = useRef<DefensePlayInput | null>(null)
  const builtSideRef = useRef<ControlSide | undefined>(undefined)
  /** 이 플레이가 시작된 갱신 번호 — 갱신 계수는 화면이 서고부터 계속 오르므로 빼 준다 */
  const startedAtRef = useRef(0)
  /** 아직 진행기에 안 먹인 키들 */
  const pressesRef = useRef<DefenseKeyPress[]>([])
  /** 줄의 키마다 받은 장면 틱 (`takePressFor`) */
  const pressTicksRef = useRef<number[]>([])
  /** 판이 닫힌 뒤(+0x1094 셈) 온 키들 — 사람 수비면 0x533c8 → 0x588 → vt60 이 +0x160 에 적어 다음 판으로 남는다(`withClosedThrowKeys`) */
  const closedPressesRef = useRef<DefenseKeyPress[]>([])
  /** 그린 틱이 올린 실책 (야수 그리기 0x43278 4381a~43904) · 이미 본 진행기 틱 수 */
  const drawnErrorsRef = useRef<DrawnFieldingError[]>([])
  const seenTickCountRef = useRef(0)
  const onFieldingErrorsRef = useRef(onFieldingErrors)
  onFieldingErrorsRef.current = onFieldingErrors
  /**
   * 득점 점수판 칸 — 타이머 [+0x10f8] · 수 [+0x10fc] · 간격 [+0x1101] · 홈런 판 [+0x1100] (`lib/runScoreBoard`).
   * 메시지 0x13(1점)마다 0x357e0 이면 홈런 갈래, 아니면 타이머 20 — 그릴 때마다 줄인다. 판이 닫힌 뒤에도 0x35108 까지 그린다.
   */
  const boardRef = useRef<HomeRunScoreBoard>(EMPTY_HOME_RUN_SCORE_BOARD)
  /** +0x1094 — 관문이 닫힌 뒤 지난 갱신 수 (판 시작 0) */
  const closedCountRef = useRef(0)
  const [view, setView] = useState<DefenseViewState | null>(null)
  /** 판이 닫힌 뒤 갱신(+0x1094 셈)에 들었고 0x3f060 의 G1(3f0b8)이 닫혔다 — 카메라가 선다 */
  const [closed, setClosed] = useState(false)
  /**
   * 진행기가 판 끝에 찍은 "G2 만 닫힌 그림"(`closingListFrame`) — 원본은 닫힌 첫 갱신(+0x1094 = 1)에 목록 틱 · 카메라를 한 번 더 돌려
   * 이 그림을 그리고, 그 다음 갱신부터 G1 이 닫혀 카메라가 선다. 없으면 null
   */
  const closingFrameRef = useRef<DefenseViewState | null>(null)
  const [runBoard, setRunBoard] = useState<RunScoreBoardView | null>(null)
  /** 0x35108(0x17 끝)을 지났다 — 닫힌 뒤 11 번째 갱신, 홈런 점수판이 선 홈런 타구는 내려갈 때까지 더, 키 건너뛰기면 그 그림 */
  const [ended, setEnded] = useState(false)
  /**
   * 홈런 연출(HOMERUN 글자 · 홈런 효과 · 파티클 · 비거리 판 — `lib/defenseHomeRunEffects`). 원본 한 그림 = 진행기 한 틱이라 틱마다
   * 갱신(홈런 갈래) → 그리기(글자 · 유지 그림의 효과 틱) → 파티클 틱 차례로 돌고, 판이 닫힌 뒤 갱신에도 그리기 · 파티클 틱은 돈다.
   * 난수는 진행기와 같은 경기 난수(`input.random`)다 — 진행기 굴림 뒤에 그 그림의 효과 · 파티클 굴림이 든다.
   */
  const effectsRef = useRef<DefenseEffects>(defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START))
  // 앱 전역 파티클 관리자 [0x1400068] — 0x17 진입 0x46418 이 4673e 에서 비운다(0x6dee4, 아래 판 시작) — 타석 화면(0x11 · 0x13)의
  // 타격 불꽃 · 메뉴에서 남은 이미터는 여기로 안 이어진다
  const particlesRef = useRef<ParticleScene>(sceneParticleScene())
  /** 마지막으로 돈 갱신 — 판이 닫힌 뒤 건너뛴 갱신을 따라잡는다 */
  const closedUpdateRef = useRef<number | null>(null)
  /** 화면(`DefenseScreen`)이 마지막으로 그린 카메라 오프셋 (+0xfec, +0xff0) — 공 그리기 파티클의 화면 좌표 */
  const cameraOffsetRef = useRef<{ readonly x: number; readonly y: number } | null>(null)
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
      // 공용 창이 서 있으면 52cc6 이 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다
      if (isGameSceneFrozen()) return
      // 누르고 있는 중인가 — 레이저 확정은 새로 누른 키만 받는다 (0x4e858 키 반복 계수 0)
      pressesRef.current.push({ key: event.key, isRepeat: event.repeat })
      pressTicksRef.current.push(gameSceneTickNow())
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
      pressTicksRef.current = []
      closedPressesRef.current = []
      drawnErrorsRef.current = []
      seenTickCountRef.current = 0
      boardRef.current = EMPTY_HOME_RUN_SCORE_BOARD
      closedCountRef.current = 0
      effectsRef.current = defenseEffectsOf(sceneMemory?.current ?? DEFENSE_SCENE_START)
      clearParticles(particlesRef.current)
      closedUpdateRef.current = null
      closingFrameRef.current = null
      cameraOffsetRef.current = null
      setEnded(false)
      setClosed(false)
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

    /** 이 그림의 공 그리기 0x36dfc 가 쏠 파티클 (`ballShotsAt`) */
    const ballShotsOf = (drawn: DefenseViewState | undefined): readonly BallParticleShot[] =>
      ballShotsAt(drawn, cameraOffsetRef.current)

    // 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다
    const wanted = Math.floor((update - startedAtRef.current) / UPDATES_PER_TICK) + 1
    let running = state
    let moved = false
    let board: RunScoreBoardView | null | undefined
    // 53048 — 공용 창 [0x140005c]+9 가 서 있으면 경기 장면 프레임이 관리자 틱 0x6de85 를 건너뛴다(그리기 쪽 0x40faa 효과 틱도 상태 그리기와
    // 함께 건너뛴다 — 52f24). 난수를 안 넘기면 `stepDefenseEffects` 가 두 틱을 안 돈다.
    // 갱신(52cc6)도 멈춘다 — 갱신 계수가 경기 장면 시계로 서므로(`useGameSceneUpdateCounter`) 창이 떠 있는 동안 진행기 틱이 안 돌고,
    // 창이 닫히면 건너뛴 틱을 따라잡지 않고 그 자리에서 이어 돈다
    const effectsPorts = {
      particles: particlesRef.current,
      random: isCommonWindowShown() ? undefined : input.random,
      configOf: particleConfigOf,
    }
    let effectsFrame: ReturnType<typeof stepDefenseEffects> | null = null
    let skippedNow = false
    // 키 건너뛰기(+0xfe7)가 서면 52b26~52b40 이 한 그림 안에서 판 끝까지 되풀이한다 — 따라잡을 틱 수와 상관없이 끝까지 돈다
    while ((running.tick < wanted || running.fastForward) && !isDefensePlayFinished(running)) {
      const tickBefore = tickBeforeOf(running)
      const wasFastForward = running.fastForward
      // 건너뛰는 동안은 그 그림의 키 처리(0x498d4)가 다시 오지 않는다
      // 이 걸음은 갱신 (startedAt + 틱) — 그 장면 틱보다 앞 틱에 받은 키만 먹인다
      const updateStartTick = updateStartTickRef.current
      const stepSceneTick = updateStartTick === null ? null : updateStartTick + startedAtRef.current + running.tick
      running = stepDefensePlay(
        running,
        wasFastForward ? null : takePressFor(pressesRef.current, pressTicksRef.current, stepSceneTick),
      )
      moved = true
      const facts = defenseTickFactsOf(tickBefore, running, isDefensePlayFinished(running))
      if (running.fastForward && !wasFastForward) {
        // 0x519cc 는 이 틱 갱신보다 먼저 — 소리 끊기(0x519fe 0x6e418) · 글자 끄기 · 효과 칸 버리기 · 파티클 치우기 ·
        // 홈런 점수판 [+0x1100] = 0. 이 틱에 나는 소리(펌블 · 슬라이딩)는 끊은 뒤에 난다
        activeSound().stop()
        effectsRef.current = fastForwardDefenseEffects(effectsRef.current, particlesRef.current)
        boardRef.current = { ...boardRef.current, active: false }
      }
      // 득점 점수판 — 이 틱의 메시지 0x13 들(0x51fb8). 0x357e0 && +0xfe7 == 0 이면 홈런 갈래.
      for (const slot of running.runInsThisTick) {
        boardRef.current = runScoreBoardRunIn(boardRef.current, slot, homeRunHit, running.fastForward)
      }
      // 이 틱의 소리 — 진행기가 원본 차례로 적은 그대로 낸다(`DefensePlayState.tickSounds`):
      // OK 슬라이딩 10(키 처리 0x5199c) → 머리 카메라 3f17e 의 메시지 0x13 함성 → 판정 콜(b4562 메시지 0xbba → 0x51a56 → 표 0xd0488:
      // 7 → 25 · 8/12 → 11 · 9 → 17 · 11 → 62 · 13 → 62/20) → 53(b4588 → 0xa1e60) → 득점 0xaa0a8 의 메시지 0x13 함성 → 자동 슬라이딩 10
      // (0x5268c) → (건너뛰는 동안) 52b26 카메라 함성 → 깊은 낙구 함성 60(52b62). 0xbfbac 는 큐가 아니라 받는 곳(경기 장면 0x509a0)을
      // 곧바로 부르므로 메시지 0x13 · 0xbba 의 소리는 보낸 그 자리다. 0x51fb8 머리의 함성은 홈런성(0x357e0)이 아니면 60, 홈런성이면 주자
      // 칸 0 일 때만 30 (+0xfe7 은 안 본다). 예약 0x6e498(10 · 함성)도 울리던 소리를 끊는 한 칸이라 통로 하나 `play` 와 같다.
      // ⚠️ 0x519cc 의 소리 끊기(위)는 원본에서 키 처리의 0x585(슬라이딩) 뒤 0x587 이라 같은 틱의 OK 슬라이딩 10 도 끊지만, 웹은 끊은 뒤에 낸다
      for (const sound of running.tickSounds) {
        const soundId =
          sound.kind === 'sound'
            ? sound.soundId
            : sound.kind === 'runIn'
              ? runInCheerSoundIdOf(sound.slot, homeRunHit)
              : deepLandingCheerSoundIdOf(homeRunHit)
        if (soundId !== null) activeSound().play(soundId)
      }
      if (running.fastForward) {
        // 건너뛰는 동안은 그리기 · 프레임 끝 파티클 틱이 없다 — 갱신 쪽(글자 켜기 · +0x36)만
        effectsRef.current = updateDefenseEffectsWithoutDraw(effectsRef.current, facts)
        skippedNow = true
      } else {
        // 홈런 연출 — 이 틱의 갱신 · 그리기 · 프레임 끝 파티클 틱 (진행기 굴림 뒤)
        effectsFrame = stepDefenseEffects(
          effectsRef.current,
          facts,
          stepSceneTick === null ? effectsPorts : { ...effectsPorts, appTick: appTickOfGameSceneTick(stepSceneTick) },
          ballShotsOf(running.ticks[running.ticks.length - 1]),
        )
        effectsRef.current = effectsFrame.effects
        // 득점 점수판 0x41a64 (그리기 0x46e62). 한 갱신에 여러 틱을 따라잡으면 마지막 틱 모습만 보인다
        board = drawBoard(running.held.scoreboardRuns)
      }
      // 이 틱의 그림(G3) 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e. 건너뛰는 동안(+0xfe7)은 그리지 않아 안 센다.
      // 판 끝 틱이 함께 찍은 "G2 만 닫힌 그림"(`closingListFrame`)도 목록 틱을 돌고 그리는 그림이라 센다
      // 같은 고리의 펌블 함성 29(4381a~43870) — 펌블이 난 **그 틱**의 그림만 +0xb8 == 6 을 본다(0xb41d0 굴림 → b4280). 그리기 G3 은
      // 슬롯 2(슬라이딩 10, 0x5268c)보다 뒤라 같은 그림이면 예약 칸을 29 가 덮는다 — 웹도 슬라이딩 뒤에 낸다.
      // 플레이 끝에 몰아서 내면 아웃 콜(0x51b36)을 덮는다 — 소리 통로가 하나뿐이기 때문이다.
      for (let at = seenTickCountRef.current; at < running.ticks.length; at += 1) {
        const drawn = running.ticks[at]
        if (drawn === undefined || running.fastForward) continue
        drawnErrorsRef.current.push(...drawnFieldingErrorsOf(drawn.fielders))
        if (drawnFumbleCheerOf(drawn.fielders)) activeSound().play(FUMBLE_CHEER_SOUND)
      }
      seenTickCountRef.current = running.ticks.length
    }
    stateRef.current = running
    // 건너뛰기가 이 그림 안에서 여러 틱을 돌고 판 끝 전에 풀리면(카메라 3f17e) 다음 그림부터는 다시 한 그림에 한 틱이다 — 앞서 돈 틱만큼
    // 시작 갱신을 당겨 갱신 계수가 진행기 틱을 따라잡을 때까지 멈춰 있지 않게 한다
    if (running.tick > wanted) startedAtRef.current -= running.tick - wanted
    const finished = isDefensePlayFinished(running)
    // 닫힌 뒤(+0x1094 를 세는 갱신)에 온 키도 0x519cc 를 지난다 — 받으면 52b26 이 남은 셈을 이 그림 안에서 다 돈다
    // 이 그림의 장면 틱보다 앞 틱에 받은 키만 이 그림의 키 처리가 읽는다
    const updateStartTickNow = updateStartTickRef.current
    const arrivedPresses: DefenseKeyPress[] = []
    while (!moved && finished) {
      const press = takePressFor(pressesRef.current, pressTicksRef.current, updateStartTickNow === null ? null : updateStartTickNow + update)
      if (press === null) break
      arrivedPresses.push(press)
    }
    if (!moved && finished && arrivedPresses.length > 0) {
      // 같은 키 처리 0x53420 이 0x587(건너뛰기)보다 먼저 사람 수비 송구 0x533c8 → 0x588 → +0x160 을 적는다 — 판 끝에 장면 칸으로 넘긴다
      closedPressesRef.current.push(...arrivedPresses)
      if (acceptsFastForwardKey(running)) {
        // 0x519fe — 소리 끊기(0x6e418)
        activeSound().stop()
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
        // 닫힌 첫 갱신이 G2 만 닫힌 그림이면 그 그림(목록 틱 · 카메라 한 걸음)을 그리고, 그 뒤 갱신부터 카메라가 선다
        const closing = closingFrameRef.current
        if (closing !== null && closedCountRef.current === 1) setView(closing)
        else setClosed(true)
        if (closesDefenseScene(closedCountRef.current, homeRunHit, boardRef.current)) {
          endsNow = true
          break
        }
        // 닫힌 뒤 그림도 공을 그린다 — 마지막 그림의 공 · 조건 그대로(카메라는 서 있다)
        // 이 닫힌 갱신의 장면 틱 — 따라잡는 갱신은 지금 갱신에서 거꾸로 센다
        const closedSceneTick = updateStartTickNow === null ? null : updateStartTickNow + update - (closedFrames - 1 - frame)
        effectsFrame = stepDefenseEffects(
          effectsRef.current,
          null,
          closedSceneTick === null ? effectsPorts : { ...effectsPorts, appTick: appTickOfGameSceneTick(closedSceneTick) },
          ballShotsOf(running.ticks[running.ticks.length - 1]),
        )
        effectsRef.current = effectsFrame.effects
        board = drawBoard(running.held.scoreboardRuns)
      }
    }
    closedUpdateRef.current = update
    if (moved) {
      // 판 끝 틱이 "G2 만 닫힌 그림" 을 함께 찍었으면 그 그림은 다음(닫힌 첫) 갱신 몫이다
      const last = running.ticks[running.ticks.length - 1] ?? null
      if (last?.closingListFrame === true) {
        closingFrameRef.current = last
        setView(running.ticks[running.ticks.length - 2] ?? null)
      } else {
        setView(last)
      }
    }
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
    if (drawnErrorsRef.current.length > 0) onFieldingErrorsRef.current?.(drawnErrorsRef.current)
    if (state === null) {
      onDone(undefined)
      return
    }
    // 판이 닫힌 뒤에 온 사람 송구 키(+0x160)는 다음 판으로 남는다 — 경기 흐름이 넘기는 장면 칸에 적는다
    const result = defensePlayResultOf(state)
    const scene = withClosedThrowKeys(result.scene, closedPressesRef.current, builtSideRef.current)
    onDone(scene === result.scene ? result : { ...result, scene })
  }, [ended, onDone, sceneMemory])

  if (view === null) return null
  // 0x46c88 차례 — 비거리 판(0x46cb6, 선수 아래 · 줌 안) → 선수 · 공 → … → HOMERUN 글자(0x46e5c) → 득점 점수판(0x46e62),
  // 그 뒤 프레임 끝 파티클(0x6dd68)
  return (
    <DefenseScreen
      state={closed ? frozenCamera(view) : view}
      grassPalette={grassPalette}
      cameraOffsetRef={cameraOffsetRef}
      underActors={
        effectsView.distanceBoard !== null ? <DefenseDistanceBoard value={effectsView.distanceBoard} /> : undefined
      }
    >
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
 * 판이 닫힌 뒤 그림 — 0x3f060 이 3f0b8 관문(G1)에서 닫혀 대상 · 따라가기(3f1c0)까지 안 가므로 카메라가 그 자리에 선다.
 * G2 만 닫히고 G1 은 열린 그림(+0x120 세기가 G1 · G2 사이에서 51 이 될 때)은 진행기가 `closingListFrame` 으로 마지막에 찍어 둔다 —
 * 그 그림까지는 카메라가 움직이고 그 다음 갱신부터 선다.
 */
function frozenCamera(state: DefenseViewState): DefenseViewState {
  return state.cameraFrozen === true ? state : { ...state, cameraFrozen: true }
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
