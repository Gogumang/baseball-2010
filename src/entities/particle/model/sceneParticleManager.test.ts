import { afterEach, describe, expect, it } from 'vitest'
import { emitParticles } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import {
  claimSceneParticles,
  clearSceneParticles,
  hasDueSceneFrameUpdate,
  isSceneParticlesClaimed,
  runBeforeSceneParticleTick,
  runDueSceneFrameUpdates,
  resetSceneParticleManagerForTest,
  sceneParticleScene,
} from '@/entities/particle/model/sceneParticleManager'

const config = {
  ang: 0, spread: 360, spd: 512, spdR: 0, emit: 2, emitR: 0, life: 5, lifeR: 0,
  a0: 0, a0R: 0, a1: 0, a1R: 0, ax: 0, ay: 0, w: 0, h: 0, total: 10, mode: 2,
} as unknown as ParticleConfig

describe('앱 전역 파티클 관리자 [0x1400068]', () => {
  afterEach(() => resetSceneParticleManagerForTest())

  it('관리자는 하나다 — 어디서 받아도 같은 장면', () => {
    expect(sceneParticleScene()).toBe(sceneParticleScene())
  })

  it('지우기 0x6dee4 는 이미터를 다 지운다(난수를 받지 않는다 — 굴림 없음)', () => {
    emitParticles(sceneParticleScene(), config, 10, 10, 4)
    expect(sceneParticleScene().emitters).toHaveLength(1)
    clearSceneParticles()
    expect(sceneParticleScene().emitters).toHaveLength(0)
  })

  it('경기 장면 부품이 쥔 동안만 쥔 것으로 본다 — 둘이 겹쳐도 하나가 놓으면 아직 쥐었다', () => {
    expect(isSceneParticlesClaimed()).toBe(false)
    const a = claimSceneParticles()
    const b = claimSceneParticles()
    a()
    a()
    expect(isSceneParticlesClaimed()).toBe(true)
    b()
    expect(isSceneParticlesClaimed()).toBe(false)
  })

  it('그리기 앞 갱신 — 그 틀에 걸린 갱신만 보이고 한 번만 돈다 (r295)', () => {
    const ran: number[] = []
    const cancel = runBeforeSceneParticleTick((appTick) => appTick >= 5, () => ran.push(5))
    runBeforeSceneParticleTick((appTick) => appTick >= 9, () => ran.push(9))
    expect(hasDueSceneFrameUpdate(4)).toBe(false)
    runDueSceneFrameUpdates(4)
    expect(ran).toEqual([])
    expect(hasDueSceneFrameUpdate(5)).toBe(true)
    runDueSceneFrameUpdates(6)
    expect(ran).toEqual([5])
    expect(hasDueSceneFrameUpdate(6)).toBe(false)
    // 이미 돈 갱신을 거둬도 아무 일 없다
    cancel()
    runDueSceneFrameUpdates(9)
    expect(ran).toEqual([5, 9])
  })
})
