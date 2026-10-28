import { describe, expect, it } from 'vitest'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { eventPortraitCastOf } from '@/pages/story/lib/eventPortraitCast'

const eventOf = (id: number, commands: OriginalEvent['commands']): OriginalEvent => ({
  id,
  audience: 1,
  repeatable: false,
  trigger: 0,
  requiresEvent: 0,
  dateFrom: [0, 0],
  dateTo: [0, 0],
  conditions: [],
  commands,
})

describe('대본이 띄울 수 있는 초상화 (r193 — 표정 미리 칠하기)', () => {
  it('시작 이벤트와 선택지로 넘어갈 이벤트의 say · choice 초상화를 겹치지 않게 모은다', () => {
    const hero = (animation: number) => ({ file: 'event_char_0', animation, side: 'left' }) as const
    const start = eventOf(1, [
      { op: 'say', text: '', speaker: 0, format: 0, portraits: [hero(0)] },
      { op: 'say', text: '', speaker: 0, format: 0, portraits: [hero(0), hero(3)] },
      { op: 'choice', portraits: [hero(5)], choices: [{ text: '', gotoEvent: 2 }] },
    ])
    const branch = eventOf(2, [{ op: 'say', text: '', speaker: 0, format: 0, portraits: [hero(6)] }])
    const unrelated = eventOf(3, [{ op: 'say', text: '', speaker: 0, format: 0, portraits: [hero(7)] }])
    const cast = eventPortraitCastOf([start, branch, unrelated], start)
    expect(cast.map((portrait) => portrait.animation).sort()).toEqual([0, 3, 5, 6])
  })
})
