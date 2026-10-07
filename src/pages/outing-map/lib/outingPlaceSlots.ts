import { OUTING_PLACES } from '@/shared/config/outingPlaces'

/**
 * **외출 지도 [!] 칸 [gfx+0x9c + 2i]** — 장소 i(0..4)에 배정된 이벤트 번호 (0 = 없음). 직접 떴다:
 * ```
 * 0x118e4 (112 진입 — 0x1cdec 의 상태 들어옴, 그리고 105 진입 0x11910 의 140 대결결과 갈래 0x11bb2)
 *   0x7f49d(지도 적재) → 0x8cdc0(장면)
 * 0x8cdc0  0x7fed5(gfx) 로 다섯 칸을 비우고, reader+0x28 = 0 부터 끝까지 acfbc(reader, 0x71, −1) 를 통과한 이벤트마다
 *          k = trigger − 2 칸이 비었으면(0x7fef5) 번호를 넣는다(0x7fee9) → 장소마다 파일 순서 첫 이벤트. 끝에 reader+0x28 = 0
 * 0x7ed6c  지도 그림은 칸 ≠ 0 인 장소마다 [!] — 다시 재지 않는다
 * 0x8ce58  113 [들어가기] 는 [gfx+0x184](고른 장소) 칸의 번호를 0x8bdc8 로 부른다 — 다시 훑지 않는다
 * ```
 * 칸을 쓰는 곳은 0x8cdc0 하나뿐이라(0x7fed5 · 0x7fee9 xref 하나씩) **112 에 들어설 때 한 번 찍은 값**을 다음 112 진입까지
 * 그리기([!])와 [들어가기]가 함께 쓴다 — 장소(113)에서 돌아오는 길(빈 장소 `[다음 114, 뒤 113]`)은 112 진입이 아니라 다시 찍지 않는다.
 */
export type OutingPlaceSlots = ReadonlyMap<string, number>

/** 0x8cdc0 — 장소마다 `eventOf(장소 프레임)` (파일 순서 첫 통과 이벤트)의 번호를 찍는다 */
export function outingPlaceSlotsOf(eventOf: (placeFrame: number) => { readonly id: number } | null): OutingPlaceSlots {
  const slots = new Map<string, number>()
  OUTING_PLACES.forEach((place) => {
    const event = eventOf(place.frame)
    if (event !== null) slots.set(place.id, event.id)
  })
  return slots
}

/** 0x7ed6c — 칸 ≠ 0 인 장소 */
export function outingSlotPlaceIdsOf(slots: OutingPlaceSlots): ReadonlySet<string> {
  return new Set(slots.keys())
}

export const EMPTY_OUTING_PLACE_SLOTS: OutingPlaceSlots = new Map()
