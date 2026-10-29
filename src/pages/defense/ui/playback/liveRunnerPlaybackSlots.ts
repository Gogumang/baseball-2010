import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { drawnFieldingErrorsOf, type DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import {
  liveRunnerPlayRandomOf,
  startLiveRunnerPlay,
  type LiveRunnerPlay,
  type LiveRunnerStepper,
} from '@/features/defense-play/model/liveRunnerPlay'
import { isHomeRunHitCode } from '@/pages/defense/lib/runScoreBoard'
import { clearBallParticles, drawBallParticles, startBallParticleRun, type BallParticleRun } from '@/pages/defense/ui/playback/ballParticleRun'
import { burstWindowHoldOf, drawBurstWindowFrames, type BurstWindowHold } from '@/pages/defense/ui/playback/burstWindowHold'
import { newSceneKeyQueue, takeQueuedPress, type SceneKeyQueue } from '@/pages/defense/ui/playback/keyQueue'
import { MAX_CLOSED_CATCH_UP, UPDATES_PER_TICK, type CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import { EMPTY_RECORDED_TALLY, stepRecordedBoard, type RecordedBoardTally } from '@/pages/defense/ui/playback/recordedBoardTally'
import { redrawPlaybackPicture } from '@/pages/defense/ui/playback/redrawPlaybackPicture'
import { playRunnerTickSounds } from '@/pages/defense/ui/playback/runnerTickSounds'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 주자 판 하나의 진행기 · 셈 — 판이 바뀌면 처음부터 */
interface LiveRunnerBundle {
  readonly play: LiveRunnerPlay
  readonly stepper: LiveRunnerStepper
  /** 판이 선 갱신 번호 — 갱신 계수는 화면이 서고부터 계속 오르므로 빼 준다 */
  readonly startedAt: number
  /** 판 동안은 그려진 틱까지, 닫힌 뒤로는 닫힌 갱신(+0x1094)을 센다 */
  tally: RecordedBoardTally
  /** 그린 틱이 올린 실책 (0x43278) */
  readonly errors: DrawnFieldingError[]
  readonly run: BallParticleRun
  /** 창이 선 첫 그림([창+0x250]) 가운데 다시 그린 수 */
  redrawn: number
}

/**
 * **주자 판 갈래가 그리는 중 고치는 칸** (이름 붙인 칸 객체 — `CODE_QUALITY.md` "렌더 중 곁일") — 그림(갱신 u)마다 그 장면 틱까지
 * 진행기를 돌리고 셈 · 소리 · 파티클 · 실책을 지난다. 키 줄은 키 사건이 채우고 그림이 먹인다. 한 번 만들어 useState 로 들고, 고치는 일은
 * 아래 `drawLiveRunnerFrame` 과 키 사건(`useSceneKeyEvents` — 키 줄에 담기만)만 한다
 */
export interface LiveRunnerPlaybackSlots {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u (`useGameSceneUpdateCounter` 가 적는다) */
  readonly updateStartTickRef: { current: number | null }
  /** 화면이 적는다 (`DefenseScreen.cameraOffsetRef`) */
  readonly cameraOffsetRef: { current: CameraOffset }
  /** 0x1c — 판이 끝난 뒤 돌발 창 아래 그림 (`burstWindowHoldOf`) */
  readonly burstHoldRef: { current: BurstWindowHold<LiveRunnerPlay> | null }
  keys: SceneKeyQueue
  bundle: LiveRunnerBundle | null
}

export function createLiveRunnerPlaybackSlots(): LiveRunnerPlaybackSlots {
  return {
    updateStartTickRef: { current: null },
    cameraOffsetRef: { current: null },
    burstHoldRef: { current: null },
    keys: newSceneKeyQueue(),
    bundle: null,
  }
}

/** 갱신 u 의 장면 틱 — 갱신 0 의 장면 틱을 아직 모르면 null */
export function runnerSceneTickOf(slots: LiveRunnerPlaybackSlots, update: number): number | null {
  const start = slots.updateStartTickRef.current
  return start === null ? null : start + update
}

/** 주자 판의 진행기 · 셈 — 판이 바뀌면 새로 열고 키 줄을 비운다 */
function liveRunnerBundleOf(slots: LiveRunnerPlaybackSlots, play: LiveRunnerPlay, update: number, redraws: number): LiveRunnerBundle {
  if (slots.bundle === null || slots.bundle.play !== play) {
    slots.bundle = {
      play,
      stepper: startLiveRunnerPlay(play),
      startedAt: update,
      tally: EMPTY_RECORDED_TALLY,
      errors: [],
      run: startBallParticleRun(),
      redrawn: redraws,
    }
    slots.keys = newSceneKeyQueue()
  }
  return slots.bundle
}

/** 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다 (`LivePlayback` 과 같은 상한은 진행기의 판 끝이 정한다) */
function stepLiveRunnerTo(slots: LiveRunnerPlaybackSlots, bundle: LiveRunnerBundle, update: number): void {
  const { stepper, startedAt } = bundle
  const wanted = Math.floor((update - startedAt) / UPDATES_PER_TICK) + 1
  let guard = 0
  while (!stepper.finished && stepper.tick < wanted && guard < MAX_CLOSED_CATCH_UP) {
    // 이 걸음은 갱신 (startedAt + 틱) — 그 장면 틱보다 앞 틱에 받은 키만 먹인다
    stepper.step(takeQueuedPress(slots.keys, runnerSceneTickOf(slots, startedAt + stepper.tick)))
    // 그 틱의 소리(슬라이딩 10 · 판정 콜)는 진행기가 그림에 실었다(`tickSoundIds`) — 아래 그림 셈이 그 그림을 지날 때 득점 함성과
    // 원본 차례로 함께 낸다(`playRunnerTickSounds`). 한 갱신 = 한 틱이라 같은 갱신 안이다
    guard += 1
  }
}

/** 판 동안은 그려진 틱까지, 닫힌 뒤로는 닫힌 갱신(+0x1094)을 한 번씩 지난다 — 셈 · 그 틱의 소리 · 공 그리기 파티클 · 야수 그리기 실책 */
function drawLiveRunnerUpdates(slots: LiveRunnerPlaybackSlots, bundle: LiveRunnerBundle, update: number, random: RandomPort | undefined): void {
  const { stepper, startedAt } = bundle
  const ticks = stepper.ticks
  const lastIndex = Math.max(0, ticks.length - 1)
  const seen = update - startedAt
  while (ticks.length > 0 && !bundle.tally.ended && bundle.tally.nextIndex <= seen) {
    const at = bundle.tally.nextIndex
    if (at > lastIndex && !stepper.finished) break
    const view = ticks[Math.min(at, lastIndex)]
    if (view === undefined) break
    passLiveRunnerUpdate(slots, bundle, { at, view, lastIndex }, random)
  }
}

/** 지날 갱신 하나 — 갱신 번호 · 그 갱신의 그림 · 마지막 판 틱 */
interface PlaybackUpdate {
  readonly at: number
  readonly view: DefenseViewState
  readonly lastIndex: number
}

function passLiveRunnerUpdate(
  slots: LiveRunnerPlaybackSlots,
  bundle: LiveRunnerBundle,
  { at, view, lastIndex }: PlaybackUpdate,
  random: RandomPort | undefined,
): void {
  // 주자 판(도루 · 폭투 · 견제)의 0x357e0 은 판이 열린 때 남은 [경기+0xfd4](`sceneResultCode`)를 본다 — 0x11 진입(3deea)이
  // 공마다 0 으로 지우고 스윙 판정(5130e)만 덮어, 도루 · 폭투는 이 공의 값(안 휘둘렀으면 0), 견제는 앞 공의 값이다
  const homeRunHit = isHomeRunHitCode(view.sceneResultCode)
  bundle.tally = stepRecordedBoard(bundle.tally, view, homeRunHit, at > lastIndex || view.closingListFrame === true)
  // 이 틱의 소리 — 사람 슬라이딩 키 · 판정 콜(9 → 0x51c14 의 17 · 13 → 0x51b36 의 62/20) → 득점 함성 → 자동 슬라이딩 10 (r310 A-33)
  playRunnerTickSounds(view, at <= lastIndex, bundle.tally, homeRunHit)
  // 0x35108 로 끝난 갱신은 안 그린다
  if (bundle.tally.ended) return
  // 그 갱신의 그리기 — 공 그리기 0x36dfc 의 튐 파티클 · 프레임 끝 파티클 틱(경기 난수 — 그 틱 진행기 굴림 뒤).
  // ⚠️ 판 틱을 미리 몇 틱 앞서 돌린 갱신(따라잡기)은 굴림 차례가 그 틱들 뒤로 몰린다(근사)
  if (random !== undefined)
    drawBallParticles(bundle.run, view, slots.cameraOffsetRef.current, random, runnerSceneTickOf(slots, bundle.startedAt + at))
  // 같은 그리기의 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e (판 틱만. ⚠️ 닫힌 갱신의 다시 그리기는 안 센다)
  if (at <= lastIndex) bundle.errors.push(...drawnFieldingErrorsOf(view.fielders))
}

interface LiveRunnerFrameInput {
  readonly play: LiveRunnerPlay
  readonly update: number
  readonly redraws: number
  readonly hasBurstWindow: boolean
}

interface LiveRunnerFrame {
  readonly bundle: LiveRunnerBundle
  readonly isFinished: boolean
  readonly burstHold: BurstWindowHold<LiveRunnerPlay> | null
}

/**
 * **주자 판 갈래 한 그림** — 진행기를 이 갱신까지 돌리고(`stepLiveRunnerTo`), 온 갱신을 지나고(`drawLiveRunnerUpdates`), 창이 선 첫
 * 그림이면 마지막 그림을 한 번 더(`redrawPlaybackPicture`), 끝났으면 0x1c 그림(`burstWindowHoldOf`)까지. 그리는 중에 칸을 고친다 —
 * 차례는 옛 그림 그대로다
 */
export function drawLiveRunnerFrame(slots: LiveRunnerPlaybackSlots, input: LiveRunnerFrameInput): LiveRunnerFrame {
  const { play, update, redraws } = input
  const bundle = liveRunnerBundleOf(slots, play, update, redraws)
  stepLiveRunnerTo(slots, bundle, update)
  const random = liveRunnerPlayRandomOf(play)
  drawLiveRunnerUpdates(slots, bundle, update, random)
  const ticks = bundle.stepper.ticks
  // 창이 선 첫 그림 — 마지막 그림을 한 번 더 (`redrawPlaybackPicture`)
  while (bundle.redrawn < redraws) {
    bundle.redrawn += 1
    redrawPlaybackPicture(
      bundle,
      ticks,
      (drawn) => isHomeRunHitCode(drawn.sceneResultCode),
      bundle.run,
      slots.cameraOffsetRef.current,
      random,
      bundle.errors,
    )
  }
  const isFinished = bundle.stepper.finished && bundle.tally.ended
  // 0x1c — 판이 끝난 뒤 돌발 창 아래 그림 (`burstWindowHoldOf`)
  const burstHold = burstWindowHoldOf(slots.burstHoldRef, play, isFinished && input.hasBurstWindow, bundle.run, update)
  if (isFinished && burstHold === null) clearBallParticles(bundle.run)
  if (burstHold !== null && random !== undefined) {
    const lastIndex = Math.max(0, ticks.length - 1)
    drawBurstWindowFrames(burstHold, bundle.run, ticks[lastIndex], slots.cameraOffsetRef.current, random, update, slots.updateStartTickRef.current)
  }
  return { bundle, isFinished, burstHold }
}
