import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/** 견제 키 0x53548 — 받는 동안만 건다. 터치 기기는 주자가 있는 루마다 "N루 견제" 상황 버튼(같은 키 사건을 쏜다) */
export function usePickoffKeys(acceptsPickoff: boolean, pickoff: (key: string) => void, bases: PitcherGameProgress['game']['bases']) {
  useEffect(() => {
    if (!acceptsPickoff) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 견제 키 0x53548 — 다음 틀의 키 0x498d4 가 0xf 갱신보다 먼저 처리한다(구질 고르기 `PitchSlotPicker` 의 키 칸에 든다)
      const { key } = event
      pushSceneKey(() => pickoff(key))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, pickoff])
  usePickoffTouchKeys(acceptsPickoff, bases)
}

/** '#' 강판 물음 키 — 받는 동안(`acceptsGiveUpKeyOf`)만 건다. 물음은 받은 다음 틀에 그 틀의 상태를 보고 띄운다 */
export function useGiveUpKey(acceptsGiveUpKey: boolean, setAsksGiveUp: (asks: boolean) => void) {
  const acceptsGiveUpKeyRef = useRef(acceptsGiveUpKey)
  useLayoutEffect(() => {
    acceptsGiveUpKeyRef.current = acceptsGiveUpKey
  })
  /** '#' 는 장면 키 칸에 든다 — 받은 다음 틀의 키 0x498d4(4994a)가 그 틀의 상태(0xe · 0xf)를 보고 물음을 띄운다 */
  const pressGiveUp = useCallback(() => {
    pushSceneKey(() => {
      if (acceptsGiveUpKeyRef.current) setAsksGiveUp(true)
    })
  }, [setAsksGiveUp])
  useEffect(() => {
    if (!acceptsGiveUpKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '#') return
      event.preventDefault()
      pressGiveUp()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsGiveUpKey, pressGiveUp])
  return pressGiveUp
}
