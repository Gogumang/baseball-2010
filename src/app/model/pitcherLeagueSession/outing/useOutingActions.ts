import { useCallback } from 'react'
import { actedAfterOutingMapCancel, outingBlockReasonOf, outingBlockTextOf } from '@/entities/career/model/outing'
import { emptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { OUTING_PLACES, type OutingPlace } from '@/shared/config/outingPlaces'
import type { OutingPlaceSlots } from '@/pages/outing-map/lib/outingPlaceSlots'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { fileEventsAtom, sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  outingEntryActedAtom,
  outingNoticeAtom,
  outingPresentationAtom,
  outingRecoveryNoticeAtom,
  outingResultAtom,
} from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'
import { useOpenStory } from '@/app/model/pitcherLeagueSession/events/useOpenStory'
import { useEnterOutingMap } from '@/app/model/pitcherLeagueSession/outing/useEnterOutingMap'
import { useOutingEffectActions } from '@/app/model/pitcherLeagueSession/outing/useOutingEffectActions'

const outingFunctionOf = (functionId: string) => OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.id === functionId)

/**
 * **외출 (상태 112 지도 → 113 장소 → 126 기능)** — 원본 모드 3 은 타자편과 같은 상태·같은 코드를 돈다
 * (105 칸 3 = 0x126be → 0x70, 진입 0x118e4 · 키 0x13ba4 · 0x16c64 · 효과 0x15234 · 입원 회복 0x1575c 에 모드 갈림 없음).
 * 그래서 지도·장소·효과 표·굴림 차례(인기도 → 평판 → 사기 → 입원이면 질병·부상)를 타자편 `runOuting` 그대로 쓴다.
 * 서브 아이템 5~9(`기록[0x5d+장소]`) 보정도 거기서 붙는다. 외출은 G 를 쓰지 않으므로 지갑 그림자가 아닌 저장 쪽 커리어로 돌린다.
 */
export function useOutingActions(scope: PitcherScope, outingSlots: OutingPlaceSlots) {
  const { atoms } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const openStory = useOpenStory(atoms)
  const enterOutingMap = useEnterOutingMap(atoms)
  /** 105 커맨드 칸 3 [외출] → 상태 112 외출 지도 (0x126be — 모드 갈림 없음) */
  const openOuting = useCallback(() => {
    atoms.set(outingEntryActedAtom, career?.hasActedThisCycle ?? null)
    atoms.set(outingNoticeAtom, '')
    atoms.set(outingResultAtom, null)
    atoms.set(outingPresentationAtom, null)
    enterOutingMap()
    atoms.set(sceneAtom, '외출')
  }, [atoms, career, enterOutingMap])
  /** 112 취소(키 0x13ba4)가 남길 행동함 — 원본은 늘 거짓(13bc0~13bca), B-26 고침이면 105 에서 들어설 때 값 */
  const actedAfterOutingCancel = useCallback(() => {
    const acted = actedAfterOutingMapCancel(career?.hasActedThisCycle ?? false, atoms.get(outingEntryActedAtom))
    atoms.set(outingEntryActedAtom, null)
    return acted
  }, [atoms, career])
  /** 113 장소 기능 — 가드 0x16cf0 → 113 → 126 진입 0x11da8 → 연출 0x85074. 효과는 연출이 끝난 틀에 굴린다 */
  const runOutingFunction = useCallback(
    (functionId: string) => {
      if (career === null) return
      const outingFunction = outingFunctionOf(functionId)
      if (outingFunction === undefined) return
      const reason = outingBlockReasonOf(career, outingFunction)
      if (reason !== null) return atoms.set(outingNoticeAtom, outingBlockTextOf(reason, outingFunction))
      const place = OUTING_PLACES.find((candidate) => candidate.functions.includes(outingFunction))
      atoms.set(outingNoticeAtom, '')
      atoms.set(outingPresentationAtom, { functionId, place: (place?.frame ?? 1) - 1 })
    },
    [atoms, career],
  )
  /**
   * 113 칸 0 [들어가기] (키 0x16c64): `0x8ce59` 가 배정된 이벤트를 부르고, 없으면 이벤트 440+장소
   * (`0x8bdc9(0x1b8 + [+0xe0]+0x184)`)를 부르며 +0x167 = 1(빈 장소). 그리고 `[다음 114, 뒤 113]`.
   * 이 칸에는 행동·인기도 가드가 없다 (가드 0x16cf0 은 칸 1 장소 기능 쪽이다).
   */
  const enterOutingPlace = useCallback(
    (place: OutingPlace) => {
      if (career === null || fileEvents === null) return
      atoms.set(outingNoticeAtom, '')
      openStory({ eventId: outingSlots.get(place.id) ?? emptyPlaceEventId(place.frame), context: '장소', viewed: [] })
    },
    [atoms, career, fileEvents, openStory, outingSlots],
  )
  const closeOutingNotice = useCallback(() => atoms.set(outingNoticeAtom, ''), [atoms])
  const dismissOutingRecoveryNotice = useCallback(() => atoms.set(outingRecoveryNoticeAtom, ''), [atoms])
  return {
    openOuting,
    actedAfterOutingCancel,
    runOutingFunction,
    ...useOutingEffectActions(scope),
    enterOutingPlace,
    reenterOutingMap: enterOutingMap,
    closeOutingNotice,
    dismissOutingRecoveryNotice,
  }
}
