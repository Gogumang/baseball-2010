import { useMemo } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'

/**
 * 내보이는 커리어의 G 는 **지갑 값**이다 (원본 `mgr[+0x64]` 한 칸). 관리 화면 뱃지·구질 훈련
 * 가격 판정·지옥훈련 가드가 다 이 `career.gamePoint` 를 읽으므로, 여기서 한 번 갈아 끼우면
 * **보여 주는 값과 판정이 같은 값**을 본다.
 *
 * ⚠️ **테스트용** — `?무한G` 는 지갑 쪽에서 처리한다 (`useGamePointWallet`): `balance` 가 늘
 *    99999 이고 쓰기는 먹히지 않는다. 지갑을 안 받은 자리(테스트)는 예전처럼 여기서 올린다.
 *    저장은 그대로라 스위치를 끄면 원래 값으로 돌아온다.
 *
 * ⚠️ **값이 같으면 `career` 를 그대로 돌려준다** — 타자편 `useCareerSession` 과 같은 이유다.
 *    G가 어긋나 갈아 끼울 때 매 렌더 **새 객체**를 만들면, 이 값을 프로프로 받는 화면이
 *    아무것도 안 바뀌었는데도 계속 새 객체를 보게 된다.
 */
export function useShownCareer({ atoms, wallet }: PitcherScope): PitcherCareer | null {
  const career = usePitcherValue(atoms, careerAtom)
  const overriddenGamePoint = wallet?.balance ?? (isInfiniteGamePointOn() ? MAXIMUM_GAME_POINT : null)
  return useMemo(
    () =>
      career === null || overriddenGamePoint === null || career.gamePoint === overriddenGamePoint
        ? career
        : { ...career, gamePoint: overriddenGamePoint },
    [career, overriddenGamePoint],
  )
}
