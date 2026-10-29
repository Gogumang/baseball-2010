import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { savedCareerOf } from '@/entities/career/model/seasonFlow'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, isSaveErasedAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'

/**
 * 커리어를 넣고 곧바로 저장한다 (`commit` · 직전 값을 받는 `commitWith`). 명예의 전당 등록으로 저장을 지운 뒤에는 저장하지
 * 않는다(`isSaveErasedAtom`). 판정 없음(e = −1) 엔딩은 141 이 저장하지 않는다 — 엔딩 칸을 비운 114 끝의 커리어가 남는다(`savedCareerOf`).
 *
 * `commitWith` — **직전 값을 받아** 고쳐 넣는다. 같은 프레임에 커리어를 고치는 자리가 둘(칭호 부여 · 지갑 다리)이라, 둘 다 자기가
 * 본 옛 커리어를 통째로 덮어쓰면 **나중에 붙은 쪽이 앞의 결과를 지운다**(지갑 1000 + 투수 1500 이 2500 이 아니라 1500 이 됐다).
 * 칸이 atom 이라 지금 값을 곧장 읽어 고친다 — 옛 `setState` 함수 꼴과 같은 값이다(그 꼴은 `StrictMode` 에서 같은 값을 두 번 썼다).
 */
export function usePitcherSaveWriters({ atoms, store }: PitcherScope) {
  const commit = useCallback(
    (next: PitcherCareer) => {
      atoms.set(careerAtom, next)
      if (!atoms.get(isSaveErasedAtom)) store.save(savedCareerOf(next))
    },
    [atoms, store],
  )
  const commitWith = useCallback(
    (update: (current: PitcherCareer) => PitcherCareer) => {
      const current = atoms.get(careerAtom)
      if (current === null) return
      const next = update(current)
      if (next === current) return
      atoms.set(careerAtom, next)
      if (!atoms.get(isSaveErasedAtom)) store.save(savedCareerOf(next))
    },
    [atoms, store],
  )
  return { commit, commitWith }
}
