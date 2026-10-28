import { describe, expect, it } from 'vitest'
import {
  BASE_POINTS,
  DOT_OFFSET,
  MAP_ANCHOR,
  MAP_SCALE,
  PITCHER_PLATE,
  WORLD,
  dotCenterOf,
  mapFrameTopLeftOf,
  runnerDotsOf,
  toMapPoint,
} from '@/pages/defense/lib/fieldMap'

/** 수비 화면 작은 지도 (0x395f4 — 부르는 곳 0x46e02, 앵커 (0x1e, 0x1e)) */

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
    expect(dotCenterOf(BASE_POINTS.home, anchor)).toEqual({ x: 1, y: 25 })
    expect(dotCenterOf(BASE_POINTS.first, anchor)).toEqual({ x: 23, y: 2 })
    expect(dotCenterOf(BASE_POINTS.second, anchor)).toEqual({ x: 1, y: -20 })
    expect(dotCenterOf(BASE_POINTS.third, anchor)).toEqual({ x: -21, y: 2 })
  })

  it('보정 (1, 4) 가 그대로 더해진다 (0x39796)', () => {
    const plate = toMapPoint(PITCHER_PLATE)
    const second = toMapPoint(BASE_POINTS.second)
    expect(dotCenterOf(BASE_POINTS.second, { x: 0, y: 0 })).toEqual({
      x: second.x - plate.x + DOT_OFFSET.x,
      y: second.y - plate.y + DOT_OFFSET.y,
    })
  })

  it('앵커는 (30, 30) — 바탕 프레임 9 왼쪽 위는 (1, 2)', () => {
    expect(MAP_ANCHOR).toEqual({ x: 30, y: 30 })
    expect(mapFrameTopLeftOf()).toEqual({ x: 1, y: 2 })
  })

  it('점 그림(13×11)은 중심에서 (6, 5) 당겨 놓고, 처리 끝(+0x96) 주자는 건너뛴다', () => {
    expect(runnerDotsOf([{ ...BASE_POINTS.first }, { ...BASE_POINTS.second, isFinished: true }, { ...BASE_POINTS.home }])).toEqual([
      { x: 30 + 23 - 6, y: 30 + 2 - 5 },
      { x: 30 + 1 - 6, y: 30 + 25 - 5 },
    ])
  })
})
