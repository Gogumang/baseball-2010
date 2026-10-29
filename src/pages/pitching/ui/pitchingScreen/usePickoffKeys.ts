import { useEffect } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'

/**
 * 견제 — 구질 고르기(0xf)에서만. 끝난 미션(결과 화면)·0xe(OK 대기)는 키를 안 받는다. 견제 키 0x53548 — 다음 틀의 키 0x498d4 가 0xf
 * 갱신보다 먼저 처리한다(구질 고르기 `PitchSlotPicker` 의 키 칸에 든다). 터치 기기 — 주자가 있는 루마다 "N루 견제" 상황 버튼(같은 키 사건을 쏜다)
 */
export function usePickoffKeys(acceptsPickoff: boolean, onPickoffKey: ((key: string) => void) | undefined, bases: PitcherRun['bases']): void {
  useEffect(() => {
    if (!acceptsPickoff || onPickoffKey === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const { key } = event
      pushSceneKey(() => onPickoffKey(key))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, onPickoffKey])
  usePickoffTouchKeys(acceptsPickoff, bases)
}
