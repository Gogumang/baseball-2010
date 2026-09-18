import { describe, expect, it } from 'vitest'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'

/** layout-re 가 ui/event_map.pzx 프레임 1~5 의 파트·박스를 바이트로 읽은 값 */
describe('외출 지도 배치 — event_map 프레임 1~5', () => {
  it('건물 그림 위치는 프레임 파트 좌표 그대로다', () => {
    expect(OUTING_PLACES.map((place) => [place.name, place.frame, place.left, place.top])).toEqual([
      ['경기장', 1, 64, 119],
      ['번화가', 2, 127, 77],
      ['병원', 3, 0, 84],
      ['학교', 4, 179, 143],
      ['방송국', 5, 78, 209],
    ])
  })

  it('이름 그림은 img_text 229~233 이고 박스 0 에 들어간다', () => {
    expect(OUTING_PLACES.map((place) => place.labelFrame)).toEqual([229, 230, 231, 232, 233])
    expect(OUTING_PLACES[0].nameBox).toEqual({ x: 92, y: 166, width: 39, height: 16 })
  })

  it('소지금·필요 인기도는 원본 표 0xcc344 · 0xcc402 (100만 단위 → 만원)', () => {
    const effects = OUTING_PLACES.flatMap((place) => place.functions).map((f) => [f.id, f.effect.moneyCost, f.requiredPopularity])
    expect(effects).toEqual([
      ['팬미팅', 500, 600],
      ['외식', 100, 0],
      ['입원', 200, 0],
      ['야구교실', 0, 200],
      ['CF촬영', -800, 400],
    ])
  })

  it('[!] 자리(박스 2)와 선택 화살표 자리(박스 1)가 있다', () => {
    expect(OUTING_PLACES[4].markerBox).toEqual({ x: 145, y: 261, width: 23, height: 27 })
    expect(OUTING_PLACES[2].cursorBox).toEqual({ x: 31, y: 88, width: 26, height: 22 })
  })
})
