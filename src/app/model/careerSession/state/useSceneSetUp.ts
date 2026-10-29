import { useCallback, useEffect } from 'react'
import { withNariSceneSetupOutings } from '@/entities/career/model/playerCareer'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { lastSeenGamesAtom, rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { matchPreparedAtom, sceneSetUpCountAtom, shouldForgetRepeatableAtom, storySetUpMirrorAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'

/**
 * **나리 장면 0x106 이 새로 선다** — 셋업 0xf684 의 세 초기화: fb1c `0x8ce94` → `0xacf60`(반복 이벤트 본 표시 지움 · 커서
 * reader+0x28 = 0) · fb7a mgr+0x304 = 1 · 0xfb7c 장면+0x288 = 0. 장면은 이어하기(`continueSaved`)와 **경기 뒤마다**(`finishGame` ·
 * `finishCupGame` — 경기 장면 0x104 를 지나 0x106 이 다시 선다) · 마선수 대결 뒤 · 새 선수 등록에 선다.
 */
export function useSetUpNariScene({ atoms }: CareerScope): () => void {
  return useCallback(() => {
    atoms.set(matchPreparedAtom, false)
    atoms.get(storySetUpMirrorAtom).current()
    atoms.set(shouldForgetRepeatableAtom, true)
    atoms.set(sceneSetUpCountAtom, (count) => count + 1)
  }, [atoms])
}

/**
 * 셋업 0xf684 fb92~fba8 — 경기 수 == 2 면 외출 칸 +0x6a = 0. 셋업은 경기 뒤 커리어가 들어오기 전에 불리므로(경기 정산이 경기 수를
 * 올린 뒤의 장면이다) 그 커밋 뒤 렌더에서 지운다 (`withNariSceneSetupOutings`)
 */
export function useSceneSetUpOutings(scope: CareerScope): void {
  const { atoms } = scope
  const sceneSetUpCount = useCareerValue(atoms, sceneSetUpCountAtom)
  const gamesPlayed = useShownCareer(scope)?.gamesPlayed ?? null
  useEffect(() => {
    if (sceneSetUpCount === 0) return
    const previousGames = atoms.get(lastSeenGamesAtom)
    atoms.set(rawCareerAtom, (current) => (current === null ? current : withNariSceneSetupOutings(current, previousGames)))
  }, [atoms, sceneSetUpCount])
  useEffect(() => {
    atoms.set(lastSeenGamesAtom, gamesPlayed)
  }, [atoms, gamesPlayed])
}
