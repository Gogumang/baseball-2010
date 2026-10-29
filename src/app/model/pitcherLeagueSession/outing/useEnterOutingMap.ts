import { useCallback } from 'react'
import type { PitcherAtoms } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { cursorAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { outingEntryCountAtom, outingReturnPlaceIdAtom } from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'

/** 112 진입 0x118e4 — [!] 칸을 다시 찍고(`outingEntryCountAtom`) 돌아갈 장소를 지운다 */
export function useEnterOutingMap(atoms: PitcherAtoms) {
  return useCallback(() => {
    atoms.set(outingEntryCountAtom, (count) => count + 1)
    atoms.set(outingReturnPlaceIdAtom, null)
    // 0x8cdc0 은 머리 0x8cdd4 · 끝 0x8ce34 에서 reader+0x28 = 0 — 112 진입 뒤 자동 발동은 처음부터 훑는다
    atoms.set(cursorAtom, 0)
  }, [atoms])
}
