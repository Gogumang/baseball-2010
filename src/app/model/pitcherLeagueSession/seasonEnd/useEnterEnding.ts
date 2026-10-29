import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { endingFromResumeAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/**
 * 엔딩 141 로 — 진입 0x12300 은 S+0x50 = 6 을 메모리에만 쓰고 커리어를 저장하지 않는다(저장은 엔딩 칸을 비운 채 —
 * `savedCareerOf`). 보너스는 팝업 0x2b 를 닫을 때 준다(`receiveEndingBonus`)
 */
export function useEnterEnding(scope: PitcherScope) {
  const { atoms } = scope
  const { commit } = usePitcherSaveWriters(scope)
  return useCallback(
    (finished: PitcherCareer, endingIndex: number) => {
      commit({ ...finished, endingIndex })
      atoms.set(endingFromResumeAtom, false)
      atoms.set(sceneAtom, '엔딩')
    },
    [atoms, commit],
  )
}
