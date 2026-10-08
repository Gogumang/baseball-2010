import { describe, expect, it } from 'vitest'
import { advanceCursor, jumpToEvent, skipSayCursor, stepFrom } from '@/entities/story/model/eventScript'
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

  it('예아니오는 하위 0 일 때만 멈춘다 — ≠ 0 이면 건너뛴다 (0x8d426 · 0x8d432)', () => {
    const 질문: OriginalEvent[] = [{
      id: 1, audience: 0, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions: [],
      commands: [
        { op: 'yesno', sub: 1, text: '건너뛴다', yesEvent: 2, noEvent: 3 },
        { op: 'yesno', sub: 0, text: '묻는다', yesEvent: 2, noEvent: 3 },
      ],
    }]
    const step = stepFrom(질문, jumpToEvent(1))
    expect(step.command).toMatchObject({ op: 'yesno', text: '묻는다' })
    expect(step.passed.map((command) => command.op)).toEqual(['yesno'])
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


describe('skipSayCursor — say 중 취소 0x8b7b0', () => {
  const 대본: OriginalEvent[] = [{
    id: 7, audience: 0, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions: [],
    commands: [
      { op: 'say', text: '하나', speaker: 2, format: 0, portraits: [] },
      { op: 'sound', id: 3 },
      { op: 'effect', id: 6 },
      { op: 'say', text: '둘', speaker: 2, format: 0, portraits: [] },
      { op: 'reward', items: [{ kind: 0, value: 5 }] },
      { op: 'say', text: '셋', speaker: 2, format: 0, portraits: [] },
      { op: 'effect', id: 1 },
    ],
  }]

  it('say · 소리 · 효과를 건너뛰어 다음 보상(종류 7)에 선다', () => {
    expect(skipSayCursor(대본, { eventId: 7, commandIndex: 0 })).toEqual({ eventId: 7, commandIndex: 4 })
  })

  it('뒤에 멈출 명령이 없으면 끝으로 — 마지막 명령(효과)도 안 돈다', () => {
    const cursor = skipSayCursor(대본, { eventId: 7, commandIndex: 5 })
    expect(cursor).toEqual({ eventId: 7, commandIndex: 7 })
    expect(stepFrom(대본, cursor)).toMatchObject({ command: null, passed: [] })
  })

  it('system · 선택지 · 예아니오 · 4 · 경기도 멈출 명령이다 (하위와 상관없이)', () => {
    const ops: OriginalEvent['commands'] = [
      { op: 'system', sub: 2, arg: 0 },
      { op: 'choice', portraits: [], choices: [] },
      { op: 'yesno', sub: 1, text: '', yesEvent: 0, noEvent: 0 },
      { op: 'op4', sub: 0, arg: 0, pairs: [] },
      { op: 'match', team: 0, resultEvents: [] },
    ]
    ops.forEach((command) => {
      const event: OriginalEvent = { ...대본[0], commands: [대본[0].commands[0], { op: 'sound', id: 1 }, command] }
      expect(skipSayCursor([event], { eventId: 7, commandIndex: 0 }).commandIndex).toBe(2)
    })
  })
})
