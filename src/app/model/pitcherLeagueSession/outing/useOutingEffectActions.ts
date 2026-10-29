import { useCallback } from 'react'
import { performOuting } from '@/entities/career/model/outing'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { outingPresentationAtom, outingRecoveryNoticeAtom, outingResultAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/**
 * 126 흐름 (두 편 같은 코드): 진입 0x11da8 → 연출 0x85074 (60 갱신, 확인 키 0x105c8 로 건너뜀)
 * → 연출 끝(0x84e58)에 효과 0x15234 가 굴리고 **효과 팝업**(StrMODE[22]·[23]·[25]·[24] 줄 + 서브 아이템 [195])을
 * 지도 위에 띄운다 → 팝업이 닫히면 틀 0x1575c 가 입원이면 회복을 굴려 **회복 글 팝업**을 띄우고 **105** 로 간다.
 * 연출 그림은 0x85074 의 시즌이 아닌 갈래 — event_ani 애니 [1,0,2,4,3][장소] · event_char_1 +0x1e · event_char_0 +0x5d(투수편은
 * 0x7b970 이 거짓이라 장타형 +0x63 갈래가 없다) · 팔레트 피부 − 1 (`nariOutingPresentationOf`).
 */
export function useOutingEffectActions(scope: PitcherScope) {
  const { atoms, random } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const outingPresentation = usePitcherValue(atoms, outingPresentationAtom)
  const outingResult = usePitcherValue(atoms, outingResultAtom)
  const { commit } = usePitcherSaveWriters(scope)
  /** 126 연출 끝(0x84e58) — 효과 0x15234 를 굴려 효과 팝업을 띄운다 */
  const finishOutingPresentation = useCallback(() => {
    if (career === null || outingPresentation === null || outingResult !== null) return
    const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.id === outingPresentation.functionId)
    if (outingFunction === undefined) return
    const outcome = performOuting(career, outingFunction, random)
    commit(outcome.career)
    atoms.set(outingResultAtom, { effectText: outcome.effectText, recoveryText: outcome.recoveryText })
  }, [atoms, career, commit, outingPresentation, outingResult, random])
  /** 126 효과 팝업 [확인] → (입원이면 회복 글) → 105 (틀 0x1575c) */
  const closeOutingResult = useCallback(() => {
    if (outingResult === null) return
    atoms.set(outingResultAtom, null)
    atoms.set(outingPresentationAtom, null)
    atoms.set(outingRecoveryNoticeAtom, outingResult.recoveryText)
    atoms.set(sceneAtom, '관리')
  }, [atoms, outingResult])
  return { finishOutingPresentation, closeOutingResult }
}
