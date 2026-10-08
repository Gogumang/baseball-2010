import { describe, expect, it } from 'vitest'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import { throwLaunchOf, throwTicksTo, thrownWith } from '@/entities/fielding/model/throwPlan'
import { forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom, createFractionRandom } from '@/shared/api/random/fractionRandom'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
/** 늘 같은 값을 내는 난수 — 0.999 면 악송구 · 흔들림 굴림이 모두 빗나간다 */
const 고정 = (value: number): RandomPort => createConstantRandom(value)

describe('송구 공 쏘기 — 0xa1620 · 세계 0xbfed0 · 받는 점 끼워 넣기 b2f9c', () => {
  it('보통 송구는 점[T − 1] 이 받는 점 (목표 x, 1000, 목표 z) 이다 — 속도 칸은 세계가 깐 그대로', () => {
    const 유격수 = 야수들[5]
    const 일루 = basePosition(1)
    const 공 = launchThrow({ thrower: 유격수, target: 일루, ability: 500, random: 고정(0.999) })
    const T = throwTicksTo(유격수, 일루)

    expect(공.loose).toBe(false)
    expect(공.wobbled).toBe(false)
    expect(공.ball.pointAt(T - 1)).toEqual({ x: 일루.x, y: 1000, z: 일루.z })
    expect(공.ball.pointDetailAt(T - 1).speed).toBeGreaterThan(0)
    expect(공.ball.pointAt(T - 2)).not.toEqual({ x: 일루.x, y: 1000, z: 일루.z })
    // 내야 → 내야는 +0x1e8 — C 만 낮은 공 · 가슴 높이
    expect(forecastOptionsOf(공, 5, 2)).toEqual({
      initialChaserSlot: 5,
      thrownSlot: 5,
      secondPass: { movable: false },
      onlySlot: 2,
    })
  })

  it('악송구(공+0xaac)는 끼워 넣지 않고 예보가 움직임허용 모두 · +0x1e8 없이 줍는 야수를 고른다', () => {
    const 유격수 = 야수들[5]
    const 일루 = basePosition(1)
    // 악송구 굴림 0 → 기준 아래 · 흔들기 굴림도 0
    const 공 = launchThrow({ thrower: 유격수, target: 일루, ability: 500, random: 고정(0) })
    const T = throwTicksTo(유격수, 일루)

    expect(공.errant).toBe(true)
    expect(공.loose).toBe(true)
    expect(공.ball.pointAt(T - 1)).not.toEqual({ x: 일루.x, y: 1000, z: 일루.z })
    expect(forecastOptionsOf(공, 5, 2)).toEqual({
      initialChaserSlot: 5,
      thrownSlot: 5,
      secondPass: { movable: true },
      onlySlot: undefined,
    })
  })

  it('레이저(0xa222c)는 굴림이 없다 — 난수를 줘도 하나도 안 먹고 받는 점을 끼워 넣는다', () => {
    let 굴림 = 0
    const 세는난수: RandomPort = createFractionRandom(() => {
      굴림 += 1
      return 0
    })
    const 투수 = { ...야수들[0], throwSpeed: 2000 }
    const 홈 = basePosition(0)
    const 이루 = basePosition(2)
    const 공 = launchThrow({ thrower: { ...투수, position: 이루 }, target: 홈, laser: true, ability: 500, random: 세는난수 })

    expect(굴림).toBe(0)
    expect(공.ball.pointAt(throwTicksTo({ ...투수, position: 이루 }, 홈) - 1)).toEqual({ x: 홈.x, y: 1000, z: 홈.z })
  })

  it('원바운드(a17fc)는 앙각만 20400 으로 줄여 받는 점 앞에 떨어지고, rand(0, 2) 하나로 φ ± 1 · 공+0xaac 라 끼워 넣지 않는다', () => {
    let 굴림 = 0
    const 세는난수 = (value: number): RandomPort =>
      createFractionRandom(() => {
        굴림 += 1
        return value
      })
    // 깊은 중견수(8)가 홈으로 — 거리 25445 > 20400, 특수라 +0xdc = +0xd8
    const 중견수 = thrownWith({ ...야수들[8], position: { x: 20_000, y: 0, z: 4_000 } }, true)
    const 홈 = basePosition(0)
    const 보통 = throwLaunchOf(중견수, 홈)
    const 왼쪽 = launchThrow({ thrower: 중견수, target: 홈, special: true, bounce: true, ability: 500, random: 세는난수(0.9) })
    expect(굴림).toBe(1)
    const 오른쪽 = launchThrow({ thrower: 중견수, target: 홈, special: true, bounce: true, ability: 500, random: 세는난수(0) })

    expect(왼쪽.bounce).toBe(true)
    expect(왼쪽.loose).toBe(true)
    expect(왼쪽.errant).toBe(false)
    expect(왼쪽.ball.pointDetailAt(0).angle).toBe(보통.direction + 1)
    expect(오른쪽.ball.pointDetailAt(0).angle).toBe(보통.direction - 1)
    // 앙각을 낮춰(줄인 거리) 수평 속도가 보통 송구보다 빠르고, 받는 점에 닿기 전에 땅에 떨어진다
    expect(왼쪽.ball.pointDetailAt(0).speed).toBeGreaterThan(보통.horizontalSpeed)
    const T = throwTicksTo(중견수, 홈)
    expect(왼쪽.ball.landingTick).toBeLessThan(T)
    expect(왼쪽.ball.pointAt(T - 1)).not.toEqual({ x: 홈.x, y: 1000, z: 홈.z })
    expect(forecastOptionsOf(왼쪽, 8, 1).secondPass).toEqual({ movable: true })
  })
})
