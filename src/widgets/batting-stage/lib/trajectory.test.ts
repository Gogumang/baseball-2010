import { describe, expect, it } from 'vitest'
import { ballFrameIndexAt, ballKindAt, ballPixelAt, platePixelOf, RELEASE_PIXEL } from '@/widgets/batting-stage/lib/trajectory'
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

describe('마구 공 그림 종류 (경기+0x1080, ball.pzx 종류 3 × 크기 11칸)', () => {
  it('종류 1 은 불꽃 공 011~022, 종류 2 는 날개 공 023~033 칸으로 옮겨진다', () => {
    const 불꽃 = { ...원본직구, ballKind: 1 }
    const 날개 = { ...원본직구, ballKind: 2 }
    expect([0, 1, 2].map((frame) => ballFrameIndexAt(불꽃, frame))).toEqual([13, 15, 20])
    expect([0, 1, 2].map((frame) => ballFrameIndexAt(날개, frame))).toEqual([24, 26, 31])
  })

  it('종류를 안 주면 보통 공(0)이다', () => {
    expect(ballFrameIndexAt(원본직구, 2)).toBe(9)
  })

  it('궤적이 없는 공도 같은 묶음으로 옮겨진다', () => {
    expect(ballFrameIndexAt({ ...커브, ballKind: 2 }, 19)).toBe(9 + 22)
  })
})

describe('날아가는 도중 불꽃 공으로 바뀐다 (0x3b55e, 경로 번호 8 부터)', () => {
  // 궤적 없는 20 틱 공 — 크기 칸은 2→9, 종류 1 이면 +11
  const 마구 = (pitcherMagicNumber: number, pitcherForm: number): Pitch => ({
    ...커브,
    isMagicPitch: true,
    pitcherMagicNumber,
    pitcherForm,
  })
  const 보통칸 = (frame: number) => ballFrameIndexAt(커브, frame)

  it('마구 1 은 경로 7 까지 보통 공, 8 부터 불꽃 공', () => {
    expect(ballKindAt(마구(1, 3), 7)).toBe(0)
    expect(ballKindAt(마구(1, 3), 8)).toBe(1)
    expect(ballFrameIndexAt(마구(1, 3), 7)).toBe(보통칸(7))
    expect(ballFrameIndexAt(마구(1, 3), 8)).toBe(보통칸(8) + 11)
    expect(ballFrameIndexAt(마구(1, 3), 19)).toBe(보통칸(19) + 11)
  })

  it('마구 4 는 폼 묶음 0(폼 0·1)일 때만 불꽃 공이 된다', () => {
    expect(ballKindAt(마구(4, 1), 8)).toBe(1)
    expect(ballKindAt(마구(4, 2), 8)).toBe(0)
  })

  it('구질이 마구가 아니거나 다른 마구 번호면 던질 때 값 그대로다', () => {
    expect(ballKindAt({ ...마구(1, 0), isMagicPitch: false }, 8)).toBe(0)
    expect(ballKindAt(마구(2, 0), 8)).toBe(0)
    expect(ballKindAt({ ...마구(9, 0), ballKind: 1 }, 3)).toBe(1)
  })

  it('원본 궤적이 있는 공도 같은 틱에 바뀐다', () => {
    const path = Array.from({ length: 12 }, (_, index) => ({ x: 20000, y: 1150, z: 24500 + index * 500 }))
    const 궤적마구: Pitch = { ...원본직구, frameCount: path.length, worldPath: path, isMagicPitch: true, pitcherMagicNumber: 1 }
    const 궤적보통: Pitch = { ...궤적마구, isMagicPitch: false }
    expect(ballFrameIndexAt(궤적마구, 7)).toBe(ballFrameIndexAt(궤적보통, 7))
    expect(ballFrameIndexAt(궤적마구, 8)).toBe(ballFrameIndexAt(궤적보통, 8) + 11)
  })
})

describe('타석 화면 규격', () => {
  it('원작 피처폰 해상도 240×320을 쓴다', async () => {
    const { STAGE_WIDTH, STAGE_HEIGHT } = await import('@/widgets/batting-stage/lib/renderBattingStage')

    expect(STAGE_WIDTH).toBe(240)
    expect(STAGE_HEIGHT).toBe(320)
  })
})
