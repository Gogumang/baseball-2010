import { useMemo } from 'react'
import { pitcherPlaceEventOf } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { EMPTY_OUTING_PLACE_SLOTS, outingPlaceSlotsOf, outingSlotPlaceIdsOf } from '@/pages/outing-map/lib/outingPlaceSlots'
import { useHeldWhileSame } from '@/shared/lib/renderMachine/useHeldWhileSame'
import { type PitcherAtoms, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { fileEventsAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { outingEntryCountAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'

/**
 * 외출 지도 [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 → 0x8cdc0 이 장소마다 파일 순서 첫 이벤트(대상 1·3, trigger 2~6)를
 * **들어설 때 한 번** 넣는다(`outingPlaceSlotsOf`). 지도 그림 0x7ed6c 의 [!] 와 [들어가기] 0x8ce58 이 다음 112 진입까지 이 값을 쓴다.
 * 모드 갈림이 없는 코드라 판정만 투수 갈래(`pitcherStoryScene`)로 본다. 무작위는 굴리지 않는다.
 * 이벤트 본문이 아직 안 왔으면 오는 때 찍는다. 세션에서 한 번만 부른다(그림 차례 상태 기계를 든다).
 */
export function useOutingSlots(atoms: PitcherAtoms) {
  const career = usePitcherValue(atoms, careerAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const outingEntryCount = usePitcherValue(atoms, outingEntryCountAtom)
  // 찍는 그림의 커리어 — 진입 · 이벤트 본문이 바뀐 그림의 것을 든다(머무는 동안 커리어가 바뀌어도 다시 안 찍는다)
  const slotsCareer = useHeldWhileSame(career, [outingEntryCount, fileEvents])
  const outingSlots = useMemo(() => {
    if (outingEntryCount === 0 || slotsCareer === null || fileEvents === null) return EMPTY_OUTING_PLACE_SLOTS
    return outingPlaceSlotsOf((placeFrame) => pitcherPlaceEventOf(slotsCareer, fileEvents, placeFrame))
  }, [outingEntryCount, fileEvents, slotsCareer])
  const eventPlaceIds = useMemo(() => outingSlotPlaceIdsOf(outingSlots), [outingSlots])
  return { outingSlots, eventPlaceIds }
}
