import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 원본 파티클 이미터 — `ptc/%03d.ptc` 51바이트 한 벌 (R5 8절 확정).
 *
 * 옮긴 코드: 입자 만들기 `0x6d56c` · 입자 갱신 `0x6d878` · 이미터 틱 `0x6dad0`.
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

export interface ParticleEmitter {
  readonly config: ParticleConfig
  /** 이미터가 선 화면 좌표 (px) */
  readonly x: number
  readonly y: number
  /** ptcimg.pzx 의 프레임 번호 — 그 프레임의 파트들이 입자 그림이 된다 (호출 인자 img) */
  readonly img: number
  /** 이 이미터가 만들 입자 총수 (호출 인자 total ≠ −1 이면 파일 값을 덮어쓴다, 0x6d32c) */
  readonly total: number
  /** 지금까지 만든 누계 (+0x40) */
  spawned: number
  readonly particles: Particle[]
  /** 다 뿌리고 입자도 없어진 상태 3 (0x6dad0) — 관리자가 지운다 */
  done: boolean
}

/** 원본 `rand(n)` = `rand_range(0, n)` */
function roll(random: RandomPort, limit: number): number {
  return randomIntegerBelow(random, 0, limit)
}

/** `값 + rand(폭+1) − 폭/2` — 원본이 흔들림을 넣는 식 (나눗셈은 정수) */
function jitter(random: RandomPort, base: number, range: number): number {
  return base + roll(random, range + 1) - Math.trunc(range / 2)
}

/**
 * 이미터를 세운다 (0x6d32c).
 * `total` 을 주면 파일 값 대신 그 수를 쓴다 — 원본 호출 인자 `total ≠ −1` 과 같다.
 * 게임 안 호출지는 전부 −1 이라(R5 7절) 웹도 기본은 파일 값이다.
 */
export function createEmitter(
  config: ParticleConfig,
  x: number,
  y: number,
  img: number,
  total = -1,
): ParticleEmitter {
  return {
    config,
    x: Math.round(x),
    y: Math.round(y),
    img,
    total: total === -1 ? config.total : total,
    spawned: 0,
    particles: [],
    done: false,
  }
}

/** 입자 하나 만들기 (0x6d56c) */
function spawn(emitter: ParticleEmitter, random: RandomPort): Particle {
  const { config } = emitter
  const direction = jitter(random, config.ang, config.spread)
  const speed = jitter(random, config.spd, config.spdR)
  // ⚠️ 원본은 sin 표 0xd2eec(16.16) 을 쓴다. 웹은 Math 삼각함수로 대신하므로 끝자리가 다를 수 있다 — **근사**
  const radians = (direction * Math.PI) / 180

  // 수명: 첫 뽑기가 ≤0 이면 1, >0 이면 **한 번 더 뽑은 값**을 쓴다 — 원본 버릇 그대로 옮긴다 (R5 8절)
  const firstRoll = jitter(random, config.life, config.lifeR)
  const life = firstRoll <= 0 ? 1 : jitter(random, config.life, config.lifeR)

  const a = jitter(random, config.a0, config.a0R)
  const target = jitter(random, config.a1, config.a1R)

  return {
    x: emitter.x,
    y: emitter.y,
    // 처음 위치 흩뿌림 — (rand(w+1) − w/2)/4 px 을 1/512 눈금으로 옮기면 `<< 7` 이다
    offX: (roll(random, config.w + 1) - Math.trunc(config.w / 2)) << 7,
    offY: (roll(random, config.h + 1) - Math.trunc(config.h / 2)) << 7,
    vx: Math.trunc(speed * Math.cos(radians)),
    vy: Math.trunc(speed * Math.sin(radians)),
    a,
    da: Math.trunc((target - a) / life),
    life,
  }
}

/**
 * 이미터 한 틱 (0x6dad0).
 *
 * 1. 살아 있는 입자를 굴린다 (0x6d878): `life == 0` 이면 버리고, 아니면
 *    `off += v` → `v += (ax, ay)` → `A += dA` → `life−−`.
 *    (바람 칸 `e[0x5c]` 은 기본 0 이고 세우는 곳을 못 봤다 — 웹에는 없다.)
 * 2. 입자가 하나도 없고 누계 > 0 이면 끝(상태 3).
 * 3. 아니면 `emit ± emitR/2` 개를 새로 만든다. 누계가 `total` 에 닿으면 더 못 만든다.
 *
 * 이미터 상태를 제자리에서 고친다 — 매 프레임 도는 루프라 입자 배열을 새로 만들지 않는다.
 * 바깥 입력은 `random` 뿐이라 같은 난수를 주면 결과도 같다.
 */
export function tickEmitter(emitter: ParticleEmitter, random: RandomPort): void {
  if (emitter.done) return
  const { config, particles } = emitter

  let alive = 0
  for (const particle of particles) {
    // 원본 0x6d878 은 life 를 **0 과만** 견준다. 파일 값으로는 수명이 0 밑으로 내려가지 않는다
    if (particle.life === 0) continue
    particle.offX += particle.vx
    particle.offY += particle.vy
    particle.vx += config.ax
    particle.vy += config.ay
    particle.a += particle.da
    particle.life -= 1
    particles[alive] = particle
    alive += 1
  }
  particles.length = alive

  if (alive === 0 && emitter.spawned > 0) {
    emitter.done = true
    return
  }
  if (emitter.spawned >= emitter.total) return

  const room = emitter.total - emitter.spawned
  const wanted = jitter(random, config.emit, config.emitR)
  const count = Math.min(room, wanted)
  for (let index = 0; index < count; index += 1) {
    particles.push(spawn(emitter, random))
  }
  emitter.spawned += Math.max(0, count)
}

/** 그리기로 넘어가는 A 값 = `A >> 8` (0~256, 0x6dd26) */
export function drawStrengthOf(particle: Particle): number {
  return particle.a >> 8
}

/** 입자가 그려질 화면 좌표 — `p.x + (off >> 9)` (0x6dc4c, 카메라는 타석 화면에 없다) */
export function particlePixelOf(particle: Particle): { readonly x: number; readonly y: number } {
  return { x: particle.x + (particle.offX >> 9), y: particle.y + (particle.offY >> 9) }
}
