import { describe, expect, it } from 'vitest'
import {
  blockStateOf,
  clearParticles,
  createParticleScene,
  emitParticles,
  MAX_EMITTERS,
  tickParticles,
} from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 한 번에 한 알만 뿌리고 금방 끝나는 설정 */
const 한알: ParticleConfig = {
  ang: 0,
  spread: 0,
  spd: 0,
  spdR: 0,
  emit: 1,
  emitR: 0,
  life: 1,
  lifeR: 0,
  a0: 65536,
  a0R: 0,
  a1: 0,
  a1R: 0,
  ax: 0,
  ay: 0,
  w: 0,
  h: 0,
  total: 1,
  mode: 2,
}

describe('파티클 관리자', () => {
  it('설정이 없으면 아무것도 쏘지 않는다', () => {
    const scene = createParticleScene()
    emitParticles(scene, null, 10, 20, 10)
    expect(scene.emitters.length).toBe(0)
  })

  it('이미터 64개가 차면 새 요청을 무시한다 (0x6df5c)', () => {
    const scene = createParticleScene()
    for (let index = 0; index < MAX_EMITTERS + 5; index += 1) emitParticles(scene, 한알, 0, 0, 10)
    expect(scene.emitters.length).toBe(MAX_EMITTERS)
  })

  it('끝난 이미터는 목록에서 빠진다', () => {
    const scene = createParticleScene()
    const random = createSeededRandom(3)
    emitParticles(scene, 한알, 5, 6, 10)
    for (let tick = 0; tick < 5; tick += 1) tickParticles(scene, random)
    expect(scene.emitters.length).toBe(0)
  })

  it('치우면 목록이 빈다', () => {
    const scene = createParticleScene()
    emitParticles(scene, 한알, 0, 0, 10)
    clearParticles(scene)
    expect(scene.emitters.length).toBe(0)
  })
})

describe('이미터 블록 — 자체 힙 등급 3 의 가장 낮은 빈 자리 · 지운 뒤에도 남는 +0x58', () => {
  it('지운 이미터의 블록은 마지막 상태(3)를 남기고, 다음 이미터가 가장 낮은 빈 블록을 받는다', () => {
    const scene = createParticleScene()
    const random = createSeededRandom(5)
    const 오래 = { ...한알, life: 30 }
    const 첫 = emitParticles(scene, 한알, 0, 0, 10)
    const 둘 = emitParticles(scene, 오래, 0, 0, 10)
    expect([첫, 둘]).toEqual([0, 1])
    for (let tick = 0; tick < 5; tick += 1) tickParticles(scene, random)
    // 한알은 끝나 지워졌다 — 자리 0 은 비었지만 +0x58 = 3 이 남는다
    expect(scene.emitters.length).toBe(1)
    expect(blockStateOf(scene, 0)).toBe(3)
    // 새 이미터는 자리 0 을 받고(0 채움 → 0), 그 자리를 읽는 쪽은 새 이미터의 상태를 본다
    expect(emitParticles(scene, 한알, 0, 0, 10)).toBe(0)
    expect(blockStateOf(scene, 0)).toBe(0)
    tickParticles(scene, random)
    expect(blockStateOf(scene, 0)).toBe(1)
  })

  it('치우기(0x6dee4)도 블록에 마지막 상태를 남긴다 — 끝나기 전에 지운 이미터는 1 · 2 그대로', () => {
    const scene = createParticleScene()
    const random = createSeededRandom(5)
    emitParticles(scene, { ...한알, life: 30, total: 5 }, 0, 0, 10)
    tickParticles(scene, random)
    clearParticles(scene)
    expect(blockStateOf(scene, 0)).toBe(1)
    expect(scene.pool.free).toBe(512)
  })

  it('입자는 관리자 하나의 풀 512 를 나눠 쓴다', () => {
    const scene = createParticleScene()
    const random = createSeededRandom(5)
    const 많이 = { ...한알, emit: 300, total: 300, life: 30 }
    emitParticles(scene, 많이, 0, 0, 10)
    emitParticles(scene, 많이, 0, 0, 10)
    tickParticles(scene, random)
    expect(scene.emitters.map((emitter) => emitter.particles.length)).toEqual([300, 212])
    expect(scene.emitters.map((emitter) => emitter.state)).toEqual([1, 2])
    expect(scene.pool.free).toBe(0)
  })
})

