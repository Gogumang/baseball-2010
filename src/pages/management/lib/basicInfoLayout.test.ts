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
    // 15 × 46340 >> 16 = 10 · −15 × 46340 >> 16 = −11 (산술 시프트 0x76250)
    expect(radarPointOf(1, 500)).toEqual({ x: 188, y: 93 })
  })

  it('값이 0 이 아니면 길이는 최소 3 이다 (0x7626e) — 50 은 1 이 아니라 3', () => {
    expect(radarPointOf(1, 50)).toEqual({ x: 178 + 2, y: 104 - 3 })
    expect(radarPointOf(1, 0)).toEqual(RADAR_CENTER)
  })

  it('축 이름 상자 — 기준점은 (R + 18)·표 >> 16 (0x5ac00~0x5ac1e), 양수 쪽이 1 작다', () => {
    expect([0, 1, 2, 3].map(radarLabelBoxOf)).toEqual([
      { x: 120, y: 43 }, { x: 210, y: 43 }, { x: 210, y: 136 }, { x: 120, y: 136 },
    ])
  })

  it('기본값보다 표시값이 크면 초록, 작으면 빨강 (0x7c008)', () => {
    expect([abilityColorOf(500, 550), abilityColorOf(500, 400), abilityColorOf(500, 500)]).toEqual(['#00FF40', '#FF0000', null])
  })
})
