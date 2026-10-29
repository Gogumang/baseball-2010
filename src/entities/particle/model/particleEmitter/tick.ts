import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollRand9d, rollSpawnedParticle } from '@/entities/particle/model/particleEmitter/spawn'
import type { EmitterState, Particle, ParticleEmitter } from '@/entities/particle/model/particleEmitter/types'

/**
 * 입자 갱신 (0x6d878) — 살아 있으면 **바람 굴림 하나**를 쓴다:
 * `off.x += v.x + (바람 >> 1) + rand(바람 − (바람 >> 1) + 1)`. 바람 칸 +0x5c 는 0x6d2f8 의 0 뒤로 세우는 곳이 없어
 * 늘 0 이라 값은 0 이지만 rand(1) 도 난수를 한 번 돌린다. 그 뒤 off.y += v.y → v += (ax, ay) → A += dA → life −1.
 * 수명이 0 이면 목록에서 빼 풀로 돌려준다(되돌이 +0x44 는 0xbbc84 가 늘 0 이라 누계는 그대로).
 */
const WIND = 0

function rollParticleUpdate(emitter: ParticleEmitter, particle: Particle, random: RandomPort): boolean {
  if (particle.life === 0) {
    emitter.pool.free += 1
    return false
  }
  const { config } = emitter
  const drift = (WIND >> 1) + rollRand9d(random, WIND - (WIND >> 1) + 1)
  particle.offX += particle.vx + drift
  particle.offY += particle.vy
  particle.vx += config.ax
  particle.vy += config.ay
  particle.a += particle.da
  particle.life -= 1
  return true
}

/** 목록 차례로 알을 굴린다 — 수명 0 은 풀로 돌려주고 목록에서 뺀다(제자리에서 당겨 채운다) */
function rollParticleUpdates(emitter: ParticleEmitter, random: RandomPort): void {
  const { particles } = emitter
  let alive = 0
  for (const particle of particles) {
    if (!rollParticleUpdate(emitter, particle, random)) continue
    particles[alive] = particle
    alive += 1
  }
  particles.length = alive
}

/** 발생 수만큼 만든다 — 못 만들면(총수 · 풀) 2, 다 만들면 1. 새 알은 하나씩 목록 머리에 끼우므로 나중에 만든 알이 앞이다 */
function rollNewParticles(emitter: ParticleEmitter, count: number, random: RandomPort): EmitterState {
  const born: Particle[] = []
  let state: EmitterState = 1
  for (let index = 0; index < count; index += 1) {
    const particle = rollSpawnedParticle(emitter, random)
    if (particle === null) {
      state = 2
      break
    }
    born.push(particle)
  }
  if (born.length > 0) emitter.particles.unshift(...born.reverse())
  return state
}

/**
 * 이미터 한 틱 (0x6dad0) — 상태 +0x58 을 적고 돌려준다.
 *
 * 1. **틱 머리에서** 알 목록이 비었고 누계 > 0 이면 끝(3) — 굴림 없음.
 * 2. 아니면 목록 차례로 알을 굴린다(`updateParticle` — 알마다 굴림 하나, 수명 0 은 풀로).
 * 3. 풀이 비었으면(0x6dba4) 0 — 발생 수를 안 굴린다.
 * 4. 발생 수 = `emit + rand(emitR+1) − (emitR >> 1)` 를 **총수에 닿은 뒤에도 늘 굴리고**(0x6dbcc),
 *    그만큼 만들다가 못 만들면(총수 · 풀) 2, 다 만들면 1.
 *
 * 그래서 마지막 알이 사라진 틱은 아직 2 이고, 끝(3)은 그 **다음 틱**이다.
 */
export function tickEmitter(emitter: ParticleEmitter, random: RandomPort): EmitterState {
  if (emitter.done) return emitter.state
  const { config } = emitter

  if (emitter.particles.length === 0 && emitter.spawned > 0) return finishTick(emitter, 3)

  rollParticleUpdates(emitter, random)

  if (emitter.pool.free <= 0) return finishTick(emitter, 0)

  const count = config.emit + rollRand9d(random, config.emitR + 1) - (config.emitR >> 1)
  return finishTick(emitter, rollNewParticles(emitter, count, random))
}

function finishTick(emitter: ParticleEmitter, state: EmitterState): EmitterState {
  emitter.state = state
  emitter.done = state === 3
  return state
}

/** 이미터 정리 (0x6dc08) — 남은 알을 모두 풀로 돌려주고 목록 · 누계를 비운다 */
export function releaseEmitter(emitter: ParticleEmitter): void {
  emitter.pool.free += emitter.particles.length
  emitter.particles.length = 0
  emitter.spawned = 0
}

/** 그리기로 넘어가는 A 값 = `A >> 8` (0~256, 0x6dd26) */
export function drawStrengthOf(particle: Particle): number {
  return particle.a >> 8
}

/** 입자가 그려질 화면 좌표 — `p.x + (off >> 9)` (0x6dc4c, 카메라는 타석 화면에 없다) */
export function particlePixelOf(particle: Particle): { readonly x: number; readonly y: number } {
  return { x: particle.x + (particle.offX >> 9), y: particle.y + (particle.offY >> 9) }
}
