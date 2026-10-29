import { useEffect, useEffectEvent } from 'react'
import type { RefObject } from 'react'
import type { SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { settlementKeyActionOf } from '@/pages/team-game/lib/settlementBoard'
import type { SettlementKeyAction } from '@/pages/team-game/lib/settlementBoard/settlementKeys'

/** 판 열림 어느 쪽이든 키 0x407f0 이 받는 키인가 */
const isSettlementKey = (key: string) => settlementKeyActionOf(key, true) !== null || settlementKeyActionOf(key, false) !== null

/**
 * 키 0x407f0 — 받은 키는 판의 칸에 들고 꺼낸 틀에 그때 렌더의 처리(`act`)로 돈다. 판 열림은 꺼낸 틀의 값으로 가른다.
 * 터치 기기 — 기록 판이 열려 있고 줄이 넘치면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건 → 0x61ce5 스크롤)
 */
export function useSettlementKeys(
  keyLatch: SceneKeyLatch,
  isPanelOpenRef: RefObject<boolean>,
  act: (action: SettlementKeyAction) => void,
  showsTouchScroll: boolean,
): void {
  const actLatest = useEffectEvent(act)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const { key } = event
      if (!isSettlementKey(key)) return
      event.preventDefault()
      keyLatch.push(() => {
        const action = settlementKeyActionOf(key, isPanelOpenRef.current)
        if (action !== null) actLatest(action)
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  useTouchScrollKeys(showsTouchScroll)
}
