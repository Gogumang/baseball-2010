import { describe, expect, it } from 'vitest'
import {
  createEmitter,
  drawStrengthOf,
  particlePixelOf,
  tickEmitter,
} from '@/entities/particle/model/particleEmitter'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 흔들림을 전부 0 으로 둔 설정 — 난수가 끼지 않아 식을 그대로 견줄 수 있다 */
const 고정설정 = (덮어쓰기: Partial<ParticleConfig> = {}): ParticleConfig => ({
  ang: 0,
  spread: 0,
  spd: 0,
  spdR: 0,
  emit: 1,
  emitR: 0,
  life: 3,
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
  ...덮어쓰기,
})

/** 늘 0 을 내는 난수 — `rand(n)` 이 0 이 되어 흔들림이 하한으로 고정된다 */
const 난수0: RandomPort = { next: () => 0, nextInRange: (minimum) => minimum, pick: (candidates) => candidates[0] }

describe('입자 만들기 0x6d56c', () => {
  it('첫 틱에 emit 개를 만들고 누계를 센다', () => {
    const emitter = createEmitter(고정설정({ emit: 4, total: 10 }), 0, 0, 10)
    tickEmitter(emitter, 난수0)
    expect([emitter.particles.length, emitter.spawned]).toEqual([4, 4])
  })

  it('누계가 total 에 닿으면 더 만들지 않는다', () => {
    const emitter = createEmitter(고정설정({ emit: 4, total: 6, life: 9 }), 0, 0, 10)
    tickEmitter(emitter, 난수0)
    tickEmitter(emitter, 난수0)
    tickEmitter(emitter, 난수0)
    expect(emitter.spawned).toBe(6)
  })

  it('ang 0 은 오른쪽, 90 은 아래로 간다 (화면 y 가 아래)', () => {
    const 오른쪽 = createEmitter(고정설정({ spd: 512 }), 0, 0, 10)
    const 아래 = createEmitter(고정설정({ ang: 90, spd: 512 }), 0, 0, 10)
    tickEmitter(오른쪽, 난수0)
    tickEmitter(아래, 난수0)
    expect([오른쪽.particles[0].vx, 오른쪽.particles[0].vy]).toEqual([512, 0])
    expect([아래.particles[0].vx, 아래.particles[0].vy]).toEqual([0, 512])
  })

  it('A 는 a0 에서 시작해 틱마다 (a1−a0)/life 만큼 움직인다', () => {
    const emitter = createEmitter(고정설정({ a0: 65536, a1: 6554, life: 5 }), 0, 0, 10)
    // 만드는 틱에는 아직 안 굴린다 — 원본 0x6dad0 도 살아 있는 입자를 먼저 굴린 뒤에 새로 만든다
    tickEmitter(emitter, 난수0)
    const 입자 = emitter.particles[0]
    expect([입자.da, 입자.a]).toEqual([Math.trunc((6554 - 65536) / 5), 65536])
    tickEmitter(emitter, 난수0)
    expect(입자.a).toBe(65536 + 입자.da)
  })

  it('그리기로 넘어가는 값은 A >> 8 이다', () => {
    const emitter = createEmitter(고정설정({ a0: 65536, a1: 65536 }), 0, 0, 10)
    tickEmitter(emitter, 난수0)
    expect(drawStrengthOf(emitter.particles[0])).toBe(256)
  })
})

describe('입자 갱신 0x6d878', () => {
  it('off 에 속도를 더한 뒤 속도에 가속을 더한다', () => {
    // spd 512 = 1 px/틱, ay 512 = 1 px/틱²
    const emitter = createEmitter(고정설정({ ang: 90, spd: 512, ay: 512, life: 5 }), 100, 50, 10)
    // 만든 틱은 그대로 두고, 다음 틱부터 off += v → v += ay 순으로 굴린다
    tickEmitter(emitter, 난수0)
    tickEmitter(emitter, 난수0)
    tickEmitter(emitter, 난수0)
    const 입자 = emitter.particles[0]
    // 2틱: off = 512 (v 는 1024 가 됨) · 3틱: off = 1536
    expect([입자.offY, 입자.vy]).toEqual([1536, 1536])
    expect(particlePixelOf(입자)).toEqual({ x: 100, y: 53 })
  })

  it('life 가 0 이 된 입자는 다음 틱에 사라진다', () => {
    const emitter = createEmitter(고정설정({ life: 2, emit: 1, total: 1 }), 0, 0, 10)
    // 만든 틱 + life 2,1 → 0 이 된 뒤 한 틱 더 살아 있다가 사라진다
    for (let tick = 0; tick < 3; tick += 1) tickEmitter(emitter, 난수0)
    expect(emitter.particles.length).toBe(1)
    tickEmitter(emitter, 난수0)
    expect([emitter.particles.length, emitter.done]).toEqual([0, true])
  })
})

describe('발생 범위 w·h', () => {
  it('처음 위치가 (rand(w+1) − w/2)/4 px 만큼 흩어진다', () => {
    // 난수 0 → rand(w+1) = 0 이라 −w/2 로 치우친다. w 20 이면 −10/4 = −2.5 px (1/512 눈금으로 −1280)
    const emitter = createEmitter(고정설정({ w: 20, h: 20 }), 0, 0, 10)
    tickEmitter(emitter, 난수0)
    expect(emitter.particles[0].offX).toBe(-1280)
    expect(particlePixelOf(emitter.particles[0])).toEqual({ x: -3, y: -3 })
  })
})

describe('total 상한', () => {
  it('emit 이 커도 파일 total 을 넘겨 만들지 않는다', () => {
    // 006 타격 불꽃 — 한 틱에 10개, 총 16개
    const emitter = createEmitter(고정설정({ emit: 10, total: 16, life: 5 }), 0, 0, 10)
    const random = createSeededRandom(7)
    let peak = 0
    for (let tick = 0; tick < 30; tick += 1) {
      tickEmitter(emitter, random)
      peak = Math.max(peak, emitter.particles.length)
    }
    expect(emitter.spawned).toBe(16)
    expect(peak).toBeLessThanOrEqual(16)
  })
})
