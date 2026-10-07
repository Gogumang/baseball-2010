import { describe, expect, it } from 'vitest'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import { throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
/** 늘 같은 값을 내는 난수 — 0.999 면 악송구 · 흔들림 굴림이 모두 빗나간다 */
const 고정 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (min, max) => min + Math.floor(value * (max - min)),
  pick: (candidates) => candidates[0],
})

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
    const 세는난수: RandomPort = {
      next: () => {
        굴림 += 1
        return 0
      },
      nextInRange: (min) => {
        굴림 += 1
        return min
      },
      pick: (candidates) => candidates[0],
    }
    const 투수 = { ...야수들[0], throwSpeed: 2000 }
    const 홈 = basePosition(0)
    const 이루 = basePosition(2)
    const 공 = launchThrow({ thrower: { ...투수, position: 이루 }, target: 홈, laser: true, ability: 500, random: 세는난수 })

    expect(굴림).toBe(0)
    expect(공.ball.pointAt(throwTicksTo({ ...투수, position: 이루 }, 홈) - 1)).toEqual({ x: 홈.x, y: 1000, z: 홈.z })
  })
})
