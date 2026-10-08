import {
  initHomeRunFireworks,
  tickHomeRunFireworks,
  type FireworksParticlePort,
  type HomeRunFireworks,
} from '@/entities/batting/model/homeRunFireworks'
import {
  blockStateOf,
  clearParticles,
  emitParticles,
  tickParticles,
  type ParticleScene,
} from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { homeRunTextAfterDraws, type HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'

/**
 * ============================================================================
 * **타석 화면의 한 원본 프레임 — 홈런 효과 틱 → 파티클 틱** (0x52c50)
 * ============================================================================
 * 프레임 0x52c50 은 키 → 갱신(0x3f060 …) → 그리기(0x46c88 · 0x4a384 …) → **프레임 끝 0x53050 의 파티클 틱 0x6de84** 차례다.
 * 0x17 그리기 0x46c88 이 부르는 HOMERUN 글자 0x40b18 은 **유지 단계(+0x1961 ≥ 4)를 그린 그림에서만** 0x40faa 로 홈런 효과 틱
 * 0x901a0 을 부른다(entities/batting `homeRunFireworks`). 그래서 한 틱은
 * 1. (키 건너뛰기 0x519cc · 0x17 끝 0x35108 이 그 틱에 돌았으면) 효과 객체 칸을 버리고(0x8fc70) 파티클을 치운다(0x6dee4)
 * 2. 홈런 갈래(더비 0x527be · 일반 0x51d1e)가 그 틱 갱신에서 돌았으면 효과 객체를 종류 2 로 다시 깐다(0x90191(…, 2, 1) — 굴림 없음)
 * 3. 글자를 그리고, 그 그림이 유지 단계면 효과 틱(칸 0..6 — 파티클을 쏘고 굴린다)
 * 4. 파티클 틱
 *
 * 글자 창(`HomeRunTextWindow`)은 그 판의 갱신을 아는 쪽이 넘긴다: 첫 그림 = 홈런 틱, 다시 켜는 그림(`restartDraws`) = 같은 판의 둘째 홈런
 * 갈래(그 틱에 효과 객체도 다시 깐다), 끝 = 관문이 닫힌 틱 · 키 건너뛰기.
 */
export interface StageEffects {
  /** 효과 객체가 속한 글자 창 — 창이 바뀌면 새 홈런이다 */
  readonly window: HomeRunTextWindow | null
  /** 그 창에서 마지막으로 처리한 그림 차례(1 부터, 0 = 아직) */
  readonly lastDraw: number
  /** 효과 객체 [0x1400064] 종류 2 의 칸 — 칸 버퍼를 버렸거나(0x8fc70) 아직 안 깔았으면 null */
  readonly fireworks: HomeRunFireworks<number> | null
  /** 마지막으로 처리한 치우기 시각(`effectsClearedAt`) */
  readonly clearedAt: number | null
}

export const NO_STAGE_EFFECTS: StageEffects = { window: null, lastDraw: 0, fireworks: null, clearedAt: null }

export interface StageFrameInput {
  /** 이 틱 프레임의 시각 (ms) */
  readonly time: number
  readonly millisecondsPerTick: number
  /** 지금 넘겨받은 글자 창 (없으면 null) */
  readonly window: HomeRunTextWindow | null
  /** 0x519cc · 0x35108 이 돈 시각 — 이 시각 이후 첫 틱에서 치운다 */
  readonly effectsClearedAt: number | null
  readonly particles: ParticleScene
  readonly random: RandomPort
  /** 0xbbc84 의 id → 설정 (`ptc/(id+1).ptc`) */
  readonly configOf: (id: number) => ParticleConfig | null
}

/** 효과 객체가 파티클 장면에 닿는 자리 — 이미터 자리는 블록 번호다 (`emitParticles` · `blockStateOf`) */
export function fireworksPortOf(
  particles: ParticleScene,
  configOf: (id: number) => ParticleConfig | null,
): FireworksParticlePort<number> {
  return {
    emit: (id, x, y, image) => emitParticles(particles, configOf(id), x, y, image),
    isFinished: (block) => blockStateOf(particles, block) === 3,
  }
}

/** 원본 한 틱 프레임 (머리말 1~4) */
export function stepStageFrame(effects: StageEffects, input: StageFrameInput): StageEffects {
  let { window, lastDraw, fireworks, clearedAt } = effects

  // 1. 키 건너뛰기 0x519cc(0x8fc70 · 0x6dee4) · 0x17 끝 0x35108(0x6dee4)
  if (input.effectsClearedAt !== null && input.effectsClearedAt !== clearedAt && input.time >= input.effectsClearedAt) {
    clearedAt = input.effectsClearedAt
    fireworks = null
    clearParticles(input.particles)
  }

  // 첫 그림 시각이 다른 창이면 새 홈런 — 효과 객체는 그 창의 첫 그림에서 다시 깐다.
  // 같은 홈런의 창을 끝만 바꿔 다시 넘긴 것(키 건너뛰기)은 센 그림을 잇는다
  if (input.window?.startedAt !== window?.startedAt) lastDraw = 0
  window = input.window

  const draw = drawIndexAt(window, input.time, input.millisecondsPerTick)
  if (window !== null && draw > lastDraw) {
    const restarts = window.restartDraws ?? []
    // 2. 이 그림 앞의 갱신이 홈런 갈래를 지났다(첫 그림 · 둘째 홈런 갈래) — 0x90191(…, 2, 1)
    for (let passed = lastDraw + 1; passed <= draw; passed += 1) {
      if (passed === 1 || restarts.includes(passed)) fireworks = initHomeRunFireworks<number>()
    }
    // 3. 이 그림이 유지 단계면 0x40faa 의 효과 틱
    const before = homeRunTextAfterDraws(window.on, draw - 1, restarts).state
    const restartsNow = restarts.includes(draw)
    const isHold = !restartsNow && before.stage >= 4
    if (isHold && fireworks !== null) {
      fireworks = tickHomeRunFireworks(fireworks, fireworksPortOf(input.particles, input.configOf), input.random)
    }
    lastDraw = draw
  }

  // 4. 프레임 끝 0x6de84
  tickParticles(input.particles, input.random)
  return { window, lastDraw, fireworks, clearedAt }
}

/** 시각 `time` 의 그림 차례(1 부터) — 창 밖이면 0 */
function drawIndexAt(window: HomeRunTextWindow | null, time: number, millisecondsPerTick: number): number {
  if (window === null || time < window.startedAt) return 0
  if (window.endsAt !== null && time >= window.endsAt) return 0
  return Math.floor((time - window.startedAt) / millisecondsPerTick) + 1
}
