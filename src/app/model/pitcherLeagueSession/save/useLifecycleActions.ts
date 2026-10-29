import { useCallback } from 'react'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCHER_LEAGUE_MODE, skillEquipStatEventsOf } from '@/entities/collection/model/annalsStats'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { newPlayerAtom, sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { aceMatchAtom, gameOptionsAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/** 선수 등록(104) · 모드 초기화 */
export function useLifecycleActions(scope: PitcherScope) {
  const { atoms, recordStat } = scope
  const { commit } = usePitcherSaveWriters(scope)
  /**
   * 104 등록 확정 0x10fb4 — 전역기록 +0x40 + 모드 = 1 · +0x4c + 모드(+0x4f) = 0 (0x112b2 · 0x112c0).
   * 0x112d0~0x112dc 0xa4bd8(P, 0) · (P, 8) → 0xa4b04 → 0xb663c 가 켠 스킬 비트(+0xf8, 모드 3)를 세운다 — 새 선수는 장착 비교 효과가 안 견준다.
   * 등록 104 → 100 진입 끝(0x1c3be)이 이전 상태 104 를 보고 새 선수 플래그를 켠다 → 105 첫 틀에 오프닝 451
   */
  const create = useCallback(
    (name: string, profile: PitcherRookieProfile) => {
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      const created = createPitcherCareer(name, profile)
      commit(created)
      skillEquipStatEventsOf(PITCHER_LEAGUE_MODE, [], created.equippedSkillIds).forEach(recordStat)
      atoms.set(newPlayerAtom, true)
      atoms.set(sceneAtom, '관리')
    },
    [atoms, commit, recordStat],
  )
  /** 모드 초기화 0x2c9c4 → 모드 저장 지우기 0x224ec(저장, 3) — +0x43 · +0x4f = 0 (0x225c4 · 0x225ca) */
  const reset = useCallback(() => {
    atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
    atoms.set(careerAtom, null)
    atoms.set(gameOptionsAtom, null)
    atoms.set(storyAtom, null)
    atoms.set(aceMatchAtom, null)
    atoms.set(sceneAtom, '등록')
  }, [atoms])
  return { create, reset }
}
