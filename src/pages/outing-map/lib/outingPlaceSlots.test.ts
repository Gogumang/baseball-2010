import { describe, expect, it } from 'vitest'
import { outingPlaceSlotsOf, outingSlotPlaceIdsOf } from '@/pages/outing-map/lib/outingPlaceSlots'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'

describe('외출 지도 [!] 칸 0x8cdc0', () => {
  it('장소마다 배정 이벤트 번호를 찍고, 없는 장소는 칸이 비어 [!] 가 없다', () => {
    const [첫곳, 둘째곳] = OUTING_PLACES
    const slots = outingPlaceSlotsOf((placeFrame) => (placeFrame === 첫곳.frame ? { id: 230 } : null))
    expect(slots.get(첫곳.id)).toBe(230)
    expect(slots.has(둘째곳.id)).toBe(false)
    expect([...outingSlotPlaceIdsOf(slots)]).toEqual([첫곳.id])
  })
})
