import { useEffect, useLayoutEffect, useState } from 'react'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { createShownSceneTicks, inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'

/**
 * **React 로 그리는 장면 부품의 그림 기록** (r217 — 캔버스 루프가 아닌 부품용 `shownSceneTicks`).
 *
 * `shownTick` 은 지금 화면에 낸 그림의 장면 틱이다 — 바뀐 그림이 커밋될 때(`useLayoutEffect`, 칠하기 바로 앞) 적는다 — 화면에는 다음 화면 갱신에 나오므로 기록이 그린 시각에 한 화면 틀을 더해 센다(r406). 돌려준 함수는 키 · 누름
 * 사건 `event` 가 난 때 화면에 있던 그림의 틱을 준다(원본은 키를 받은 틀 = 마지막으로 그린 틀). 기록이 없거나 낡았으면 지금 틱이다.
 * 부품이 내려가면 기록을 비운다.
 */
export function useShownSceneTicks(shownTick: number | null): (event: Event | null | undefined) => number {
  const [shown] = useState(createShownSceneTicks)
  useLayoutEffect(() => {
    if (shownTick !== null) shown.mark(shownTick, performance.now())
  }, [shown, shownTick])
  useEffect(() => () => shown.clear(), [shown])
  const [tickSeenOf] = useState(() => (event: Event | null | undefined) => shown.tickSeenAt(inputTimeOf(event), gameSceneTickNow()))
  return tickSeenOf
}
