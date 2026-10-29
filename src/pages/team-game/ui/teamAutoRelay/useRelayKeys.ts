import { useEffect } from 'react'
import { useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { autoRelaySpeed, setAutoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'
import type { RelayState } from './useRelayState'

/** 키 0x3e25c 의 속도 키 — ←/'4' −1 · →/'6' +1 */
const SPEED_KEY_DELTAS: Readonly<Record<string, number>> = { ArrowLeft: -1, 4: -1, ArrowRight: 1, 6: 1 }
/** CLR 키 — StrGAME[6] 중단 질문 */
const isClearKey = (key: string) => key === 'Escape' || key === 'Backspace'

/**
 * 키 0x3e25c — 상태 0x21 의 상태 키 함수(52da2~)라 받은 다음 틀의 진입 뒤 · 갱신 0x48480 앞에서 돈다(`sceneKeyLatch`). 받은 키는 이
 * 부품의 칸에 들고 장면 틱(`AutoPlayRelayScreen` 의 `useSceneTick`)이 틱 머리에서 꺼낸다 — 속도는 그 틀의 갱신부터 본다
 */
export function useRelayKeys(state: RelayState): SceneKeyLatch {
  const keyLatch = useSceneKeyLatchOwner()
  const { isAskingRef, isDoneRef, speedRef, setSpeed, clrPendingRef } = state
  useEffect(() => {
    const isIdle = () => !isAskingRef.current && !isDoneRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isIdle()) return
      const delta = SPEED_KEY_DELTAS[event.key]
      if (delta !== undefined) {
        event.preventDefault()
        keyLatch.push(() => {
          if (!isIdle()) return
          setAutoRelaySpeed(speedRef.current + delta)
          speedRef.current = autoRelaySpeed()
          setSpeed(speedRef.current)
        })
        return
      }
      if (!isClearKey(event.key)) return
      event.preventDefault()
      // 원본은 키 단계(0x3e25c → 0xbbef8)에서 창을 열고 **같은 그림의** 갱신 0x48480 · 그리기 0x4258c 를 그대로 마친다
      keyLatch.push(() => {
        if (isIdle()) clrPendingRef.current = true
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch, isAskingRef, isDoneRef, speedRef, setSpeed, clrPendingRef])
  return keyLatch
}
