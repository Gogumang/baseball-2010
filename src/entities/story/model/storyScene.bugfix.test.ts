import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { requiredEventIdOf } from '@/entities/story/model/storyScene'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 이벤트 = (id: number) => ORIGINAL_EVENTS.find((event) => event.id === id)!

describe('B-33 발렌타인 2차 재도전 228 · 229 의 선행 번호 (이벤트 표)', () => {
  it('원본: 표 그대로 1차 패배 219 — 1차 재도전 220 과 같은 꼴', () => {
    expect([228, 229, 220].map((id) => requiredEventIdOf(이벤트(id)))).toEqual([219, 219, 219])
  })

  it('고침: 228 · 229 만 2차 패배 227 로 — 다른 이벤트는 표 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-33']))
    expect([228, 229, 220].map((id) => requiredEventIdOf(이벤트(id)))).toEqual([227, 227, 219])
    const 나머지 = ORIGINAL_EVENTS.filter((event) => event.id !== 228 && event.id !== 229)
    expect(나머지.every((event) => requiredEventIdOf(event) === event.requiresEvent)).toBe(true)
  })
})
