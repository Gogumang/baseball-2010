import { describe, expect, it } from 'vitest'
import {
  branchOnlyEventIds,
  EVENT_TRIGGER,
  finishEvent,
  forgetRepeatableEvents,
  illnessChanceOf,
  nextEventFor,
  OPENING_EVENT_ID,
  placeTriggerOf,
  scanEventFrom,
} from '@/entities/story/model/storyScene'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { TOTAL_EVENT_COUNT } from '@/shared/config/original/eventMeta'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import type { RandomPort } from '@/shared/api/random/randomPort'

function 선수(overrides: Partial<PlayerCareer> = {}): PlayerCareer {
  return { ...createCareer('테스트'), ...overrides }
}

const 오프닝을본선수 = (overrides: Partial<PlayerCareer> = {}) =>
  선수({ seenEventIds: [String(OPENING_EVENT_ID)], ...overrides })

const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + (maximum - minimum) * value,
  pick: (candidates) => candidates[0],
})

describe('원본 r_event 이벤트 데이터', () => {
  it('해독한 이벤트가 전부 들어 있다', () => {
    expect(ORIGINAL_EVENTS).toHaveLength(TOTAL_EVENT_COUNT)
    expect(TOTAL_EVENT_COUNT).toBe(313)
  })

  it('첫 이벤트는 원작 오프닝 꿈 장면이다', () => {
    const 대사 = ORIGINAL_EVENTS[0].commands
      .flatMap((command) => (command.op === 'say' ? [stripGameMarkup(command.text)] : []))
      .join(' ')
    expect(ORIGINAL_EVENTS[0].id).toBe(OPENING_EVENT_ID)
    expect(대사).toContain('더 크게 불러줘')
  })

  it('선택지가 가리키는 이벤트는 전부 존재한다', () => {
    const ids = new Set(ORIGINAL_EVENTS.map((event) => event.id))
    const 없는목표 = [...branchOnlyEventIds(ORIGINAL_EVENTS)].filter((id) => !ids.has(id))
    expect(없는목표).toEqual([])
  })

  it('대상 편은 0 코드 호출 · 1 공통 · 2 타자 · 3 투수 네 가지다', () => {
    expect(new Set(ORIGINAL_EVENTS.map((event) => event.audience))).toEqual(new Set([0, 1, 2, 3]))
  })
})

describe('nextEventFor — 원본 이벤트 일정', () => {
  it('새 선수는 관리 화면에서 오프닝(451)부터 본다', () => {
    expect(nextEventFor(선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).toBe(OPENING_EVENT_ID)
  })

  it('오프닝 다음은 1년차 1경기의 주장 이벤트(1)다 — 날짜 [1,1]', () => {
    expect(nextEventFor(오프닝을본선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).toBe(1)
  })

  it('날짜 창 밖이면 나오지 않는다 — 1년차 2경기에는 이벤트 1 이 없다', () => {
    const career = 오프닝을본선수({ gamesPlayed: 1 })

    expect(nextEventFor(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).not.toBe(1)
  })

  it('장소 이벤트는 그 장소 trigger 에서만 나온다 — 병원(프레임 3)은 메디카', () => {
    const hospital = placeTriggerOf(3)
    const event = nextEventFor(오프닝을본선수({ gamesPlayed: 20 }), ORIGINAL_EVENTS, hospital)

    expect(hospital).toBe(4)
    expect(event?.trigger).toBe(4)
  })

  it('타자편에는 투수 전용(3) 이벤트와 코드 호출(0) 이벤트가 나오지 않는다', () => {
    const shown = new Set<number>()
    for (let season = 1; season <= 13; season += 1) {
      for (const gamesPlayed of [0, 10, 20, 30, 44]) {
        for (let trigger = 0; trigger <= 6; trigger += 1) {
          const event = nextEventFor(오프닝을본선수({ season, gamesPlayed }), ORIGINAL_EVENTS, trigger)
          if (event !== null) shown.add(event.id)
        }
      }
    }
    const wrong = ORIGINAL_EVENTS.filter((event) => shown.has(event.id) && (event.audience === 3 || event.audience === 0))

    expect(wrong.map((event) => event.id)).toEqual([])
  })

  it('선행 이벤트를 보지 않았으면 나오지 않는다', () => {
    const chained = ORIGINAL_EVENTS.find((event) => event.requiresEvent !== 0 && event.audience === 1)!
    const seenAllButPrerequisite = 오프닝을본선수({
      season: 13,
      gamesPlayed: 44,
      seenEventIds: ORIGINAL_EVENTS.filter((event) => event.id !== chained.requiresEvent && event.id !== chained.id).map(
        (event) => String(event.id),
      ),
    })

    expect(nextEventFor(seenAllButPrerequisite, ORIGINAL_EVENTS, chained.trigger)?.id).not.toBe(chained.id)
  })

  it('본 이벤트는 다시 나오지 않는다 (반복 이벤트 제외)', () => {
    const first = nextEventFor(오프닝을본선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리)!
    const after = finishEvent(오프닝을본선수(), [first.id])

    expect(nextEventFor(after, ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).not.toBe(first.id)
  })
})

describe('scanEventFrom — 커서 이어 쓰기 (0xadc70)', () => {
  it('찾은 레코드 자리에 커서가 멈춘다', () => {
    const scan = scanEventFrom(오프닝을본선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 0)

    expect(scan.event?.id).toBe(1)
    expect(ORIGINAL_EVENTS[scan.cursor].id).toBe(1)
  })

  it('그 자리에서 다시 불러도 — 본 이벤트가 되었으니 — 같은 것을 또 주지 않는다', () => {
    const 처음 = scanEventFrom(오프닝을본선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 0)
    const 본뒤 = finishEvent(오프닝을본선수(), [처음.event!.id])
    const 다음 = scanEventFrom(본뒤, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 처음.cursor)

    expect(다음.event?.id).not.toBe(처음.event?.id)
  })

  it('커서를 이어 쓰며 훑으면 한 이벤트를 두 번 주지 않는다', () => {
    let career = 오프닝을본선수()
    let cursor = 0
    const 본것: number[] = []
    for (let round = 0; round < 8; round += 1) {
      const scan = scanEventFrom(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, cursor)
      cursor = scan.cursor
      if (scan.event === null) continue
      본것.push(scan.event.id)
      career = finishEvent(career, [scan.event.id])
    }

    expect(본것.length).toBeGreaterThan(0)
    expect(new Set(본것).size).toBe(본것.length)
  })

  it('커서 앞쪽은 다시 훑지 않는다 — 처음부터 훑던 웹과 달라지는 지점', () => {
    const career = 오프닝을본선수()
    const 처음 = scanEventFrom(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 0)

    expect(scanEventFrom(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 처음.cursor + 1).event?.id)
      .not.toBe(처음.event?.id)
  })

  it('끝까지 없으면 커서를 0 으로 되감고 그 호출은 "없음" 이다', () => {
    const scan = scanEventFrom(오프닝을본선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리, ORIGINAL_EVENTS.length)

    expect(scan.event).toBeNull()
    expect(scan.cursor).toBe(0)
  })

  it('오프닝은 번호 호출이라 커서에 "그 다음 칸" 이 남는다 (0xae170)', () => {
    const scan = scanEventFrom(선수(), ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 0)

    expect(scan.event?.id).toBe(OPENING_EVENT_ID)
    expect(scan.cursor).toBe(ORIGINAL_EVENTS.findIndex((event) => event.id === OPENING_EVENT_ID) + 1)
  })

  it('nextEventFor 는 늘 처음부터 훑는다 — 장소 [!] 배정 0x8cdc0 갈래', () => {
    const career = 오프닝을본선수()

    expect(nextEventFor(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id)
      .toBe(scanEventFrom(career, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 0).event?.id)
  })
})

describe('조건 판정 (switch 0xd83a0)', () => {
  it('25 는 "이벤트 v 를 아직 안 봤다" — 재도전은 승리 이벤트를 보기 전까지만', () => {
    const 재도전 = ORIGINAL_EVENTS.find((event) => event.id === 126)!
    const 준비된선수 = 오프닝을본선수({
      season: 8,
      gamesPlayed: 0,
      // 126 은 패배 분기 125 를 본 뒤(requiresEvent), 승리 분기 124 를 보기 전(조건 25)에만 나온다
      seenEventIds: [
        '125',
        ...ORIGINAL_EVENTS.filter((event) => event.trigger === 재도전.trigger && event.id !== 126).map((event) => String(event.id)),
      ],
    })

    expect(nextEventFor(준비된선수, ORIGINAL_EVENTS, 재도전.trigger)?.id).toBe(126)
    expect(nextEventFor(finishEvent(준비된선수, [124]), ORIGINAL_EVENTS, 재도전.trigger)?.id).not.toBe(126)
  })

  it('19 는 평판 ≥ 값 — 487 "타격감이 좋아졌구나" (540)', () => {
    const others = ORIGINAL_EVENTS.filter((event) => event.id !== 487).map((event) => String(event.id))
    const 선수기록 = (reputation: number) => 오프닝을본선수({ reputation, seenEventIds: others })

    expect(nextEventFor(선수기록(539), ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).not.toBe(487)
    expect(nextEventFor(선수기록(540), ORIGINAL_EVENTS, EVENT_TRIGGER.관리)?.id).toBe(487)
  })

  it('반복 이벤트도 한 번 보면 막힌다 — 원본은 저장을 불러올 때 다시 푼다 (0xacf60)', () => {
    const 재도전 = ORIGINAL_EVENTS.find((event) => event.id === 126)!
    const 본선수 = 오프닝을본선수({
      season: 8,
      seenEventIds: ['125', ...ORIGINAL_EVENTS.filter((event) => event.trigger === 재도전.trigger).map((event) => String(event.id))],
    })

    expect(nextEventFor(본선수, ORIGINAL_EVENTS, 재도전.trigger)?.id).not.toBe(126)
    expect(nextEventFor(forgetRepeatableEvents(본선수, ORIGINAL_EVENTS), ORIGINAL_EVENTS, 재도전.trigger)?.id).toBe(126)
  })

  it('질병 쿨다운이 남아 있으면 490 이 나오지 않는다 (선수 +0x7c)', () => {
    const 지친선수 = 오프닝을본선수({
      morale: 5,
      season: 2,
      illnessCooldown: 5,
      seenEventIds: ORIGINAL_EVENTS.filter((event) => event.id !== 490).map((event) => String(event.id)),
    })

    expect(nextEventFor(지친선수, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 고정난수(0))?.id).not.toBe(490)
  })
})

describe('질병 조건 22 — 사기 구간 확률 (0xadb32)', () => {
  it('사기 70 초과 0%, 51~70 2%, 31~50 4%, 11~30 7%, 10 이하 14%', () => {
    expect([80, 70, 51, 50, 31, 30, 11, 10, 0].map((morale) => illnessChanceOf(morale))).toEqual([0, 2, 2, 4, 4, 7, 7, 14, 14])
  })

  it('유리몸(4)은 +10, 행운(6)은 −20 — 0 미만은 0 으로 자른다 (G-8)', () => {
    expect(illnessChanceOf(30, [4])).toBe(7 + 10)
    expect(illnessChanceOf(30, [6])).toBe(0)
    expect(illnessChanceOf(0, [4, 6])).toBe(14 + 10 - 20)
  })

  it('확률에 걸리지 않으면 질병 이벤트(490)가 나오지 않는다', () => {
    const 지친선수 = 오프닝을본선수({
      morale: 5,
      season: 2,
      seenEventIds: ORIGINAL_EVENTS.filter((event) => event.id !== 490).map((event) => String(event.id)),
    })

    expect(nextEventFor(지친선수, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 고정난수(0.99))?.id).not.toBe(490)
    expect(nextEventFor(지친선수, ORIGINAL_EVENTS, EVENT_TRIGGER.관리, 고정난수(0))?.id).toBe(490)
  })
})

describe('finishEvent', () => {
  it('본 이벤트 번호를 모두 남기고 입력은 바꾸지 않는다', () => {
    const before = 선수()
    const after = finishEvent(before, [OPENING_EVENT_ID, 2])

    expect(after.seenEventIds).toEqual([String(OPENING_EVENT_ID), '2'])
    expect(before.seenEventIds).toEqual([])
  })
})
