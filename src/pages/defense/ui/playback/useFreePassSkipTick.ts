import { useEffect, useState } from 'react'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { originalKeyOf } from '@/entities/defense-controls/model/defenseKeys'
import type { RecordedSkipTick } from '@/pages/defense/ui/playback/recordedPlaybackSlots'
import { gameSceneTickNow, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'

/**
 * 0x519cc 키 건너뛰기를 받은 장면 틱 — 키는 받은 다음 틀의 0xbca05 → 키 0x498d4 → 0x53420 이 그 틀의 갱신보다 먼저 처리한다
 * (`sceneKeyLatch` · `keyQueue.takePressFor` 와 같은 차례). 받은 틱보다 뒤 틱의 갱신이 오면 그 그림 안에서 0x35108 까지 끝난다.
 * 밀어내기 판(`freePassPlay`)만 키를 받는다
 */
export function useFreePassSkipTick(freePassPlay: boolean, ticks: readonly DefenseViewState[]): RecordedSkipTick | null {
  const [skipTick, setSkipTick] = useState<RecordedSkipTick | null>(null)
  useEffect(() => {
    if (!freePassPlay) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 처리 0x53420 이 키마다 끝에 메시지 0x587 → 0x519cc — 원본이 아는 키만
      if (originalKeyOf(event.key) === null) return
      // 공용 창이 서 있으면 52cc6 이 키 처리 0x498d4 를 건너뛴다 — 키는 창(0x754f9)이 가져간다
      if (isGameSceneFrozen()) return
      const at = gameSceneTickNow()
      setSkipTick((current) => (current !== null && current.ticks === ticks ? current : { ticks, at }))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [freePassPlay, ticks])
  return skipTick
}
