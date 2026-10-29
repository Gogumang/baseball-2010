import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { drawnFieldingErrorsOf, type DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { clearBallParticles, drawBallParticles, startBallParticleRun, type BallParticleRun } from '@/pages/defense/ui/playback/ballParticleRun'
import { burstWindowHoldOf, drawBurstWindowFrames, type BurstWindowHold } from '@/pages/defense/ui/playback/burstWindowHold'
import type { CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import { EMPTY_RECORDED_TALLY, stepRecordedBoard, type RecordedBoardTally } from '@/pages/defense/ui/playback/recordedBoardTally'
import { redrawPlaybackPicture } from '@/pages/defense/ui/playback/redrawPlaybackPicture'
import { playRunnerTickSounds } from '@/pages/defense/ui/playback/runnerTickSounds'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 미리 돌린 재생 갈래의 파티클 굴림 — ⚠️ 근사(남김 — 원본에 없는 길만): 원본은 경기 난수로 판 틱 굴림 사이사이에 굴리지만, 이 갈래의 판은
 * 이미 다 돌았고 경기 흐름도 그 뒤 굴림을 먼저 써 버렸다. 경기 난수를 건드리지 않게 그림 전용 난수로 굴린다.
 * 실제 경기에서 이 갈래로 오는 판은 밀어내기(종류 2)뿐이다 — 도루 · 폭투 · 견제는 화면이 실시간 갈래(`LiveRunnerPlayback`, 경기 난수)로
 * 돌리고, 밀어내기는 쫓는 공이 없어(`runnerPlayEngine` chase = null — 포수가 쥔 채, CPU 송구 0xafa60 도 afa90 에서 안 고른다) 공 그리기
 * 0x36dfc 가 파티클을 안 쏘고 홈런 연출도 없어 이 난수를 한 번도 안 굴린다(원본도 굴림 0). 굴릴 수 있는 것은 패턴 없이 온 홈런 재생 · 화면 없이
 * 미리 돈 판(시험 · 옛 호출 — 원본에 없는 길)뿐인데, 전체 시험(화면 시험 · soak 포함)을 계측해도 이 난수는 한 번도 안 굴렸다(r276).
 * 이 갈래에는 경기 난수가 실려 오지 않아 원본 꼴(경기 난수)로 바꿀 수 없고, 굴림 수가 원본과 같은 0 이라 그대로 둔다
 */
const RECORDED_PARTICLE_SEED = 0x36dfc

/** 재생 묶음 하나의 셈 — 묶음이 바뀌면 처음부터 */
interface RecordedBundle {
  readonly ticks: readonly DefenseViewState[]
  /** 셈 — 갱신을 한 번씩만 지난다 */
  tally: RecordedBoardTally
  /** 그린 틱이 올린 실책 (0x43278) */
  readonly errors: DrawnFieldingError[]
  readonly run: BallParticleRun
  readonly random: RandomPort
  /** 창이 선 첫 그림([창+0x250]) 가운데 다시 그린 수 */
  redrawn: number
}

/**
 * **재생 갈래가 그리는 중 고치는 칸** (이름 붙인 칸 객체 — `CODE_QUALITY.md` "렌더 중 곁일") — 원본은 갱신마다 셈 · 소리 · 파티클 ·
 * 실책을 그 자리에서 지난다. 웹은 갱신 계수가 오른 그림에서 지나야 같은 그림의 점수판 · 파티클이 그 갱신의 값을 본다. 한 번 만들어
 * useState 로 들고, 고치는 일은 아래 `drawRecordedFrame` 만 한다
 */
export interface RecordedPlaybackSlots {
  /** 갱신 0 이 든 장면 틱 — 갱신 u 의 장면 틱은 이 값 + u (`useGameSceneUpdateCounter` 가 적는다) */
  readonly updateStartTickRef: { current: number | null }
  /** 화면이 적는다 (`DefenseScreen.cameraOffsetRef`) */
  readonly cameraOffsetRef: { current: CameraOffset }
  /** 0x1c — 판이 끝난 뒤 돌발 창 아래 그림 (`burstWindowHoldOf`) */
  readonly burstHoldRef: { current: BurstWindowHold<readonly DefenseViewState[]> | null }
  bundle: RecordedBundle | null
}

export function createRecordedPlaybackSlots(): RecordedPlaybackSlots {
  return { updateStartTickRef: { current: null }, cameraOffsetRef: { current: null }, burstHoldRef: { current: null }, bundle: null }
}

/** 재생 묶음의 셈 — 묶음이 바뀌면 비운다(파티클 · 그림 전용 난수도 새로) */
function recordedBundleOf(slots: RecordedPlaybackSlots, ticks: readonly DefenseViewState[], redraws: number): RecordedBundle {
  if (slots.bundle === null || slots.bundle.ticks !== ticks) {
    slots.bundle = {
      ticks,
      tally: EMPTY_RECORDED_TALLY,
      errors: [],
      run: startBallParticleRun(),
      random: createSeededRandom(RECORDED_PARTICLE_SEED),
      redrawn: redraws,
    }
  }
  return slots.bundle
}

/** 이 그림까지 온 재생 갱신을 한 번씩 지난다 — 셈 · 그 틱의 소리 · 공 그리기 파티클 · 야수 그리기 실책 */
function drawRecordedUpdates(slots: RecordedPlaybackSlots, bundle: RecordedBundle, update: number, isHomeRun: boolean): void {
  const { ticks } = bundle
  const lastIndex = Math.max(0, ticks.length - 1)
  while (ticks.length > 0 && !bundle.tally.ended && bundle.tally.nextIndex <= update) {
    const at = bundle.tally.nextIndex
    const view = ticks[Math.min(at, lastIndex)]
    if (view === undefined) break
    passRecordedUpdate(slots, bundle, { at, view, lastIndex }, isHomeRun)
  }
}

/** 지날 갱신 하나 — 갱신 번호 · 그 갱신의 그림 · 마지막 판 틱 */
interface PlaybackUpdate {
  readonly at: number
  readonly view: DefenseViewState
  readonly lastIndex: number
}

function passRecordedUpdate(slots: RecordedPlaybackSlots, bundle: RecordedBundle, { at, view, lastIndex }: PlaybackUpdate, isHomeRun: boolean): void {
  // G2 만 닫힌 그림(`closingListFrame`)은 그려지지만 슬롯 2 는 529f0 — 닫힌 셈(+0x1094)의 첫 갱신이다
  bundle.tally = stepRecordedBoard(bundle.tally, view, isHomeRun, at > lastIndex || view.closingListFrame === true)
  // 미리 돌린 주자 판이 그 틱에 낸 소리 — 판정 콜(플레이 틱 b4562 의 메시지 0xbba → 0x51a56: 9 → 17 · 13 → 62/20)과 자동 슬라이딩
  // 10(0x5268c). 원본은 판을 연 자리가 아니라 결과 코드가 선 그 틱에 낸다 — 진행기가 그림에 실은 차례(`tickSoundIds`) 그대로이고,
  // 득점 함성은 득점 0xaa0a8(525fc)의 자리 — 판정 콜 뒤 · 자동 슬라이딩(52670) 앞 — 에 낀다(`playRunnerTickSounds`, r310 A-33)
  playRunnerTickSounds(view, at <= lastIndex, bundle.tally, isHomeRun)
  // 0x35108 로 끝난 갱신은 안 그린다
  if (bundle.tally.ended) return
  // 그 갱신의 그리기 — 공 그리기 0x36dfc 의 파티클 · 프레임 끝 파티클 틱
  const recordedStartTick = slots.updateStartTickRef.current
  drawBallParticles(bundle.run, view, slots.cameraOffsetRef.current, bundle.random, recordedStartTick === null ? null : recordedStartTick + at)
  // 같은 그리기의 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e (판 틱만. ⚠️ 닫힌 갱신의 다시 그리기는 안 센다)
  if (at <= lastIndex) bundle.errors.push(...drawnFieldingErrorsOf(view.fielders))
}

/** 0x519cc 키 건너뛰기 — 받은 틱보다 뒤 틱의 갱신이 왔는가(갱신 u 의 장면 틱은 갱신 0 의 장면 틱 + u) */
function isSkippedByKey(
  slots: RecordedPlaybackSlots,
  skipTick: RecordedSkipTick | null,
  ticks: readonly DefenseViewState[],
  update: number,
): boolean {
  const recordedUpdateStart = slots.updateStartTickRef.current
  return skipTick !== null && skipTick.ticks === ticks && recordedUpdateStart !== null && recordedUpdateStart + update > skipTick.at
}

export interface RecordedSkipTick {
  readonly ticks: readonly DefenseViewState[]
  readonly at: number
}

interface RecordedFrameInput {
  readonly ticks: readonly DefenseViewState[]
  readonly update: number
  readonly redraws: number
  readonly isHomeRun: boolean
  readonly skipTick: RecordedSkipTick | null
  readonly hasBurstWindow: boolean
}

interface RecordedFrame {
  readonly bundle: RecordedBundle
  readonly isFinished: boolean
  readonly burstHold: BurstWindowHold<readonly DefenseViewState[]> | null
}

/**
 * **재생 갈래 한 그림** — 온 갱신을 지나고(`drawRecordedUpdates`), 창이 선 첫 그림이면 마지막 그림을 한 번 더(`redrawPlaybackPicture`),
 * 끝났으면 0x1c 그림(`burstWindowHoldOf`)까지. 그리는 중에 칸을 고친다 — 차례는 옛 그림 그대로다
 */
export function drawRecordedFrame(slots: RecordedPlaybackSlots, input: RecordedFrameInput): RecordedFrame {
  const { ticks, update, redraws, isHomeRun } = input
  const bundle = recordedBundleOf(slots, ticks, redraws)
  drawRecordedUpdates(slots, bundle, update, isHomeRun)
  // 창이 선 첫 그림 — 마지막 그림을 한 번 더 (`redrawPlaybackPicture`)
  while (bundle.redrawn < redraws) {
    bundle.redrawn += 1
    redrawPlaybackPicture(bundle, ticks, () => isHomeRun, bundle.run, slots.cameraOffsetRef.current, bundle.random, bundle.errors)
  }
  const isFinished = ticks.length === 0 || bundle.tally.ended || isSkippedByKey(slots, input.skipTick, ticks, update)
  // 0x1c — 판이 끝난 뒤 돌발 창 아래 그림 (`burstWindowHoldOf`)
  const burstHold = burstWindowHoldOf(slots.burstHoldRef, ticks, isFinished && input.hasBurstWindow, bundle.run, update)
  if (isFinished && burstHold === null) clearBallParticles(bundle.run)
  if (burstHold !== null) {
    const lastIndex = Math.max(0, ticks.length - 1)
    drawBurstWindowFrames(
      burstHold,
      bundle.run,
      ticks[lastIndex],
      slots.cameraOffsetRef.current,
      bundle.random,
      update,
      slots.updateStartTickRef.current,
    )
  }
  return { bundle, isFinished, burstHold }
}
