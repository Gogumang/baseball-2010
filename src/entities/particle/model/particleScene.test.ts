import { describe, expect, it } from 'vitest'
import {
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
