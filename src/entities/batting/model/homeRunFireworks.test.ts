import { describe, expect, it } from 'vitest'
import {
  FIREWORK_PARTICLES,
  initHomeRunFireworks,
  tickHomeRunFireworks,
  type FireworksParticlePort,
} from '@/entities/batting/model/homeRunFireworks'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

/** 굴림 수를 세는 난수 — 늘 같은 비율 */
function 세는난수(ratio = 0.25): RandomPort & { count: () => number } {
  let rolls = 0
  const inner = createFractionRandom(() => {
    rolls += 1
    return ratio
  })
  return { ...inner, count: () => rolls }
}

/** 이미터를 번호로 돌려주고, `finishAfter` 틱 뒤에 끝나는 가짜 관리자 */
function 가짜관리자(finishAfter: number) {
  const emitted: { id: number; x: number; y: number; at: number }[] = []
  let now = 0
  const port: FireworksParticlePort<number> = {
    emit: (id, x, y) => {
      emitted.push({ id, x, y, at: now })
      return emitted.length - 1
    },
    isFinished: (emitter) => now - emitted[emitter]!.at >= finishAfter,
  }
  return { port, emitted, step: () => (now += 1) }
}

describe('홈런 효과 객체 종류 2 — 0x90190(…, 2, 1) · 틱 0x901a0', () => {
  it('깔기는 굴림 없이 일곱 칸 — x = 4 + 30i, y = H + 70, 기다림 3i', () => {
    const fireworks = initHomeRunFireworks<number>()
    expect(fireworks.slots.map((slot) => [slot.x, slot.y, slot.delay])).toEqual(
      Array.from({ length: 7 }, (_unused, index) => [4 + 30 * index, 390, 3 * index]),
    )
  })

  it('기다림이 끝난 틱에 오름(16)을 쏘고, 다음 틱에 rand(0, 2) 하나로 터짐(13 · 14)을 y − 270 에', () => {
    const 관리자 = 가짜관리자(100)
    const random = 세는난수(0.25)
    let fireworks = initHomeRunFireworks<number>()
    fireworks = tickHomeRunFireworks(fireworks, 관리자.port, random)
    // 칸 0(기다림 0)만 이 틱에 오른다 — 굴림 없음
    expect(관리자.emitted).toEqual([{ id: FIREWORK_PARTICLES.rise, x: 4, y: 390, at: 0 }])
    expect(random.count()).toBe(0)
    fireworks = tickHomeRunFireworks(fireworks, 관리자.port, random)
    expect(random.count()).toBe(1)
    expect(관리자.emitted[1]).toEqual({ id: FIREWORK_PARTICLES.burstA, x: 4, y: 120, at: 0 })
    expect(fireworks.slots[0]!.state).toBe(3)
  })

  it('터짐이 끝나면 5틱 머문 뒤 같은 칸을 굴려 다시 깐다 — x = rand(40, 200) · y = rand(370, 420) · 기다림 50', () => {
    const 관리자 = 가짜관리자(3)
    const random = 세는난수(0.5)
    let fireworks = initHomeRunFireworks<number>()
    const 칸0 = () => fireworks.slots[0]!
    // 틱 1 오름 · 틱 2 터짐(굴림 1) · 터짐이 3틱 뒤 끝 → 상태 4 · 5틱 뒤 다시 깔기(굴림 2)
    const states: number[] = []
    for (let tick = 0; tick < 12; tick += 1) {
      fireworks = tickHomeRunFireworks(fireworks, 관리자.port, random)
      관리자.step()
      states.push(칸0().state)
    }
    expect(states.slice(0, 2)).toEqual([2, 3])
    expect(states).toContain(4)
    // 틱 5 상태 4 → 틱 6~10 머묾(+0x11 4..0) → 틱 10 에 다시 깔고(기다림 50), 틱 11 · 12 에 48 까지 줄었다
    expect(states.indexOf(4)).toBe(4)
    expect(칸0()).toMatchObject({ state: 1, x: 120, y: 395, delay: 48, burst: null })
  })

  it('이미터를 못 만들면(64 개 넘음) 상태 3 에 그대로 머문다', () => {
    const port: FireworksParticlePort<number> = { emit: () => null, isFinished: () => true }
    let fireworks = initHomeRunFireworks<number>()
    for (let tick = 0; tick < 5; tick += 1) fireworks = tickHomeRunFireworks(fireworks, port, 세는난수())
    expect(fireworks.slots[0]!.state).toBe(3)
  })
})
