import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { runInCheerSoundIdOf, deepLandingCheerSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { isDefensePlayFinished, stepDefensePlay, type DefensePlayState, type DefenseTickSound } from '@/features/defense-play/model/runDefensePlay'
import {
  defenseTickFactsOf,
  fastForwardDefenseEffects,
  stepDefenseEffects,
  tickBeforeOf,
  updateDefenseEffectsWithoutDraw,
  type DefenseEffectsFrame,
  type DefenseEffectsPorts,
  type DefenseTickFacts,
} from '@/pages/defense/lib/defenseHomeRunEffects'
import { runScoreBoardRunIn } from '@/pages/defense/lib/runScoreBoard'
import { ballShotsAt } from '@/pages/defense/ui/playback/ballParticleRun'
import { takeQueuedPress } from '@/pages/defense/ui/playback/keyQueue'
import { drawLiveBoard } from '@/pages/defense/ui/playback/liveBoard'
import { countDrawnLiveTicks } from '@/pages/defense/ui/playback/liveDrawnTicks'
import type { LiveContext, LivePlaybackSlots, RunScoreBoardView } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { activeSound } from '@/shared/api/audio/soundPort'
import { appTickOfGameSceneTick } from '@/shared/lib/commonWindow/commonWindow'

/** 한 갱신이 모은 것 — 진행기 · 점수판 · 연출 그림 · 키 건너뛰기 · 마지막 판 그림의 글자 관문 */
export interface LiveFrame {
  running: DefensePlayState
  moved: boolean
  board: RunScoreBoardView | null | undefined
  effectsFrame: DefenseEffectsFrame | null
  skippedNow: boolean
  /** 이 갱신이 마지막으로 그린 판 틱 그림의 HOMERUN 글자 관문 (창 첫 그림이 같은 관문으로 다시 그린다) */
  lastDrawsText: boolean
}

/** 마지막 판 그림 */
export function lastViewOf(running: DefensePlayState): DefenseViewState | undefined {
  return running.ticks[running.ticks.length - 1]
}

/** 장면 틱 하나의 연출 포트 — 앱 틱을 알면 싣는다 */
export function portsAt(ports: DefenseEffectsPorts, sceneTick: number | null): DefenseEffectsPorts {
  return sceneTick === null ? ports : { ...ports, appTick: appTickOfGameSceneTick(sceneTick) }
}

/**
 * 한 갱신 = 한 틱. 프레임을 건너뛴 만큼은 따라잡는다.
 * 키 건너뛰기(+0xfe7)가 서면 52b26~52b40 이 한 그림 안에서 판 끝까지 되풀이한다 — 따라잡을 틱 수와 상관없이 끝까지 돈다
 */
export function stepLiveTicks(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, wanted: number, ports: DefenseEffectsPorts): void {
  while ((frame.running.tick < wanted || frame.running.fastForward) && !isDefensePlayFinished(frame.running)) {
    stepLiveTick(slots, ctx, frame, ports)
  }
}

function stepLiveTick(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, ports: DefenseEffectsPorts): void {
  const tickBefore = tickBeforeOf(frame.running)
  const wasFastForward = frame.running.fastForward
  // 건너뛰는 동안은 그 그림의 키 처리(0x498d4)가 다시 오지 않는다
  // 이 걸음은 갱신 (startedAt + 틱) — 그 장면 틱보다 앞 틱에 받은 키만 먹인다
  const updateStartTick = slots.updateStartTickRef.current
  const stepSceneTick = updateStartTick === null ? null : updateStartTick + slots.startedAt + frame.running.tick
  const running = stepDefensePlay(frame.running, wasFastForward ? null : takeQueuedPress(slots.keys, stepSceneTick))
  frame.running = running
  frame.moved = true
  const facts = defenseTickFactsOf(tickBefore, running, isDefensePlayFinished(running))
  if (running.fastForward && !wasFastForward) {
    // 0x519cc 는 이 틱 갱신보다 먼저 — 소리 끊기(0x519fe 0x6e418) · 글자 끄기 · 효과 칸 버리기 · 파티클 치우기 ·
    // 홈런 점수판 [+0x1100] = 0. 이 틱에 나는 소리(펌블 · 슬라이딩)는 끊은 뒤에 난다
    startLiveFastForward(slots, ctx)
  }
  // 득점 점수판 — 이 틱의 메시지 0x13 들(0x51fb8). 0x357e0 && +0xfe7 == 0 이면 홈런 갈래.
  for (const slot of running.runInsThisTick) {
    slots.board = runScoreBoardRunIn(slots.board, slot, ctx.homeRunHit, running.fastForward)
  }
  playLiveTickSounds(running, ctx.homeRunHit)
  if (running.fastForward) {
    // 건너뛰는 동안은 그리기 · 프레임 끝 파티클 틱이 없다 — 갱신 쪽(글자 켜기 · +0x36)만
    slots.effects = updateDefenseEffectsWithoutDraw(slots.effects, facts)
    frame.skippedNow = true
  } else {
    drawLiveTick(slots, ctx, frame, facts, portsAt(ports, stepSceneTick))
  }
  countDrawnLiveTicks(slots, running)
}

/** 0x519fe — 소리 끊기(0x6e418) · 글자 끄기 · 효과 칸 버리기 · 파티클 치우기 · 홈런 점수판 [+0x1100] = 0 */
export function startLiveFastForward(slots: LivePlaybackSlots, ctx: LiveContext): void {
  activeSound().stop()
  slots.effects = fastForwardDefenseEffects(slots.effects, ctx.particles)
  slots.board = { ...slots.board, active: false }
}

/** 홈런 연출 — 이 틱의 갱신 · 그리기 · 프레임 끝 파티클 틱 (진행기 굴림 뒤) */
function drawLiveTick(slots: LivePlaybackSlots, ctx: LiveContext, frame: LiveFrame, facts: DefenseTickFacts, ports: DefenseEffectsPorts): void {
  const drawn = stepDefenseEffects(slots.effects, facts, ports, ballShotsAt(lastViewOf(frame.running), slots.cameraOffsetRef.current))
  frame.effectsFrame = drawn
  slots.effects = drawn.effects
  frame.lastDrawsText = facts.drawsText
  // 득점 점수판 0x41a64 (그리기 0x46e62). 한 갱신에 여러 틱을 따라잡으면 마지막 틱 모습만 보인다
  frame.board = drawLiveBoard(slots, ctx, frame.running.held.scoreboardRuns)
}

/**
 * 이 틱의 소리 — 진행기가 원본 차례로 적은 그대로 낸다(`DefensePlayState.tickSounds`):
 * OK 슬라이딩 10(키 처리 0x5199c) → 머리 카메라 3f17e 의 메시지 0x13 함성 → 판정 콜(b4562 메시지 0xbba → 0x51a56 → 표 0xd0488:
 * 7 → 25 · 8/12 → 11 · 9 → 17 · 11 → 62 · 13 → 62/20) → 53(b4588 → 0xa1e60) → 득점 0xaa0a8 의 메시지 0x13 함성 → 자동 슬라이딩 10
 * (0x5268c) → (건너뛰는 동안) 52b26 카메라 함성 → 깊은 낙구 함성 60(52b62). 0xbfbac 는 큐가 아니라 받는 곳(경기 장면 0x509a0)을
 * 곧바로 부르므로 메시지 0x13 · 0xbba 의 소리는 보낸 그 자리다. 0x51fb8 머리의 함성은 홈런성(0x357e0)이 아니면 60, 홈런성이면 주자
 * 칸 0 일 때만 30 (+0xfe7 은 안 본다). 예약 0x6e498(10 · 함성)도 울리던 소리를 끊는 한 칸이라 통로 하나 `play` 와 같다.
 * ⚠️ 0x519cc 의 소리 끊기(위)는 원본에서 키 처리의 0x585(슬라이딩) 뒤 0x587 이라 같은 틱의 OK 슬라이딩 10 도 끊지만, 웹은 끊은 뒤에 낸다
 */
function playLiveTickSounds(running: DefensePlayState, homeRunHit: boolean): void {
  for (const sound of running.tickSounds) {
    const soundId = tickSoundIdOf(sound, homeRunHit)
    if (soundId !== null) activeSound().play(soundId)
  }
}

function tickSoundIdOf(sound: DefenseTickSound, homeRunHit: boolean): number | null {
  switch (sound.kind) {
    case 'sound':
      return sound.soundId
    case 'runIn':
      return runInCheerSoundIdOf(sound.slot, homeRunHit)
    default:
      return deepLandingCheerSoundIdOf(homeRunHit)
  }
}
