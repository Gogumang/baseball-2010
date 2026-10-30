import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'
import type { EventMissionAnswer } from '@/pages/mission-select/ui/EventMissionWindow'

/** 이벤트 미션 창(`'창'`) · 받은 미션이 없다는 알림(`'알림'`) — 떠 있지 않으면 null */
export type EventMissionWindowKind = '창' | '알림' | null

/**
 * [this+0x18] — 이벤트 미션 창 키가 그 갱신에 고른 하위 상태. 키 함수 0x1daa4 가 이것을 보는 것은 창이 다 닫힌 다음 갱신이다
 * (틀 0x1ea98 의 1eaac — 창이 떠 있으면 0x754f9 가 1 이라 키 함수를 건너뛴다). 그때까지 목록 키도 안 돈다.
 * 미션실행 · [미션+0xa4] == 0 → 하위 3(0x1dd06~0x1dd18) 의 키 함수 0x1dc00 이 0x74ef5 알림 · 하위 4 — 미션다운(하위 2 → 통신 —
 * 웹에 없다) · 취소(하위 0)는 목록으로
 */
export function useEventMissionAnswer(eventWindow: EventMissionWindowKind, setEventWindow: Dispatch<SetStateAction<EventMissionWindowKind>>) {
  const [eventKeyAnswer, setEventKeyAnswer] = useState<EventMissionAnswer | null>(null)
  useEffect(() => {
    if (eventKeyAnswer === null || eventWindow !== null) return undefined
    return setAppTickTimeout(() => {
      setEventKeyAnswer(null)
      if (eventKeyAnswer === '미션실행') setEventWindow('알림')
    }, 1)
  }, [eventKeyAnswer, eventWindow, setEventWindow])
  return [eventKeyAnswer, setEventKeyAnswer] as const
}
