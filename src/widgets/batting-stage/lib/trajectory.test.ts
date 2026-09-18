import { describe, expect, it } from 'vitest'
import { ballFrameIndexAt, ballPixelAt, platePixelOf, RELEASE_PIXEL } from '@/widgets/batting-stage/lib/trajectory'
import { toPixel } from '@/widgets/batting-stage/lib/stageLayout'
import type { Pitch } from '@/entities/pitching/model/pitch'

const 커브: Pitch = {
  type: 'CURVE',
  plate: { x: 0, y: -0.6 },
  breakOffset: { x: 0, y: -0.7 },
  flightDurationMilliseconds: 20 * 62,
  frameCount: 20,
  controlTier: 3,
  worldPath: null,
  stageSide: 1,
}

describe('ballPixelAt — 한 틱에 곡선 점 하나 (0xbcc6c 정수 베지어)', () => {
  it('첫 점은 릴리스 지점, 마지막 점(N−1)은 플레이트 통과 지점이다', () => {
    expect(ballPixelAt(커브, 0)).toEqual(RELEASE_PIXEL)
    const plate = toPixel(커브.plate)
    const last = ballPixelAt(커브, 19)
    expect(last.x).toBeCloseTo(plate.x, 0)
    expect(last.y).toBeCloseTo(plate.y, 0)
  })

  it('N−1 을 넘으면 플레이트에 머문다', () => {
    expect(ballPixelAt(커브, 30)).toEqual(ballPixelAt(커브, 19))
  })

  it('떨어지는 공은 중간에 도착점보다 위(화면 y 작음)를 지난다', () => {
    const middle = ballPixelAt(커브, 10)
    expect(middle.y).toBeLessThan(toPixel(커브.plate).y)
  })
})

const 원본직구: Pitch = {
  ...커브,
  type: 'FASTBALL',
  frameCount: 3,
  worldPath: [
    { x: 19501, y: 1110, z: 24500 },
    { x: 20000, y: 1150, z: 27000 },
    { x: 20585, y: 1202, z: 29705 },
  ],
  stageSide: 1,
}

describe('원본 궤적이 있으면 점마다 투영한다 (0xbe3d8)', () => {
  it('발사점은 (73, 167), 도착점은 존 중심 (117, 255)', () => {
    expect(ballPixelAt(원본직구, 0)).toEqual({ x: 73, y: 167 })
    expect(ballPixelAt(원본직구, 2)).toEqual({ x: 117, y: 255 })
    expect(platePixelOf(원본직구)).toEqual({ x: 117, y: 255 })
  })

  it('공 그림은 깊이 비율 2~9 칸이다 (0x358fc)', () => {
    expect([0, 1, 2].map((frame) => ballFrameIndexAt(원본직구, frame))).toEqual([2, 4, 9])
  })
})

describe('궤적이 없는 공의 그림 칸', () => {
  it('다가올수록 큰 그림(2→9)', () => {
    expect(ballFrameIndexAt(커브, 0)).toBe(2)
    expect(ballFrameIndexAt(커브, 19)).toBe(9)
  })
})

describe('타석 화면 규격', () => {
  it('원작 피처폰 해상도 240×320을 쓴다', async () => {
    const { STAGE_WIDTH, STAGE_HEIGHT } = await import('@/widgets/batting-stage/lib/renderBattingStage')

    expect(STAGE_WIDTH).toBe(240)
    expect(STAGE_HEIGHT).toBe(320)
  })
})
