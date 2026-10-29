import { useMemo } from 'react'
import { NARI_YEAR_START_EVENT, nextEventFor, placeTriggerOf } from '@/entities/story/model/storyScene'
import { EMPTY_OUTING_PLACE_SLOTS, outingPlaceSlotsOf, outingSlotPlaceIdsOf } from '@/pages/outing-map/lib/outingPlaceSlots'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { useOnRenderChange } from '@/shared/lib/renderMachine/useOnRenderChange'
import { useHeldWhileSame } from '@/shared/lib/renderMachine/useHeldWhileSame'
import { type CareerStoryScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { outingReentryCountAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { advanceOutingMapEntries, isOutingMapEntry } from '@/app/model/careerSession/outing/outingMapEntry'

/**
 * 외출 지도 [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 → 0x8cdc0 이 **들어설 때 한 번** 찍은 값(`outingPlaceSlotsOf`). 지도 그림
 * 0x7ed6c 의 [!] 와 [들어가기] 0x8ce58 이 모두 이 값을 쓴다. 웹 화면이 112 진입이 되는 때(`isOutingMapEntry`):
 * 밖에서 '외출' 로 들어옴 · 이벤트 '외출진입'(원본은 112 진입 다음 폴링 0x1cf9c 가 찾는다) · 그 이벤트에서 '외출' 로 돌아옴(`뒤 112`)
 * · 이벤트 '대결결과'(105 진입 0x11910 의 0x11bb2 가 0x118e4 를 부르고 140). 장소 이벤트('장소')에서 돌아오는 길은 113 이라 안 찍는다.
 * 이벤트 본문이 아직 안 왔으면 오는 때 찍는다. 세션에서 한 번만 부른다(그림 차례 상태 기계를 든다).
 */
export function useOutingSlots(scope: CareerStoryScope) {
  const { atoms, screen, story } = scope
  const career = useShownCareer(scope)
  const outingMapEntries = useRenderMachine(advanceOutingMapEntries, screen).count
  // 0x8cdc0 은 찍고 나서 reader+0x28 = 0 (`rewindCursor`) — 다음 훑기는 처음부터다. 들어선 그 그림에서
  const { rewindCursor } = story
  useOnRenderChange(screen, (next, previous) => {
    if (isOutingMapEntry(previous, next)) rewindCursor()
  })
  const outingEntryCount = outingMapEntries + useCareerValue(atoms, outingReentryCountAtom)
  // 찍는 그림의 커리어 — 진입 · 이벤트 본문이 바뀐 그림의 것을 든다(머무는 동안 커리어가 바뀌어도 다시 안 찍는다)
  const slotsCareer = useHeldWhileSame(career, [outingEntryCount, story.events])
  const outingSlots = useMemo(() => {
    const events = story.events
    if (outingEntryCount === 0 || slotsCareer === null || events === null) return EMPTY_OUTING_PLACE_SLOTS
    return outingPlaceSlotsOf((placeFrame) => nextEventFor(slotsCareer, events, placeTriggerOf(placeFrame)))
  }, [outingEntryCount, story.events, slotsCareer])
  const eventPlaceIds = useMemo(() => outingSlotPlaceIdsOf(outingSlots), [outingSlots])
  /** 재생기에 넘기는 목록 — 파일 이벤트 뒤에 연초 115 내장 이벤트를 붙인다 (훑기는 파일 것만 본다, 투수편과 같다) */
  const storyEvents = useMemo(() => (story.events === null ? null : [...story.events, NARI_YEAR_START_EVENT]), [story.events])
  return { outingSlots, eventPlaceIds, storyEvents }
}
