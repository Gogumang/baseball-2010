import { describe, expect, it } from 'vitest'
import { placeLabelTopLeftOf } from '@/pages/outing-map/lib/placeLabelPosition'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'

describe('외출 지도 장소 이름 자리 (0x7eb66 · F-2 2-4)', () => {
  it('박스 0 에 정렬 0x22 로 놓고 지도 세로 오프셋(MAP_TOP)은 더하지 않는다', () => {
    const 경기장 = OUTING_PLACES[0] // 이름 박스 (92,166,39,16)
    expect(placeLabelTopLeftOf(경기장.nameBox, 30, 10)).toEqual({ x: 92 + 4, y: 166 + 3 })
  })

  it('가로는 내림(>>1), 세로는 홀수 차이면 1 을 더 내린다', () => {
    const box = { x: 0, y: 0, width: 31, height: 13 }
    expect(placeLabelTopLeftOf(box, 20, 10)).toEqual({ x: 5, y: 2 })
  })
})
