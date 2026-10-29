import { useEffect } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { wasOnScreenForBgmAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'

/**
 * 상태 100 진입 0x1c154 의 머리 1c15e `0x6e439([0x1400058])` = stopBgm — S+0x50 갈래(1c24e~)보다 먼저 늘 부른다(r163 직접 뜸).
 * 이어하기로 투수편에 들어서면 메인 메뉴 배경음 1 이 끊긴다: 134 대진판 · 116 경기 결과 · 이벤트 재생(40 가드가 막으면) 같은
 * 배경음을 안 트는 자리는 소리 없이 선다. 105 · 109 · 128(이전 1 → 4) · 141(46/52)은 App 의 `useSceneBgm` 이 이 효과 뒤(같은 커밋,
 * 훅 차례 — 이 세션이 먼저 선다)에 제 배경음을 튼다. 저장이 없어 등록(104)으로 가는 길은 거치지 않는다.
 */
export function useScreenEntryBgm({ atoms, isOnScreen }: PitcherScope): void {
  const hasCareer = usePitcherValue(atoms, careerAtom) !== null
  useEffect(() => {
    const was = atoms.get(wasOnScreenForBgmAtom)
    atoms.set(wasOnScreenForBgmAtom, isOnScreen)
    if (isOnScreen && !was && hasCareer) activeSound().stopBgm()
  }, [atoms, isOnScreen, hasCareer])
}
