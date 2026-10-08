import { describe, expect, it } from 'vitest'
import { createParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { FIREWORK_PARTICLES } from '@/entities/batting/model/homeRunFireworks'
import {
  derbyHomeRunTextOn,
  HOME_RUN_TEXT_SCENE_START,
  type HomeRunTextWindow,
} from '@/widgets/batting-stage/lib/homeRunBanner'
import { NO_STAGE_EFFECTS, stepStageFrame, type StageEffects } from '@/widgets/batting-stage/lib/homeRunEffects'

const 설정: ParticleConfig = {
  ang: 0, spread: 0, spd: 0, spdR: 0, emit: 1, emitR: 0, life: 3, lifeR: 0,
  a0: 0, a0R: 0, a1: 0, a1R: 0, ax: 0, ay: 0, w: 0, h: 0, total: 1, mode: 2,
}

function 세는난수(): RandomPort & { calls: number } {
  const random = {
    calls: 0,
    next: () => {
      random.calls += 1
      return 0
    },
    nextInRange: (minimum: number) => minimum,
    pick: <T,>(candidates: readonly T[]) => candidates[0],
  }
  return random
}

const 틱 = 10

/** 더비 칸(장면 new 의 0 · 단계 0)으로 켠 창 — 단계 0 두 그림 · 1·2·3 두 그림씩 → 9 번째 그림부터 유지 */
const 더비창: HomeRunTextWindow = { startedAt: 100, endsAt: null, on: derbyHomeRunTextOn(HOME_RUN_TEXT_SCENE_START) }

function 돌리기(틱수: number, window: HomeRunTextWindow | null, clearedAt: number | null = null) {
  const particles = createParticleScene()
  const random = 세는난수()
  const emitted: number[] = []
  let effects: StageEffects = NO_STAGE_EFFECTS
  const frames: { readonly time: number; readonly emitters: number; readonly calls: number }[] = []
  for (let tick = 0; tick < 틱수; tick += 1) {
    const time = 100 + tick * 틱
    effects = stepStageFrame(effects, {
      time,
      millisecondsPerTick: 틱,
      window,
      effectsClearedAt: clearedAt,
      particles,
      random,
      configOf: (id) => {
        emitted.push(id)
        return 설정
      },
    })
    frames.push({ time, emitters: particles.emitters.length, calls: random.calls })
  }
  return { effects, frames, emitted, particles }
}

describe('타석 화면 한 틱 — 홈런 효과 틱 0x40faa 는 글자 유지 단계를 그린 그림에서만', () => {
  it('더비 칸으로 켠 글자는 9 번째 그림에서 처음 효과 틱을 돌아 칸 0 이 오름 불꽃(16)을 쏜다', () => {
    const { frames, emitted, effects } = 돌리기(9, 더비창)
    // 8 번째 그림까지는 효과 틱이 없다 — 쏜 것도 굴림도 없다
    expect(frames[7]).toMatchObject({ emitters: 0, calls: 0 })
    // 9 번째 그림: 칸 0 은 기다림 0 → 오름 16 (굴림 없음), 그리고 파티클 틱이 그 이미터를 처음 굴린다(발생 수 1 + 알 8)
    expect(emitted).toEqual([FIREWORK_PARTICLES.rise])
    expect(frames[8]).toMatchObject({ emitters: 1, calls: 9 })
    expect(effects.fireworks?.slots[0].state).toBe(2)
  })

  it('창이 없으면 효과 객체도 없고 파티클만 돈다', () => {
    const { effects, emitted } = 돌리기(40, null)
    expect(effects.fireworks).toBeNull()
    expect(emitted).toEqual([])
  })

  it('치운 시각(0x519cc · 0x35108) 뒤 첫 틱 머리에서 효과 객체를 버리고 파티클을 비운다', () => {
    const 끝 = 100 + 11 * 틱
    const { effects, frames } = 돌리기(14, { ...더비창, endsAt: 끝 }, 끝)
    expect(frames[10].emitters).toBeGreaterThan(0)
    expect(frames[11].emitters).toBe(0)
    expect(effects.fireworks).toBeNull()
  })

  it('같은 홈런의 창을 끝만 바꿔 다시 넘겨도(키 건너뛰기) 센 그림을 잇는다 — 효과 객체를 다시 깔지 않는다', () => {
    const particles = createParticleScene()
    const random = 세는난수()
    let effects: StageEffects = NO_STAGE_EFFECTS
    const input = (time: number, window: HomeRunTextWindow) => ({
      time,
      millisecondsPerTick: 틱,
      window,
      effectsClearedAt: null,
      particles,
      random,
      configOf: () => 설정,
    })
    for (let tick = 0; tick < 12; tick += 1) effects = stepStageFrame(effects, input(100 + tick * 틱, 더비창))
    const 칸 = effects.fireworks
    effects = stepStageFrame(effects, input(100 + 12 * 틱, { ...더비창, endsAt: 100 + 14 * 틱 }))
    expect(effects.lastDraw).toBe(13)
    expect(effects.fireworks).not.toBe(null)
    expect(effects.fireworks?.slots[0].state).not.toBe(1)
    expect(칸).not.toBeNull()
  })
})
