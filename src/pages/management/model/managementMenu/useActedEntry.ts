import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react'

/*
 * 화면 안에서 행동(훈련 125 · 휴식 127 — S+4 = 1)을 하면 원본은 그 상태를 거쳐 105 로 다시 들어온다. 그 105 진입이 행동함이라
 * 커서를 첫 칸으로 되돌린다(이전 상태 125 · 127). 웹은 행동함이 막 선 것을 보고, 결과 창 · 연출이 걷혀 메인 메뉴만 남는 때에
 * 그 진입을 친다(`onEntry` — 렌더 중에 맞춘다).
 */
export function useActedEntry(hasActed: boolean, isIdleMain: boolean, onEntry: () => void) {
  const wasActed = useRef(hasActed)
  const [awaitingEntry, setAwaitingEntry] = useState(false)
  const noteActed = useEffectEvent(() => {
    if (hasActed && !wasActed.current) setAwaitingEntry(true)
    wasActed.current = hasActed
  })
  useLayoutEffect(() => noteActed(), [hasActed])
  if (awaitingEntry && isIdleMain) {
    setAwaitingEntry(false)
    onEntry()
  }
}
