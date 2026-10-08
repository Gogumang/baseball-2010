import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import {
  enterSettlementEffect,
  rainDrawingOf,
  tickSettlementEffect,
  type SettlementEffect,
} from '@/entities/batting/model/settlementEffect'
import type { FireworksParticlePort } from '@/entities/batting/model/homeRunFireworks'

function 세는난수(seed = 1): RandomPort & { calls: number } {
  const inner = createSeededRandom(seed)
  const random = {
    calls: 0,
    rand: (lo: number, hi: number) => {
      random.calls += 1
      return inner.rand(lo, hi)
    },
    rand9d: (n: number) => {
      random.calls += 1
      return inner.rand9d(n)
    },
  }
  return random
}

const 빈자리: FireworksParticlePort<number> = { emit: () => null, isFinished: () => false }

describe('경기 정산 0x4ea0c 의 효과 깔기', () => {
  it('이겼고 밤하늘(하늘 색 > 6)이면 종류 2 를 칸마다 자리 굴림 2 번으로 깐다 — 기다림 50', () => {
    const random = 세는난수()
    const effect = enterSettlementEffect({ isWin: true, skyColorIndex: 7, side0Score: 3, side1Score: 1 }, random)
    expect(random.calls).toBe(14)
    expect(effect?.kind).toBe('fireworks')
    if (effect?.kind !== 'fireworks') return
    expect(effect.fireworks.slots.map((slot) => [slot.state, slot.delay])).toEqual(Array.from({ length: 7 }, () => [1, 50]))
  })

  it('이겼어도 하늘 색 ≤ 6 이면 끈다 — 굴림 없음', () => {
    const random = 세는난수()
    expect(enterSettlementEffect({ isWin: true, skyColorIndex: 6, side0Score: 3, side1Score: 1 }, random)).toBeNull()
    expect(random.calls).toBe(0)
  })

  it('졌으면 비 — 1202 번 뒤 점수 차 × 30 개 방울을 새로 깐다(굴림 6 씩)', () => {
    const random = 세는난수()
    const effect = enterSettlementEffect({ isWin: false, skyColorIndex: 0, side0Score: 1, side1Score: 3 }, random)
    expect(random.calls).toBe(1202 + 60 * 6)
    expect(effect?.kind).toBe('rain')
    if (effect?.kind !== 'rain') return
    expect(effect.rain.drops.slots.length).toBe(60)
  })

  it('점수 차가 0 이면(비김) 0x8fd28 이 아무것도 안 해 방울 200 그대로', () => {
    const random = 세는난수()
    const effect = enterSettlementEffect({ isWin: false, skyColorIndex: 0, side0Score: 2, side1Score: 2 }, random)
    expect(random.calls).toBe(1202)
    if (effect?.kind !== 'rain') throw new Error('비가 아니다')
    expect(effect.rain.drops.slots.length).toBe(200)
  })
})

describe('결과 그림 0x4a384 의 효과 틱 — 비', () => {
  it('땅에 닿은 방울은 튐(수명 4)을 남기고 같은 칸에 굴림 6 으로 다시 깔린다', () => {
    const random = 세는난수(9)
    const effect = enterSettlementEffect({ isWin: false, skyColorIndex: 0, side0Score: 0, side1Score: 1 }, random) as SettlementEffect
    if (effect.kind !== 'rain') throw new Error('비가 아니다')
    const 처음 = random.calls
    let 다시 = 0
    for (let tick = 0; tick < 80; tick += 1) {
      const 앞 = random.calls
      tickSettlementEffect(effect, 빈자리, random)
      expect((random.calls - 앞) % 6).toBe(0)
      다시 += (random.calls - 앞) / 6
    }
    expect(random.calls).toBeGreaterThan(처음)
    expect(effect.rain.drops.slots.every((drop) => drop !== null)).toBe(true)
    expect(다시).toBeGreaterThan(0)
    const 그림 = rainDrawingOf(effect.rain)
    expect(그림.lines.length).toBeGreaterThan(0)
    expect(그림.lines.every((line) => line.alpha <= 0x80)).toBe(true)
  })

  it('바람은 20 그림마다 한 걸음, |바람| 이 3 에 닿으면 걸음을 뒤집는다', () => {
    const random = 세는난수(3)
    const effect = enterSettlementEffect({ isWin: false, skyColorIndex: 0, side0Score: 0, side1Score: 0 }, random)
    if (effect?.kind !== 'rain') throw new Error('비가 아니다')
    effect.rain.wind = 2
    effect.rain.windStep = 1
    for (let tick = 0; tick < 20; tick += 1) tickSettlementEffect(effect, 빈자리, random)
    expect([effect.rain.wind, effect.rain.windStep]).toEqual([3, -1])
    for (let tick = 0; tick < 20; tick += 1) tickSettlementEffect(effect, 빈자리, random)
    expect([effect.rain.wind, effect.rain.windStep]).toEqual([2, -1])
  })
})
