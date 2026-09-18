import { describe, expect, it } from 'vitest'
import { advanceCursor, jumpToEvent, stepFrom } from '@/entities/story/model/eventScript'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'

const 이벤트: OriginalEvent[] = [
  {
    id: 451, audience: 0, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions: [],
    commands: [
      { op: 'sound', id: 31 },
      { op: 'effect', id: 6 },
      { op: 'say', text: '첫 대사', speaker: 2, format: 0, portraits: [{ file: 'event_char_0', animation: 19, side: 'left' }] },
      { op: 'reward', items: [{ kind: 3, value: 5 }] },
      { op: 'choice', portraits: [], choices: [{ text: '간다', gotoEvent: 500 }, { text: '안 간다', gotoEvent: 501 }] },
    ],
  },
  {
    id: 500, audience: 0, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions: [],
    commands: [{ op: 'say', text: '분기 대사', speaker: 1, format: 1, portraits: [] }],
  },
]

describe('stepFrom — 원작 이벤트 스크립트 진행', () => {
  it('소리·효과는 지나가고 첫 대사에서 멈춘다', () => {
    const step = stepFrom(이벤트, jumpToEvent(451))
    expect(step.command?.op).toBe('say')
    expect(step.passed.map((command) => command.op)).toEqual(['sound', 'effect'])
    expect(step.cursor.commandIndex).toBe(2)
  })

  it('다음으로 가면 보상을 지나 선택지에서 멈춘다', () => {
    const first = stepFrom(이벤트, jumpToEvent(451))
    const second = stepFrom(이벤트, advanceCursor(first.cursor))
    expect(second.command?.op).toBe('choice')
    expect(second.passed.map((command) => command.op)).toEqual(['reward'])
  })

  it('선택지가 가리키는 이벤트로 넘어간다', () => {
    const step = stepFrom(이벤트, jumpToEvent(500))
    expect(step.command).toMatchObject({ op: 'say', text: '분기 대사' })
  })

  it('명령을 다 쓰면 끝이다', () => {
    const step = stepFrom(이벤트, { eventId: 500, commandIndex: 1 })
    expect(step.command).toBeNull()
  })

  it('없는 이벤트는 바로 끝이다', () => {
    expect(stepFrom(이벤트, jumpToEvent(9999)).command).toBeNull()
  })
})

describe('match — 마선수 대결 명령 (누락 탐색 8차)', () => {
  const 대결: OriginalEvent[] = [
    {
      id: 112, audience: 0, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions: [],
      commands: [
        { op: 'say', text: '한판 붙자', speaker: 2, format: 0, portraits: [] },
        { op: 'reward', items: [{ kind: 0, value: 1 }] },
        { op: 'match', team: 16, resultEvents: [114, 115] },
        { op: 'say', text: '뒷대사', speaker: 2, format: 0, portraits: [] },
      ],
    },
  ]

  it('경기 명령에서 멈춘다 — 결과를 받아야 이어 간다', () => {
    const first = stepFrom(대결, jumpToEvent(112))
    const second = stepFrom(대결, advanceCursor(first.cursor))
    expect(second.command).toEqual({ op: 'match', team: 16, resultEvents: [114, 115] })
    expect(second.passed.map((command) => command.op)).toEqual(['reward'])
  })
})

