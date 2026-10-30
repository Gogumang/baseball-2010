import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { moveNariMainCursor, nariMainCursorOnEntry } from './otherSlices'
import type { NariMainMenuCursor } from './otherSlices'

/**
 * 화면 안 행동(훈련 125 · 휴식 127 — S+4 = 1)은 그 상태를 거쳐 105 로 다시 들어온다 — 그 진입이 행동함이라 커서를 첫 칸으로.
 * 행동함이 막 서면, 결과 창 · 하위 창이 걷혀 관리 메뉴만 남는 때에 그 진입을 친다(타자편 `useManagementMenu` 와 같다).
 * 관리 메뉴만 남은 렌더에서 곧바로 105 진입을 친다(예전 레이아웃 효과와 같은 값이 그림 전에 선다) — 그리는 중에 커서 칸을 고친다.
 */
export function useActedEntry(hasActed: boolean, isIdleMain: boolean, mainCursor: NariMainMenuCursor) {
  const wasActed = useRef(hasActed)
  const [awaitingEntry, setAwaitingEntry] = useState(false)
  const noteActed = useEffectEvent(() => {
    if (hasActed && !wasActed.current) setAwaitingEntry(true)
    wasActed.current = hasActed
  })
  useLayoutEffect(() => noteActed(), [hasActed])
  if (awaitingEntry && isIdleMain) {
    moveNariMainCursor(mainCursor, nariMainCursorOnEntry(mainCursor.current, hasActed, false))
    setAwaitingEntry(false)
  }
}
