import { test } from 'vitest'
import { clearParticles, createParticleScene, emitParticles, MAX_EMITTERS, tickParticles } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 파티클 한 걸음 — 장면 틱마다 도는 `tickParticles`. 방출기를 다 채운 장면(가장 무거운 틀)을 잰다.
 * 기준 숫자만 남긴다(기계마다 달라 실패 기준은 없다) — `pnpm bench`
 */
const 오래뿌림: ParticleConfig = {
  ang: 0,
  spread: 360,
  spd: 3 << 16,
  spdR: 1 << 16,
  emit: 4,
  emitR: 2,
  life: 30,
  lifeR: 10,
  a0: 65536,
  a0R: 0,
  a1: 0,
  a1R: 0,
  ax: 0,
  ay: 1 << 14,
  w: 4,
  h: 4,
  total: 1000,
  mode: 2,
}
const random = createSeededRandom(1)
const 장면 = createParticleScene()

/** 방출기를 다 채우고 몇 틀 돌려 알갱이가 찬 상태로 */
function 가득채우기(): void {
  clearParticles(장면)
  for (let index = 0; index < MAX_EMITTERS; index += 1) emitParticles(장면, 오래뿌림, 120, 160, 10)
  for (let tick = 0; tick < 10; tick += 1) tickParticles(장면, random)
}

test('파티클', async ({ bench }) => {
  let ticks = 0
  가득채우기()
  await bench(`방출기 ${MAX_EMITTERS}개 한 걸음 (tickParticles)`, () => {
    ticks += 1
    if (ticks % 20 === 0) 가득채우기()
    tickParticles(장면, random)
  }).run()
})
