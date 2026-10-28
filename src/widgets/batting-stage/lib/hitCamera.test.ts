import { describe, expect, it } from 'vitest'
import { projectToPlate } from '@/entities/pitching/model/pitchCurve'
import type { HitBallPath } from '@/widgets/batting-stage/lib/hitBallPath'
import { STAGE_CAMERA_HOME, approachCameraAxis, hitCameraAngleOf, hitCameraAt, stageCameraShiftOf } from '@/widgets/batting-stage/lib/hitCamera'

/** 타격점에서 투수판 너머로 날아가는 공 — 높이가 오르며 깊이가 줄어든다 */
const flyingPath: HitBallPath = {
  points: Array.from({ length: 40 }, (_, index) => ({ x: 20000 + index * 60, y: 1000 + index * 120, z: 30000 - index * 300 })),
  groundIndex: -1,
}

describe('0xbce91 approachCameraAxis', () => {
  it('같으면 그대로', () => {
    expect(approachCameraAxis(120, 120, 30)).toBe(120)
  })
  it('% 가 0 이어도 목표 쪽으로 1 은 간다 (bceb0 · bceb4)', () => {
    expect(approachCameraAxis(120, 200, 0)).toBe(121)
    expect(approachCameraAxis(120, 40, 0)).toBe(119)
  })
  it('trunc(% × 차 / 100) ± 1 — 0 쪽으로 자른다', () => {
    // 30 × 80 / 100 = 24 → +1 = 25
    expect(approachCameraAxis(120, 200, 30)).toBe(145)
    // 30 × −81 / 100 = −24.3 → −24 → −1 = −25
    expect(approachCameraAxis(120, 39, 30)).toBe(95)
  })
  it('목표와 1 차이로 닿으면 목표로 붙인다 (bcebc~bceca)', () => {
    expect(approachCameraAxis(120, 122, 0)).toBe(122)
  })
  it('% == 100 이면 목표로 (bcec6)', () => {
    expect(approachCameraAxis(0, 77, 100)).toBe(77)
  })
})

describe('0x3f060 3f1dc~3f2d8 hitCameraAt', () => {
  it('판 패턴 각은 부호를 뒤집어 [+0xfcc] 가 된다', () => {
    expect(hitCameraAngleOf(90)).toBe(-90)
  })

  it('틱 0 은 공 틱 0 · 1 이 같은 점이라 % 0 — 한 칸만 다가간다', () => {
    const p = projectToPlate(flyingPath.points[0], 0)
    const camera = hitCameraAt({ path: flyingPath, side: 0, angle: -90, releaseTick: null }, 0)
    const targetX = p.x - STAGE_CAMERA_HOME.x
    const targetY = p.y - STAGE_CAMERA_HOME.y
    expect(camera.x).toBe(Math.max(0, Math.min(240, STAGE_CAMERA_HOME.x + Math.sign(targetX - STAGE_CAMERA_HOME.x))))
    expect(camera.y).toBe(Math.max(0, Math.min(70, STAGE_CAMERA_HOME.y + Math.sign(targetY - STAGE_CAMERA_HOME.y))))
  })

  it('큰 타구는 막음이 풀린 그림(틱 r)까지 가운데 그대로 — 틀 머리 3f1ea', () => {
    for (let tick = 0; tick <= 7; tick += 1) {
      expect(hitCameraAt({ path: flyingPath, side: 0, angle: -90, releaseTick: 7 }, tick)).toEqual(STAGE_CAMERA_HOME)
    }
    expect(hitCameraAt({ path: flyingPath, side: 0, angle: -90, releaseTick: 7 }, 8)).not.toEqual(STAGE_CAMERA_HOME)
  })

  it('각이 −180 < a < 0 밖이면 따라가지 않고 가로 자르기만 한다', () => {
    // 우타 · a + 90 ≥ 0 → min(x, 350): 가운데 120 그대로
    expect(hitCameraAt({ path: flyingPath, side: 0, angle: 10, releaseTick: null }, 20)).toEqual(STAGE_CAMERA_HOME)
    // 우타 · a < −90 → max(x, 80): 120 그대로
    expect(hitCameraAt({ path: flyingPath, side: 0, angle: -200, releaseTick: null }, 20)).toEqual(STAGE_CAMERA_HOME)
  })

  it('세계 안(0~240 · 0~70)으로 잘린다 — vt+0x30 0xc062c', () => {
    for (let tick = 0; tick < 40; tick += 1) {
      const camera = hitCameraAt({ path: flyingPath, side: 1, angle: -60, releaseTick: null }, tick)
      expect(camera.x).toBeGreaterThanOrEqual(0)
      expect(camera.x).toBeLessThanOrEqual(170)
      expect(camera.y).toBeGreaterThanOrEqual(0)
      expect(camera.y).toBeLessThanOrEqual(70)
    }
  })

  it('옮김 = 가운데 − 카메라', () => {
    expect(stageCameraShiftOf(null)).toEqual({ dx: 0, dy: 0 })
    expect(stageCameraShiftOf({ x: 100, y: 50 })).toEqual({ dx: 20, dy: 20 })
  })
})
