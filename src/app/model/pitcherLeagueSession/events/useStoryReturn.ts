import { useCallback } from 'react'
import { spendPitcherCycleAction, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { emptyPlaceFrameOf, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { withOutingEventActed } from '@/entities/story/model/storyScene'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { outingReturnPlaceIdAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'
import type { PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useEnterOutingMap } from '@/app/model/pitcherLeagueSession/outing/useEnterOutingMap'

/** 빈 장소(440~444) 이벤트의 장소 id */
const emptyPlaceIdOf = (eventId: number) => OUTING_PLACES.find((place) => place.frame === emptyPlaceFrameOf(eventId))?.id ?? null

/**
 * 재생 끝(114 끝 0x1c014) 뒤 갈 곳 — 연말 사슬 · 엔딩이 아닌 이벤트. 뒤 상태(`story.context`)로 갈린다:
 *   연초     내장 이벤트라 본 표시는 없다. 목표 창이 닫히면 0x7fe90 이 S+0x1b7 = 1 (해마다 한 번) → 105
 *   지도     0x8b0e4(1c02e)의 0x8b12c — 112 에서 연 이벤트도 행동함(S+4)을 켜고 저장한다(외출 수는 113 몫) → `뒤 112` 에 다시 들어서
 *            0x118e4 가 [!] 칸을 다시 찍는다
 *   대결결과 140 → 뒤 105. 장소 끝 처리(행동·외출 수)는 대결로 **나갈 때** 이미 했다 (`settlePlaceForAceMatch`)
 *   장소     +0x167 == 0 → S+4 = 1(행동함) · S+0x6a(외출 수)++ → 105 / 빈 장소(440~444) → 1c07c — +0x167 을 지우고 113(그 장소
 *            말풍선)으로. 112 진입이 아니라 [!] 다시 찍기 · 자동 발동이 없다(Q-22)
 *   그 밖    뒤 = 105
 */
export function useStoryReturn(scope: PitcherScope) {
  const { atoms } = scope
  const { commit } = usePitcherSaveWriters(scope)
  const enterOutingMap = useEnterOutingMap(atoms)
  return useCallback(
    (story: PitcherStory, rewarded: PitcherCareer, viewed: PitcherCareer) => {
      if (story.context === '연초') {
        commit({ ...rewarded, hasSeenYearGoalWindow: true })
        return atoms.set(sceneAtom, '관리')
      }
      if (story.context === '지도') {
        commit(withOutingEventActed(viewed, true, story.eventId))
        enterOutingMap()
        return atoms.set(sceneAtom, '외출')
      }
      if (story.context === '장소' && isEmptyPlaceEventId(story.eventId)) {
        commit(viewed)
        atoms.set(outingReturnPlaceIdAtom, emptyPlaceIdOf(story.eventId))
        return atoms.set(sceneAtom, '외출')
      }
      commit(story.context === '장소' ? spendPitcherCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 }) : viewed)
      atoms.set(sceneAtom, '관리')
    },
    [atoms, commit, enterOutingMap],
  )
}
