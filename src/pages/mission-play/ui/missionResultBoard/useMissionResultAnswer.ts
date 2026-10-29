import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { MISSION_RETRY_DEFAULT_ANSWER, missionResultKeyActionOf, missionResultStepOf } from '@/pages/mission-play/lib/missionResultBoard'
import type { MissionResultExit, MissionResultKeyAction } from '@/pages/mission-play/lib/missionResultBoard'

/**
 * **고른 답 · 키 0x407f0** — 돌려준 `act` 가 키 하나(또는 누르기)를 치러 답을 고치고, 나가는 키면 한 번만 `onExit` 한다.
 * `flags` 는 마선수 대결 깃발(g[0x11f] · g[0x176]) — 커서를 뒤집을지 · OK 의 갈래를 정한다(`missionResultStepOf`).
 */
export function useMissionResultAnswer(flags: { readonly flag11f: boolean; readonly flag176: boolean }, onExit: (exit: MissionResultExit) => void) {
  const [answer, setAnswer] = useState(MISSION_RETRY_DEFAULT_ANSWER)
  const doneRef = useRef(false)
  const act = (action: MissionResultKeyAction, current: boolean) => {
    if (doneRef.current) return
    const step = missionResultStepOf(action, current, flags)
    answerRef.current = step.answer
    setAnswer(step.answer)
    if (step.exit !== null) {
      doneRef.current = true
      onExit(step.exit)
    }
  }

  // 키 0x407f0 은 상태 0x19 의 상태 키 함수(52da2~)라 받은 다음 틀에 돈다 — 장면 키 칸(`pushSceneKey`, 밑의 결과 배경 타석이 올려 둔
  // 칸)에 넣고 그 틀 머리에서 꺼낸다. 고른 답은 꺼낸 차례대로 고치고 읽는다
  // 고른 답 — 꺼낸 키가 그 자리에서 고쳐 쓴다(다음 키가 바로 읽는다). 답은 `act` 만 바꾼다
  const answerRef = useRef(answer)
  const actLatest = useEffectEvent(act)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const action = missionResultKeyActionOf(event.key)
      if (action === null) return
      event.preventDefault()
      pushSceneKey(() => actLatest(action, answerRef.current))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return [answer, act] as const
}
