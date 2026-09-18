import { describe, expect, it } from 'vitest'
import {
  ZONE_CENTERS,
  bendControlPoints,
  isMirroredForm,
  pitchPathOf,
  pitchRecordOf,
  projectToPlate,
  projectToScreen,
} from '@/entities/pitching/model/pitchCurve'

describe('투구 곡선과 투영 — 0x4dc78 · 0xbe3d8 (위치 분석 2·5차)', () => {
  it('존 중심은 투영하면 기준점(0xcfb54)과 맞는다 — side1 은 (237, 325), 화면 (117, 255)', () => {
    expect(projectToPlate(ZONE_CENTERS[1], 1)).toEqual({ x: 237, y: 325 })
    expect(projectToScreen(ZONE_CENTERS[1], 1)).toEqual({ x: 117, y: 255 })
    expect(projectToScreen(ZONE_CENTERS[0], 0)).toEqual({ x: 122, y: 255 })
  })

  it('반전 없는 발사점 (19501, 1110, 24500) 은 side1 화면 (73, 167)', () => {
    expect(projectToScreen({ x: 19501, y: 1110, z: 24500 }, 1)).toEqual({ x: 73, y: 167 })
  })

  it('폼 1·3·5·6 은 좌우 반전, 홀수 폼(≤5)은 한 칸 앞 폼의 레코드를 쓴다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(isMirroredForm)).toEqual([false, true, false, true, false, true, true, false])
    expect(pitchRecordOf(1, 1, 0)).toEqual(pitchRecordOf(1, 0, 0))
  })

  it('레코드는 같은 폼 안에서 구속 단계 k 번째다 — 직구 폼0 은 N 18/16/14/12', () => {
    expect([0, 1, 2, 3].map((stage) => pitchRecordOf(1, 0, stage).frames)).toEqual([18, 16, 14, 12])
  })

  it('휘기 보정은 가운데 제어점만 옮기고 마지막 점은 목표점이 된다', () => {
    const points = [
      { x: 19501, y: 1110, z: 24500 },
      { x: 19101, y: 1190, z: 28369 },
      { x: 20000, y: 1242, z: 29705 },
    ]
    const target = { x: 20585, y: 1202, z: 29705 }

    const bent = bendControlPoints(points, target)

    expect(bent[0]).toEqual(points[0])
    expect(bent[2]).toEqual(target)
    expect(bent[1].x).toBeGreaterThan(points[1].x)
    expect(bent[1].z).toBe(points[1].z)
  })

  it('경로는 N 점이고 첫 점은 발사점, 마지막 점은 목표점이다', () => {
    const target = { x: 20585, y: 1202, z: 29705 }
    const path = pitchPathOf({ typeNumber: 1, form: 0, speedStage: 0, target })

    expect(path).toHaveLength(18)
    expect(path[0]).toEqual({ x: 19501, y: 1110, z: 24500 })
    expect(path[17]).toEqual(target)
  })
})
