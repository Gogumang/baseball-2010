import { useEffect } from 'react'
import { originalKeyOf } from '@/entities/defense-controls/model/defenseKeys'
import { isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { queueKeyPress, queueKeyRelease, type SceneKeyQueue } from '@/pages/defense/ui/playback/keyQueue'

/**
 * 실시간 판(타구 · 주자 판)의 키 사건 — 누름 · 뗌을 키를 받은 장면 틱(`tickSeenOf`)과 함께 그 판의 키 줄(`slots.keys`)에 담는다.
 * 키 줄은 판이 바뀌면 새것이 되므로 사건이 난 때의 줄을 읽는다
 */
export function useSceneKeyEvents(slots: { readonly keys: SceneKeyQueue }, tickSeenOf: (event: Event) => number): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 원본이 아는 키만 담는다 (숫자·방향·OK·CLR)
      if (originalKeyOf(event.key) === null) return
      // 공용 창이 서 있으면 52cc6 이 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다
      if (isGameSceneFrozen()) return
      // 누른 채 되풀이는 0xbca05 가 센다(`keyHold`) — 브라우저 되풀이는 버린다. 레이저 확정은 새로 누른 키만 받는다(0x4e858 —
      // 이 틀 누름 [장면+0x40] 이 있어야 한다)
      if (event.repeat) return
      queueKeyPress(slots.keys, event.key, tickSeenOf(event))
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (originalKeyOf(event.key) === null || isGameSceneFrozen()) return
      queueKeyRelease(slots.keys, tickSeenOf(event))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [slots, tickSeenOf])
}
