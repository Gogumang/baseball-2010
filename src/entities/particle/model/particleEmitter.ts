import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 원본 파티클 이미터 — `ptc/%03d.ptc` 51바이트 한 벌 (R5 8절 확정).
 *
 * 옮긴 코드: 입자 만들기 `0x6d56c` · 입자 갱신 `0x6d878` · 이미터 틱 `0x6dad0` · 정리 `0x6dc08` · 공용 풀 `0x6d07c`(512).
 * 파일 51바이트는 `0x6d2b4` 가 이미터 `+0x24..` 에 그대로 memcpy 하므로 칸 이름은 파일 배치 그대로다.
 *
 * 단위 (R5 8절):
 *   - `spd`·`spdR`·`ax`·`ay` 와 속도·누적 오프셋은 **1/512 px** 눈금이다 (px = 값/512).
 *   - `a0`·`a1` 과 A 는 16.16 고정소수. 그리기에는 `A >> 8` (0~256) 으로 넘어간다.
 *   - `ang`·`spread` 는 도(°)이고 화면 y 가 아래라 0=오른쪽·90=아래·180=왼쪽·270=위.
 */
export interface ParticleConfig {
  /** 방향(도) */
  readonly ang: number
  /** 방향 폭 — `ang + rand(spread+1) − spread/2` (360 = 사방) */
  readonly spread: number
  readonly spd: number
  readonly spdR: number
  /** 틱마다 새로 만들 입자 수 */
  readonly emit: number
  readonly emitR: number
  readonly life: number
  readonly lifeR: number
  /** 시작 A (16.16) */
  readonly a0: number
  readonly a0R: number
  /** 끝 A (16.16) — 틱마다 `A += (a1−a0)/life` */
  readonly a1: number
  readonly a1R: number
  /** 틱마다 `vx += ax` */
  readonly ax: number
  /** 틱마다 `vy += ay` (+면 아래 = 중력) */
  readonly ay: number
  /** 발생 범위 — 처음 위치가 `±(rand(w+1) − w/2)/4` px 흩어진다 */
  readonly w: number
  readonly h: number
  /** 이 이미터가 평생 만들 입자 총수 */
  readonly total: number
  /**
   * 그리기 가상함수(+0x14) 의 4번째 인자 **그대로**. 001 만 0, 나머지 25개는 2.
   * ⚠️ "0 = 그냥 그리기 / 2 = A 를 쓰는 섞기" 는 **유력**일 뿐이라 숫자만 든다 (R5 `_meta.likelyOnlyFields`).
   */
  readonly mode: number
}

/** 입자 한 알. 좌표는 이미터 자리 + 1/512 px 눈금의 누적 오프셋이다 */
export interface Particle {
  /** 이미터가 있던 화면 x (px) */
  x: number
  y: number
  /** 누적 오프셋 (1/512 px) — 그릴 때 `>> 9` 로 px 을 뽑는다 */
  offX: number
  offY: number
  /** 속도 (1/512 px/틱) */
  vx: number
  vy: number
  /**
   * A (16.16). ⚠️ **불투명도인지 세기인지 미해결** — 갱신식만 확정이라 `alpha` 로 이름 붙이지 않았다
   * (R5 8절 · `_meta.likelyOnlyFields`).
   */
  a: number
  /** 틱마다 A 에 더하는 값 = `(a1 − a0)/life` */
  da: number
  /** 남은 수명(틱). 그림은 `파트[ life % 파트수 ]` 로 고른다 (0x6dc6a) */
  life: number
}

/**
 * 입자 공용 풀 (0x6d07c) — 앱 초기화 0x2f9c 가 `0x6d284(mgr, "ptc/ptcimg.pzx", 0x200, 1)` 로 **512 알**을 한 번 만든다.
 * 이미터마다 따로가 아니라 관리자 하나가 모든 이미터에 나눠 준다. 알은 빈 칸 목록([pool+4])에서 꺼내고(0x6d58a)
 * 수명이 다하면(0x6d878 의 life == 0 갈래) 그 목록 머리로 돌려준다. 알에는 이름이 없어 웹은 **남은 수**만 센다.
 */
export interface ParticlePool {
  /** 빈 칸 수 — 0 이면 [pool+4] == 0 */
  free: number
}

/** 0x2f9c 의 0x200 */
export const PARTICLE_POOL_SIZE = 512

export function createParticlePool(size = PARTICLE_POOL_SIZE): ParticlePool {
  return { free: size }
}

/**
 * 이미터 상태 +0x58 — 틱 0x6dad0 이 돌려주고 그대로 적는 값.
 * 0 풀이 바닥(굴림 없음) · 1 뿌리는 중 · 2 이번 틱에 다 못 만들었다(총수 · 풀) · 3 끝(알이 없고 누계 > 0).
 * 새 이미터는 calloc(0x2ac4) · 0x6d2f8 로 0 에서 시작한다.
 */
export type EmitterState = 0 | 1 | 2 | 3

export interface ParticleEmitter {
  readonly config: ParticleConfig
  /** 이미터가 선 화면 좌표 (px) */
  readonly x: number
  readonly y: number
  /** ptcimg.pzx 의 프레임 번호 — 그 프레임의 파트들이 입자 그림이 된다 (호출 인자 img) */
  readonly img: number
  /** 이 이미터가 만들 입자 총수 (호출 인자 total ≠ −1 이면 파일 값을 덮어쓴다, 0x6d32c) */
  readonly total: number
  /** 알을 꺼내 쓰는 관리자의 공용 풀 */
  readonly pool: ParticlePool
  /** 지금까지 만든 누계 (+0x40) */
  spawned: number
  /**
   * 살아 있는 알 — 원본 +0x3c 목록 차례(**새 알이 머리**: 0x6d5e0 이 머리에 끼운다). 갱신 · 그리기가 이 차례로 돈다.
   */
  readonly particles: Particle[]
  /** +0x58 — 마지막 틱이 적은 상태 */
  state: EmitterState
  /** 다 뿌리고 입자도 없어진 상태 3 (0x6dad0) — 관리자가 지운다 */
  done: boolean
}

/**
 * 원본 `rand(n)` 0x9d468 — n ≤ 0 이면 **난수를 안 돌리고** 0, 아니면 한 번 돌려 [0, n).
 */
function roll(random: RandomPort, limit: number): number {
  if (limit <= 0) return 0
  return randomIntegerBelow(random, 0, limit)
}

/** `값 + rand(폭+1) − (폭 >> 1)` — 원본이 흔들림을 넣는 식 (반은 산술 시프트) */
function jitter(random: RandomPort, base: number, range: number): number {
  return base + roll(random, range + 1) - (range >> 1)
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

/**
 * 입자 하나 만들기 (0x6d56c). 누계가 총수에 닿았거나(+0x40 ≥ +0x30) 풀이 비었으면 못 만든다(null).
 * 굴림 차례(0x6d5f4 ~ 0x6d808): 처음 위치 x · y → 방향 → 속력 → A 시작 → A 끝 → 수명(첫 값이 > 0 이면 한 번 더).
 */
function spawn(emitter: ParticleEmitter, random: RandomPort): Particle | null {
  const { config } = emitter
  if (emitter.spawned >= emitter.total || emitter.pool.free <= 0) return null
  emitter.pool.free -= 1

  // 처음 위치 흩뿌림 — (rand(w+1) − w/2)/4 px 을 1/512 눈금으로 옮기면 `<< 7` 이다
  const offX = (roll(random, config.w + 1) - (config.w >> 1)) << 7
  const offY = (roll(random, config.h + 1) - (config.h >> 1)) << 7
  const direction = jitter(random, config.ang, config.spread)
  // ⚠️ 원본은 sin 표 0xd2eec(16.16) 을 쓴다. 웹은 Math 삼각함수로 대신하므로 끝자리가 다를 수 있다 — **근사**
  const radians = (direction * Math.PI) / 180
  const speed = jitter(random, config.spd, config.spdR)
  const a = jitter(random, config.a0, config.a0R)
  const target = jitter(random, config.a1, config.a1R)
  // 수명: 첫 뽑기가 ≤0 이면 1, >0 이면 **한 번 더 뽑은 값**을 쓴다 — 원본 버릇 그대로 옮긴다 (R5 8절)
  const firstRoll = jitter(random, config.life, config.lifeR)
  const life = firstRoll <= 0 ? 1 : jitter(random, config.life, config.lifeR)

  emitter.spawned += 1
  return {
    x: emitter.x,
    y: emitter.y,
    offX,
    offY,
    vx: Math.trunc(speed * Math.cos(radians)),
    vy: Math.trunc(speed * Math.sin(radians)),
    a,
    // 0xca7b5 — (끝 − 시작) / (수명 & 0xffff), 0 쪽으로 자른다
    da: Math.trunc((target - a) / (life & 0xffff)),
    life,
  }
}

/**
 * 입자 갱신 (0x6d878) — 살아 있으면 **바람 굴림 하나**를 쓴다:
 * `off.x += v.x + (바람 >> 1) + rand(바람 − (바람 >> 1) + 1)`. 바람 칸 +0x5c 는 0x6d2f8 의 0 뒤로 세우는 곳이 없어
 * 늘 0 이라 값은 0 이지만 rand(1) 도 난수를 한 번 돌린다. 그 뒤 off.y += v.y → v += (ax, ay) → A += dA → life −1.
 * 수명이 0 이면 목록에서 빼 풀로 돌려준다(되돌이 +0x44 는 0xbbc84 가 늘 0 이라 누계는 그대로).
 */
const WIND = 0

function updateParticle(emitter: ParticleEmitter, particle: Particle, random: RandomPort): boolean {
  if (particle.life === 0) {
    emitter.pool.free += 1
    return false
  }
  const { config } = emitter
  const drift = (WIND >> 1) + roll(random, WIND - (WIND >> 1) + 1)
  particle.offX += particle.vx + drift
  particle.offY += particle.vy
  particle.vx += config.ax
  particle.vy += config.ay
  particle.a += particle.da
  particle.life -= 1
  return true
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
  const { config, particles } = emitter

  if (particles.length === 0 && emitter.spawned > 0) return finishTick(emitter, 3)

  let alive = 0
  for (const particle of particles) {
    if (!updateParticle(emitter, particle, random)) continue
    particles[alive] = particle
    alive += 1
  }
  particles.length = alive

  if (emitter.pool.free <= 0) return finishTick(emitter, 0)

  const count = config.emit + roll(random, config.emitR + 1) - (config.emitR >> 1)
  const born: Particle[] = []
  let state: EmitterState = 1
  for (let index = 0; index < count; index += 1) {
    const particle = spawn(emitter, random)
    if (particle === null) {
      state = 2
      break
    }
    born.push(particle)
  }
  // 새 알은 하나씩 목록 머리에 끼우므로 나중에 만든 알이 앞이다
  if (born.length > 0) particles.unshift(...born.reverse())
  return finishTick(emitter, state)
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
