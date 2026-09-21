import { describe, expect, it } from 'vitest'
import {
  BASE_POINTS, DOT_OFFSET, MAP_ANCHOR, MAP_SCALE, PITCHER_PLATE, WORLD,
  dotCenterOf, runnerDotsOf, toMapPoint,
} from '@/widgets/batting-stage/lib/fieldMap'

/**
 * 작은 지도 (0x395f4 — R3 1-4 · R15 6절 · S10 6절).
 * 배율·루 좌표·보정값은 원본 값이고, 앵커만 근사다.
 */

describe('작은 지도 투영 — 배율 40000×32500 → 148×142', () => {
  it('투수판 (20000, 24500) 은 칸 (74, 107) 로 간다', () => {
    expect(toMapPoint(PITCHER_PLATE)).toEqual({ x: 74, y: 107 })
  })

  it('월드 오른쪽·아래 끝은 지도 칸을 넘지 않는다', () => {
    const corner = toMapPoint({ x: WORLD.width - 1, z: WORLD.height - 1 })
    expect(corner.x).toBeLessThan(MAP_SCALE.width)
    expect(corner.y).toBeLessThan(MAP_SCALE.height)
  })

  it('원본 0xb94cc 처럼 내림 나눗셈이다 — 2루 y 는 83.76 이 아니라 83 이다', () => {
    expect(toMapPoint(BASE_POINTS.second).y).toBe(83)
  })
})

describe('주자 점 자리 — 투수판 기준 상대좌표 + (1, 4)', () => {
  it('네 루가 투수판을 가운데 둔 마름모를 이룬다', () => {
    const anchor = { x: 0, y: 0 }
    expect(dotCenterOf('home', anchor)).toEqual({ x: 1, y: 25 })
    expect(dotCenterOf('first', anchor)).toEqual({ x: 23, y: 2 })
    expect(dotCenterOf('second', anchor)).toEqual({ x: 1, y: -20 })
    expect(dotCenterOf('third', anchor)).toEqual({ x: -21, y: 2 })
  })

  it('보정 (1, 4) 가 그대로 더해진다 (0x39796)', () => {
    const plate = toMapPoint(PITCHER_PLATE)
    const second = toMapPoint(BASE_POINTS.second)
    expect(dotCenterOf('second', { x: 0, y: 0 })).toEqual({
      x: second.x - plate.x + DOT_OFFSET.x,
      y: second.y - plate.y + DOT_OFFSET.y,
    })
  })

  it('앵커 근사값에서도 점이 화면 240×320 안에 들어온다', () => {
    for (const base of ['first', 'second', 'third'] as const) {
      const center = dotCenterOf(base)
      expect(center.x).toBeGreaterThanOrEqual(0)
      expect(center.x).toBeLessThan(240)
      expect(center.y).toBeGreaterThanOrEqual(0)
      expect(center.y).toBeLessThan(320)
    }
    // 프레임 9 상자 (앵커 + 원점 (−29,−28), 61×59) 와 테 2px 이 화면 오른쪽 위에 들어간다
    expect(MAP_ANCHOR.x - 29 - 2).toBeGreaterThanOrEqual(0)
    expect(MAP_ANCHOR.x - 29 + 61 + 2).toBeLessThanOrEqual(240)
    expect(MAP_ANCHOR.y - 28 - 2).toBeGreaterThanOrEqual(0)
  })
})

describe('루상 주자 목록', () => {
  it('찬 루만 찍는다', () => {
    expect(runnerDotsOf({ first: true, second: false, third: true })).toEqual(['first', 'third'])
    expect(runnerDotsOf({ first: false, second: false, third: false })).toEqual([])
  })
})
