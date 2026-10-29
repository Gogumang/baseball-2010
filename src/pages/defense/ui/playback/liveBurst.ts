import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { DefensePlayInput, DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import { stepDefenseEffects } from '@/pages/defense/lib/defenseHomeRunEffects'
import { ballShotsAt } from '@/pages/defense/ui/playback/ballParticleRun'
import type { LivePlaybackSlots, LiveScreenSetters } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { lastViewOf } from '@/pages/defense/ui/playback/liveTicks'
import { MAX_CLOSED_CATCH_UP } from '@/pages/defense/ui/playback/playbackClock'
import { appTickOfGameSceneTick, isCommonWindowShown } from '@/shared/lib/commonWindow/commonWindow'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'

interface BurstContext {
  readonly update: number
  readonly holdsUnderBurst: boolean
  readonly input: DefensePlayInput
  readonly particles: ParticleScene
}

/**
 * 0x1c 그림들 — 갱신 0x3afd4(창 0x8e5b8)는 판을 안 건드리고 그리기 0x46ee0 → 0x46c88 만 돈다: 마지막 판 그림의 공 0x36dfc 가 파티클을
 * 다시 쏘고 프레임 끝 0x6de85 가 굴린다(경기 난수 — 창은 공용 창이 아니라 53048 이 안 닫힌다). 글자 +0x1960 · 점수판 타이머는 0x35108 이
 * 내려 아무것도 안 그린다. ⚠️ 결과 판 · 레이저 · B · C 는 닫힌 뒤 그림처럼 안 넘긴다(`burstWindow` 머리말)
 */
export function drawLiveBurstFrames(slots: LivePlaybackSlots, ctx: BurstContext, ui: Pick<LiveScreenSetters, 'setEffectsView'>): void {
  const state = slots.state
  if (!ctx.holdsUnderBurst || state === null) return
  const frames = burstFramesOf(slots, ctx)
  if (frames <= 0) return
  const startTick = slots.updateStartTickRef.current
  for (let index = 0; index < frames; index += 1) {
    const sceneTick = startTick === null ? null : startTick + ctx.update - (frames - 1 - index)
    drawBurstFrame(slots, ctx, state, sceneTick)
  }
  ui.setEffectsView((previous) => ({ text: null, distanceBoard: null, version: previous.version + 1 }))
}

/** 이 판의 첫 0x1c 그림이면 칸만 세우고 0, 아니면 지난 갱신부터 따라잡을 그림 수 */
function burstFramesOf(slots: LivePlaybackSlots, ctx: BurstContext): number {
  const hold = slots.burstHold
  if (hold === null || hold.key !== ctx.input) {
    slots.burstHold = { key: ctx.input, lastUpdate: ctx.update }
    return 0
  }
  const frames = Math.min(ctx.update - hold.lastUpdate, MAX_CLOSED_CATCH_UP)
  hold.lastUpdate = ctx.update
  return frames
}

/** 0x1c 그림 하나 — 공 파티클 다시 쏘기 · 프레임 끝 파티클 틱 */
function drawBurstFrame(slots: LivePlaybackSlots, ctx: BurstContext, state: DefensePlayState, sceneTick: number | null): void {
  slots.effects = stepDefenseEffects(
    slots.effects,
    null,
    {
      particles: ctx.particles,
      random: isCommonWindowShown() ? undefined : ctx.input.random,
      configOf: particleConfigOf,
      ...(sceneTick === null ? {} : { appTick: appTickOfGameSceneTick(sceneTick) }),
    },
    ballShotsAt(lastViewOf(state), slots.cameraOffsetRef.current),
  ).effects
}
