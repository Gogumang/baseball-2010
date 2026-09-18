import { describe, expect, it } from 'vitest'
import { RADAR_CENTER, radarLabelBoxOf, radarPointOf, abilityColorOf } from '@/pages/management/lib/basicInfoLayout'

describe('기본정보 레이더 차트 — 0x5a990', () => {
  it('중심 (178,104), 반지름 30, 값 999 면 축 끝이다', () => {
    expect(RADAR_CENTER).toEqual({ x: 178, y: 104 })
    expect(radarPointOf(0, 0)).toEqual(RADAR_CENTER)
    const hit = radarPointOf(0, 999)
    expect([hit.x < RADAR_CENTER.x, hit.y < RADAR_CENTER.y]).toEqual([true, true])
  })

  it('꼭짓점 거리는 floor(값×30/999) — 500 이면 15', () => {
    // 15 × cos45° ≈ 10.6 → 11 (축마다 반올림)
    expect(radarPointOf(1, 500)).toEqual({ x: 189, y: 93 })
  })

  it('축 이름 상자 위치는 layout-re 계산값과 같다', () => {
    expect([0, 1, 2, 3].map(radarLabelBoxOf)).toEqual([
      { x: 120, y: 43 }, { x: 211, y: 43 }, { x: 211, y: 137 }, { x: 120, y: 137 },
    ])
  })

  it('기본값보다 표시값이 크면 초록, 작으면 빨강 (0x7c008)', () => {
    expect([abilityColorOf(500, 550), abilityColorOf(500, 400), abilityColorOf(500, 500)]).toEqual(['#00FF40', '#FF0000', null])
  })
})
