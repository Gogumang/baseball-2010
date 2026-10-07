import { describe, expect, it } from 'vitest'
import { NIGHT_DIM_STEP, OUTING_MAP_ORIGIN, outingMapUnderlayLayoutOf } from '@/pages/management/lib/outingMapUnderlay'

describe('이벤트 대화창 0x8b5ac 의 지도 갈래 — 0x7ea64(gfx, −1, 0)', () => {
  it('지도 원점은 (0, 11) — 프레임 0(240×297) 가운데 정렬', () => {
    expect(OUTING_MAP_ORIGIN).toEqual({ x: 0, y: 11 })
  })

  it('이름은 박스 0 에 정렬 0x22 — mapY 를 안 더하고, 테두리 그림이라 1px 왼쪽 위', () => {
    const { labels } = outingMapUnderlayLayoutOf(12)
    // 경기장 박스 (92,166,39,16) · 글 31×10 → x 92 + 4 · y 166 + 3
    expect(labels[0]).toEqual({ frame: 229, left: 95, top: 168 })
    // 병원 박스 (7,137,30,13) · 글 20×10 → d = 3 이면 1 + 1 = 2 내린다
    expect(labels[2]).toEqual({ frame: 231, left: 11, top: 138 })
  })

  it('[!] 기준점 — 박스 2 의 (mapX + x + w>>1, mapY + y)', () => {
    expect(outingMapUnderlayLayoutOf(12).markers[0]).toEqual({ placeId: 'stadium', x: 141, y: 167 })
  })

  it('밤(시간대 2 = 20~5시)만 단계 9 로 어둡게 — 9/16 남긴다', () => {
    expect([5, 6, 15, 16, 19, 20].map((hour) => outingMapUnderlayLayoutOf(hour).isNight)).toEqual([true, false, false, false, false, true])
    expect(NIGHT_DIM_STEP).toBe(9)
    expect(outingMapUnderlayLayoutOf(0).nightDim).toBeCloseTo(7 / 16)
  })
})
