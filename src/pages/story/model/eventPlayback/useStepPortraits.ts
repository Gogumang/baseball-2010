import { useState } from 'react'
import type { EventStep } from '@/entities/story/model/eventScript'
import type { EventPortrait } from '@/shared/config/original/eventTypes'

/**
 * 대사 · 선택지의 초상화 묶음 — 0x7f54c 가 say · 선택지 명령이 돌 때 통째로 바꾼다(알림 · 예아니오는 앞 초상화를 그대로 둔다).
 * 걸음 · 풀림이 바뀐 렌더에서 맞춘다(바뀔 때마다 한 번 — 사이에 `clearPortraits` 가 비울 수 있다).
 *
 * 돌려주는 차례: [초상화, 비우기]
 */
export function useStepPortraits(step: EventStep, isReleased: boolean) {
  const [portraits, setPortraits] = useState<readonly EventPortrait[]>([])
  const [portraitsFor, setPortraitsFor] = useState<{ readonly step: EventStep | null; readonly isReleased: boolean }>({
    step: null,
    isReleased: false,
  })
  if (portraitsFor.step !== step || portraitsFor.isReleased !== isReleased) {
    setPortraitsFor({ step, isReleased })
    const command = step.command
    if (isReleased && command !== null && (command.op === 'say' || command.op === 'choice')) setPortraits(command.portraits)
  }
  /** 초상화 셋을 비운다 — 0x7f7a8 → 0x7b870 (화면효과 6 · 7 이 끝난 그리기, `drawEventBackdrop`) */
  const clearPortraits = () => setPortraits([])
  return [portraits, clearPortraits] as const
}
