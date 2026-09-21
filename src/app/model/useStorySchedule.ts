import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { nextEventFor, placeTriggerOf, scanEventFrom } from '@/entities/story/model/storyScene'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 이벤트 화면을 어디서 열었는가 — 끝난 뒤 돌아갈 곳과 행동 소모가 달라진다 */
export type StoryContext = '관리' | '외출진입' | '장소' | '시즌'

/**
 * 원작 이벤트 일정. 본문(events.ts, 535KB)은 첫 화면에 필요 없어 커리어가 생긴 뒤 따로 불러온다
 * (번들러가 별도 청크로 자른다). 불러오기 전에는 이벤트가 없는 것으로 본다.
 */
export function useStorySchedule(career: PlayerCareer | null) {
  const [events, setEvents] = useState<readonly OriginalEvent[] | null>(null)

  useEffect(() => {
    if (career === null || events !== null) return
    let isActive = true
    void import('@/shared/config/original/events').then((module) => {
      if (isActive) setEvents(module.ORIGINAL_EVENTS)
    })
    return () => {
      isActive = false
    }
  }, [career, events])

  /** 지도 [!] — 무작위 조건 없이 볼 수 있는 이벤트가 있는 장소 */
  const eventPlaceIds = useMemo(() => {
    if (career === null || events === null) return new Set<string>()
    return new Set(
      OUTING_PLACES.filter((place) => nextEventFor(career, events, placeTriggerOf(place.frame)) !== null).map(
        (place) => place.id,
      ),
    )
  }, [career, events])

  /**
   * 이벤트 레코드 커서 (0xadc70 의 reader+0x28). 원본은 **다음 호출이 지난 자리부터** 훑고,
   * 끝까지 없으면 0 으로 되감는다 (A-1 확정). 지우는 시점이 원본 저장 어디인지는 문서에 없어
   * 세션 동안만 들고 있다 — 불러오기 뒤 처음부터 훑는 것이 다를 수 있다 (**근사**).
   */
  const cursorRef = useRef(0)

  const eventFor = (current: PlayerCareer, trigger: number, random?: RandomPort) => {
    if (events === null) return null
    const scan = scanEventFrom(current, events, trigger, cursorRef.current, random)
    cursorRef.current = scan.cursor
    return scan.event
  }

  return { events, eventPlaceIds, eventFor }
}
