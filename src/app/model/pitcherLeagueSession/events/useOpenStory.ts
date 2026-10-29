import { useCallback } from 'react'
import type { PitcherAtoms } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import type { PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'

/** 이벤트 재생(114)으로 — 뒤 상태는 `story.context` 가 정한다 */
export function useOpenStory(atoms: PitcherAtoms) {
  return useCallback(
    (next: PitcherStory) => {
      atoms.set(storyAtom, next)
      atoms.set(sceneAtom, '이벤트')
    },
    [atoms],
  )
}
