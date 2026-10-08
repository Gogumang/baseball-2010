// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useStorySchedule } from '@/app/model/useStorySchedule'
import { createCareer } from '@/entities/career/model/playerCareer'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'

describe('이벤트 레코드 커서 reader+0x28', () => {
  it('훑기는 멈춘 자리부터 이어 가고, 112 진입의 0x8cdc0 은 커서를 0 으로 되감는다 (0x8cdd4 · 0x8ce34)', async () => {
    const base = createCareer('커서')
    const rendered = renderHook(() => useStorySchedule(base))
    await waitFor(() => expect(rendered.result.current.events).not.toBeNull(), { timeout: 5000 })
    // 401(인기도 3000, 파일 93번째)은 보고, 10(9 를 본 뒤 1년 11~45경기, 파일 54번째)은 아직 — 둘 다 trigger 1
    const 앞 = { ...base, popularity: 3000, gamesPlayed: 20, seenEventIds: [...base.seenEventIds, '451'] }
    const 뒤 = { ...앞, seenEventIds: [...앞.seenEventIds, '9', '401'] }

    type 뽑힘 = { readonly id: number } | null
    const 본: { 첫: 뽑힘; 이어서: 뽑힘; 되감고: 뽑힘 } = { 첫: null, 이어서: null, 되감고: null }
    act(() => {
      본.첫 = rendered.result.current.eventFor(앞, EVENT_TRIGGER.외출)
      // 커서가 401 에 멈춰 있어 그 앞의 10 을 못 보고 끝까지 가 "없음" (그리고 0 으로 되감긴다)
      본.이어서 = rendered.result.current.eventFor(뒤, EVENT_TRIGGER.외출)
    })
    expect(본.첫?.id).toBe(401)
    expect(본.이어서).toBeNull()

    act(() => {
      본.첫 = rendered.result.current.eventFor(앞, EVENT_TRIGGER.외출)
      rendered.result.current.rewindCursor()
      본.되감고 = rendered.result.current.eventFor(뒤, EVENT_TRIGGER.외출)
    })
    expect(본.첫?.id).toBe(401)
    expect(본.되감고?.id).toBe(10)
  })
})
