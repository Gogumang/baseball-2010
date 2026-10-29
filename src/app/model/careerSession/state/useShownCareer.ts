import { useMemo } from 'react'
import { MAXIMUM_GAME_POINT, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'

/**
 * 커리어가 내보이는 G 는 **지갑 값**이다 (원본 `mgr[+0x64]` 한 칸). 상점·관리 화면·상태 막대가
 * 다 이 `career.gamePoint` 를 읽으므로, 여기서 한 번 갈아 끼우면 화면과 판정이 같은 값을 본다.
 *
 * ⚠️ **테스트용** — `?무한G` 는 지갑 쪽에서 처리한다 (`useGamePointWallet`): `balance` 가 늘
 *    99999 이고 쓰기는 먹히지 않는다. 지갑을 안 받은 자리(테스트)는 예전처럼 여기서 올린다.
 *
 * ⚠️ **값이 같으면 `rawCareer` 를 그대로 돌려줘야 한다.** 새 객체를 매번 만들면 저장 고리가
 *    `savedCareer` 를 다시 쓰고, 그 그리기가 또 새 객체를 만들어 **무한히 돈다**.
 */
export function useShownCareer({ atoms, wallet }: CareerScope): PlayerCareer | null {
  const rawCareer = useCareerValue(atoms, rawCareerAtom)
  const overriddenGamePoint = wallet?.balance ?? (isInfiniteGamePointOn() ? MAXIMUM_GAME_POINT : null)
  return useMemo(
    () =>
      rawCareer === null || overriddenGamePoint === null || rawCareer.gamePoint === overriddenGamePoint
        ? rawCareer
        : { ...rawCareer, gamePoint: overriddenGamePoint },
    [rawCareer, overriddenGamePoint],
  )
}
