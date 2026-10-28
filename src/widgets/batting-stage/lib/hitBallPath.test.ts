import { describe, expect, it } from 'vitest'
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { hitBallPathOf, hitBallPixelAt, hitBallSizeOf, hitBallTickOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { ballShadowOfPoint } from '@/widgets/batting-stage/lib/trajectory'

/**
 * 0x33e34(경로 다시 채우기) · 0x358fc(0x13 크기) · 0x35854(화면 점)를 unicorn 으로 그대로 돌린 값
 * (docs `_raw/verify/r274_emu_hit_path.py` — 투영기 [+0x218] = 0xbe3d8 (20000, 3470, 31500) · 27° · F 146, 타석 카메라 (−120, −70)).
 * 줄 = [손, 공 물리 x, y, z, 경로 x, y, z, 크기, 화면 x, 화면 y]
 */
const EMULATED: readonly (readonly number[])[] = [
  [0, 20000, 1000, 30000, 19252, 600, 29062, 8, 123, 249],
  [0, 20200, 1500, 29000, 19513, 1100, 28314, 7, 137, 213],
  [0, 20500, 2600, 27500, 19895, 2200, 27115, 5, 153, 161],
  [0, 21000, 4200, 25000, 20502, 3800, 25023, 2, 169, 105],
  [0, 21800, 6000, 21000, 21445, 5600, 21657, 2, 184, 70],
  [0, 23000, 7500, 16000, 22890, 7100, 17714, 2, 198, 59],
  [0, 24500, 6800, 10000, 24866, 6400, 13875, 2, 208, 81],
  [0, 26000, 3000, 5000, 26963, 2600, 11221, 2, 214, 122],
  [0, 27000, 400, 2500, 28307, 240, 9696, 2, 218, 140],
  [0, 27100, 0, 2300, 28436, 0, 9555, 2, 218, 142],
  [0, 19000, 600, 29500, 17962, 360, 28714, 8, 75, 244],
  [0, 18000, 0, 28000, 16653, 0, 27673, 6, 51, 228],
  [0, 17000, 0, 26000, 15358, 0, 26263, 3, 40, 205],
  [0, 15500, 300, 23000, 13431, 180, 24123, 2, 29, 181],
  [0, 20000, 999, 30000, 19252, 599, 29062, 8, 123, 249],
  [0, 20000, 1000, 24500, 19251, 600, 25117, 2, 140, 182],
  [0, 20000, 1399, 29705, 19258, 999, 28834, 8, 123, 229],
  [0, 25000, 12000, 15000, 25050, 11600, 16047, 2, 234, -17],
  [0, 9000, 2000, 8000, 5114, 1600, 13340, 2, 20, 133],
  [0, 31000, 500, 12000, 33466, 300, 16354, 2, 296, 149],
  [1, 20000, 1000, 30000, 20748, 600, 29062, 8, 116, 249],
  [1, 20200, 1500, 29000, 20994, 1100, 28314, 7, 122, 213],
  [1, 20500, 2600, 27500, 21346, 2200, 27115, 5, 129, 161],
  [1, 21000, 4200, 25000, 21917, 3800, 25023, 2, 136, 105],
  [1, 21800, 6000, 21000, 22838, 5600, 21657, 2, 139, 70],
  [1, 23000, 7500, 16000, 24291, 7100, 17714, 2, 145, 59],
  [1, 24500, 6800, 10000, 26320, 6400, 13875, 2, 151, 81],
  [1, 26000, 3000, 5000, 28468, 2600, 11221, 2, 154, 122],
  [1, 27000, 400, 2500, 29822, 240, 9696, 2, 156, 140],
  [1, 27100, 0, 2300, 29952, 0, 9555, 2, 156, 142],
  [1, 19000, 600, 29500, 19467, 360, 28714, 8, 62, 244],
  [1, 18000, 0, 28000, 18168, 0, 27673, 6, 26, 228],
  [1, 17000, 0, 26000, 16873, 0, 26263, 3, 5, 205],
  [1, 15500, 300, 23000, 14942, 180, 24123, 2, -15, 181],
  [1, 20000, 999, 30000, 20748, 599, 29062, 8, 116, 249],
  [1, 20000, 1000, 24500, 20749, 600, 25117, 2, 99, 182],
  [1, 20000, 1399, 29705, 20742, 999, 28834, 8, 116, 229],
  [1, 25000, 12000, 15000, 26389, 11600, 16047, 2, 181, -17],
  [1, 9000, 2000, 8000, 6617, 1600, 13340, 2, -39, 133],
  [1, 31000, 500, 12000, 34979, 300, 16354, 2, 239, 149],
]

const BALL = EMULATED.filter((row) => row[0] === 0).map(([, x, y, z]) => ({ x: x!, y: y!, z: z! }))
const trajectoryOf = (points: readonly { x: number; y: number; z: number }[]) => ({
  length: points.length,
  pointAt: (tick: number) => points[Math.max(0, Math.min(tick, points.length - 1))]!,
})

describe('0x13 타구 공 경로 0x33e34 — unicorn 대조 (r274)', () => {
  it('경로 점 · 크기 · 화면 자리가 원본과 같다 (우타 · 좌타 20 점씩)', () => {
    for (const side of [0, 1]) {
      const path = hitBallPathOf(trajectoryOf(BALL), side)
      const rows = EMULATED.filter((row) => row[0] === side)
      rows.forEach(([, , , , px, py, pz, size, sx, sy], index) => {
        expect(path.points[index]).toEqual({ x: px, y: py, z: pz })
        expect(hitBallSizeOf(path.points[index]!)).toBe(size)
        expect(hitBallPixelAt(path, index, side)).toEqual({ x: sx, y: sy })
      })
    }
  })

  it('땅 번호 +0x1090 — 높이가 처음 0 이 된 점(원본 9)', () => {
    expect(hitBallPathOf(trajectoryOf(BALL), 0).groundIndex).toBe(9)
    expect(hitBallPathOf(trajectoryOf([{ x: 20000, y: 5000, z: 20000 }]), 1).groundIndex).toBe(-1)
  })

  it('공 틱 — 0x13 상태 틱 그대로, 큰 타구는 막음이 풀린 그림(틱 7)부터', () => {
    expect(hitBallTickOf(0, null)).toBe(0)
    expect(hitBallTickOf(5, null)).toBe(5)
    expect(hitBallTickOf(5, 7)).toBe(0)
    expect(hitBallTickOf(7, 7)).toBe(0)
    expect(hitBallTickOf(9, 7)).toBe(2)
  })

  it('그림자 — 0x13 은 화면 아래 끝을 안 본다 · 크기 max(공 크기 − 4, 2) · 공 틱 0 이면 없다 (3b388~3b422)', () => {
    const path = hitBallPathOf(trajectoryOf(BALL), 0)
    const point = path.points[0]!
    expect(ballShadowOfPoint(point, hitBallSizeOf(point), 0, true, 0)).toBeNull()
    const shadow = ballShadowOfPoint(point, hitBallSizeOf(point), 0, true, 1)!
    const ground = projectToScreen({ x: point.x, y: 0, z: point.z }, 0)
    expect(shadow).toEqual({ x: projectToScreen(point, 0).x, y: ground.y + 2, size: 4 })
    // 0x11 이면 땅점 y + 크기 ≥ 320 에서 빠진다 — 0x13 은 그린다
    const near = { x: 20000, y: 0, z: 31000 }
    expect(projectToScreen(near, 0).y + 2).toBeGreaterThanOrEqual(320)
    expect(ballShadowOfPoint(near, 9, 0, false, 3)).toBeNull()
    expect(ballShadowOfPoint(near, 9, 0, true, 3)).not.toBeNull()
  })
})
