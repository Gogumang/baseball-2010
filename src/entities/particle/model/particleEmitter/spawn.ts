import type { RandomPort } from '@/shared/api/random/randomPort'
import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import {
  createParticlePool,
  type Particle,
  type ParticleConfig,
  type ParticleEmitter,
  type ParticlePool,
} from '@/entities/particle/model/particleEmitter/types'

/**
 * 원본 `rand(n)` 0x9d468 — n ≤ 0 이면 **난수를 안 돌리고** 0, 아니면 한 번 돌려 [0, n).
 */
export function rollRand9d(random: RandomPort, limit: number): number {
  return random.rand9d(limit)
}

/** `값 + rand(폭+1) − (폭 >> 1)` — 원본이 흔들림을 넣는 식 (반은 산술 시프트) */
export function rollJitter(random: RandomPort, base: number, range: number): number {
  return base + rollRand9d(random, range + 1) - (range >> 1)
}

/**
 * 이미터를 세운다 (0x6d32c).
 * `total` 을 주면 파일 값 대신 그 수를 쓴다 — 원본 호출 인자 `total ≠ −1` 과 같다.
 * 게임 안 호출지는 전부 −1 이라(R5 7절) 웹도 기본은 파일 값이다.
 * `pool` 은 관리자의 공용 풀 — 따로 세운 이미터(시험)는 새 512 풀을 혼자 쓴다.
 */
export function createEmitter(
  config: ParticleConfig,
  x: number,
  y: number,
  img: number,
  total = -1,
  pool: ParticlePool = createParticlePool(),
): ParticleEmitter {
  return {
    config,
    x: Math.round(x),
    y: Math.round(y),
    img,
    total: total === -1 ? config.total : total,
    pool,
    spawned: 0,
    particles: [],
    state: 0,
    done: false,
  }
}

/** 수명: 첫 뽑기가 ≤0 이면 1, >0 이면 **한 번 더 뽑은 값**을 쓴다 — 원본 버릇 그대로 옮긴다 (R5 8절) */
function rollLife(random: RandomPort, config: ParticleConfig): number {
  const firstRoll = rollJitter(random, config.life, config.lifeR)
  if (firstRoll <= 0) return 1
  return rollJitter(random, config.life, config.lifeR)
}

/**
 * 입자 하나 만들기 (0x6d56c). 누계가 총수에 닿았거나(+0x40 ≥ +0x30) 풀이 비었으면 못 만든다(null).
 * 굴림 차례(0x6d5f4 ~ 0x6d808): 처음 위치 x · y → 방향 → 속력 → A 시작 → A 끝 → 수명(첫 값이 > 0 이면 한 번 더).
 */
export function rollSpawnedParticle(emitter: ParticleEmitter, random: RandomPort): Particle | null {
  const { config } = emitter
  if (emitter.spawned >= emitter.total || emitter.pool.free <= 0) return null
  emitter.pool.free -= 1

  // 처음 위치 흩뿌림 — (rand(w+1) − w/2)/4 px 을 1/512 눈금으로 옮기면 `<< 7` 이다
  const offX = (rollRand9d(random, config.w + 1) - (config.w >> 1)) << 7
  const offY = (rollRand9d(random, config.h + 1) - (config.h >> 1)) << 7
  const direction = rollJitter(random, config.ang, config.spread)
  // 0x6d688~0x6d6a6 — 방향을 굴린 바로 뒤 cos16 0x6c7f5 → +0x18 · sin16 0x6c7c1 → +0x1c (표 0xd2eec, ×65535 — 굴림 없음)
  const cos = cosineSixteen(direction)
  const sin = sineSixteen(direction)
  const speed = rollJitter(random, config.spd, config.spdR)
  const a = rollJitter(random, config.a0, config.a0R)
  const target = rollJitter(random, config.a1, config.a1R)
  const life = rollLife(random, config)

  emitter.spawned += 1
  return {
    x: emitter.x,
    y: emitter.y,
    offX,
    offY,
    // 0x6d6e8~0x6d704 · 0x6d70e~0x6d728 — 32비트 `muls` 뒤 `asrs #16`(음수는 −∞ 쪽으로 내림)
    vx: Math.imul(cos, speed) >> 16,
    vy: Math.imul(sin, speed) >> 16,
    a,
    // 0xca7b5 — (끝 − 시작) / (수명 & 0xffff), 0 쪽으로 자른다
    da: Math.trunc((target - a) / (life & 0xffff)),
    life,
  }
}
