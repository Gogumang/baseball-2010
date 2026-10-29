import { useEffect } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/** 견제 키 0x53548 — 받는 동안(`acceptsPickoffOf`)만 건다. 터치 기기는 주자가 있는 루마다 "N루 견제" 상황 버튼 */
export function usePickoffKeys(acceptsPickoff: boolean, pickoff: (key: string) => void, bases: TeamGameProgress['game']['bases']) {
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
  // 터치 기기 — 주자가 있는 루마다 "N루 견제" 상황 버튼(같은 키 사건을 쏜다)
  usePickoffTouchKeys(acceptsPickoff, bases)
}
