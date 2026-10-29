import { useCallback } from 'react'
import { startNextPitcherSeason, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  heldEndingIndexAtom,
  isYearCoverHeldAtom,
  yearCoverAfterHoldAtom,
  yearCoverFromResumeAtom,
} from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { cupViewAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/**
 * 새 시즌 처리 0x1b768 → 137 "N년차" 표지 → 105 관리 화면 (타자편 `startNewSeason` 과 같다 — `pages/management/lib/nariYearCover`).
 * 난수는 1b86c 의 CPU 장비 굴림 하나뿐이고 137 은 난수를 안 쓴다. `fromResume` 은 이어하기 100 진입 1c25e — 0x1b768 뒤 1c3be 로
 * 빠져도 남은 +0x289 를 연초 114 틀 0x1c014 가 9 틀째에 받아 137 을 띄운다(r156 직접 뜸 — `nariYearCover` 의 이어하기 길).
 */
export function useStartNewSeason(scope: PitcherScope) {
  const { atoms, random } = scope
  const { commit } = usePitcherSaveWriters(scope)
  return useCallback(
    (finished: PitcherCareer, fromResume = false, holdsPrevious = false) => {
      // 0x1b768 의 1b86c — CPU 장비 굴림 0x665e8 이 여기서 난수를 쓴다 (`nariCpuEquipment`)
      commit(startNextPitcherSeason(finished, random))
      atoms.set(yearCoverFromResumeAtom, fromResume)
      atoms.set(yearCoverAfterHoldAtom, false)
      // 134(1bb2c~1bb64)는 0x1b768 뒤에도 대진판을 그리며 효과기 끝을 기다린다 — 그 장면을 그대로 둔다
      if (holdsPrevious) return atoms.set(isYearCoverHeldAtom, true)
      atoms.set(sceneAtom, '연차표지')
    },
    [atoms, commit, random],
  )
}

/** 앞 상태(134 · 141)가 효과기 끝을 본 틀 — `0xbcb49(0x89)` 로 137 (1bb46~1bb64 · 1becc~1beea) */
export function useEnterHeldYearCover({ atoms }: PitcherScope) {
  const isYearCoverHeld = usePitcherValue(atoms, isYearCoverHeldAtom)
  return useCallback(() => {
    if (!isYearCoverHeld) return
    atoms.set(isYearCoverHeldAtom, false)
    atoms.set(yearCoverAfterHoldAtom, true)
    atoms.set(heldEndingIndexAtom, null)
    atoms.set(cupViewAtom, null)
    atoms.set(sceneAtom, '연차표지')
  }, [atoms, isYearCoverHeld])
}
