import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { ORIGINAL_SEASON_EVENTS } from '@/shared/config/original/seasonEvents'
import {
  ILLNESS_COOLDOWN,
  ILLNESS_SLACK_ON_CATCH,
  START_SEASON_EVENT_CURSOR,
  SEASON_PLAYABLE_EVENTS,
  YEAR_GOAL_EVENT_ID,
  applySeasonEventRewards,
  clearRepeatableSeen,
  cureIllnessAtHospital,
  cureIllnessByItem,
  cursorAfterCalling,
  illnessChancePercentOf,
  illnessPenaltyFieldOf,
  isInSeasonEventWindow,
  markEventSeen,
  moralePenaltyOf,
  opensSeasonGoalWindow,
  pollSeasonEvents,
  seasonEventFollowUpOf,
  selectSeasonEvent,
  tickAfterAnyGame,
  withSeasonYearAdjust,
} from '@/entities/season-mode/model/seasonEventFlow'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  // 연초 목표는 따로 본다 — 여기서는 이미 본 것으로
  yearGoalShown: true,
  ...덮어쓰기,
})

/** next() 가 고정값을 돌려주는 난수 — randomIntegerBelow 가 `min + floor(next × 폭)` 을 쓴다 */
const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: <T,>(candidates: readonly T[]) => candidates[0],
})

/** 몇 번 불렸는지 세는 난수 */
const 세는난수 = (value: number) => {
  let calls = 0
  const random: RandomPort = { ...고정난수(value), next: () => { calls += 1; return value } }
  return { random, calls: () => calls }
}

const 판정 = (record: SeasonRecord, 덮어쓰기: { teamMorale?: number; event100Awarded?: boolean } = {}) => ({
  record,
  teamMorale: 덮어쓰기.teamMorale ?? 100,
  screenCode: 201,
  event100Awarded: 덮어쓰기.event100Awarded ?? false,
})

const 이벤트 = (id: number) => ORIGINAL_SEASON_EVENTS.find((event) => event.id === id)!

describe('s_event 30편 — 대상 4(시즌 자동)는 다섯 편', () => {
  it('파일 차례 그대로 400 · 490 · 1 · 5 · 100 이 대상 4 다', () => {
    expect(ORIGINAL_SEASON_EVENTS).toHaveLength(30)
    expect(ORIGINAL_SEASON_EVENTS.filter((event) => event.audience === 4).map((event) => event.id))
      .toEqual([400, 490, 1, 5, 100])
  })

  it('날짜 창: 1 은 now 1 · 5 는 now 3 · 100 은 now 21 · 490 은 1~585', () => {
    expect(isInSeasonEventWindow(이벤트(1), 기본({ games: 0 }))).toBe(true)
    expect(isInSeasonEventWindow(이벤트(1), 기본({ games: 2 }))).toBe(false)
    expect(isInSeasonEventWindow(이벤트(5), 기본({ games: 2 }))).toBe(true)
    expect(isInSeasonEventWindow(이벤트(100), 기본({ games: 20 }))).toBe(true)
    expect(isInSeasonEventWindow(이벤트(100), 기본({ games: 20, yearIndex: 1 }))).toBe(false)
    expect(isInSeasonEventWindow(이벤트(490), 기본({ games: 44, yearIndex: 9 }))).toBe(true)
  })
})

describe('고르기 0xadc70 — 파일 차례로 처음 통과한 한 건, 커서를 이어 쓴다', () => {
  it('첫 관리 메뉴(now 1)에는 오프닝 400 이 아직 안 봤으면 그것부터 걸린다 (날짜·조건이 없다)', () => {
    const 고름 = selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(기본()), 고정난수(0.99))
    expect(고름.eventId).toBe(400)
  })

  it('400 을 봤으면 now 1 에 1(환영)이 걸린다 — 사기 100 이라 490 은 확률 0 으로 지나간다', () => {
    const 고름 = selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(markEventSeen(기본(), 400)), 고정난수(0))
    expect(고름.eventId).toBe(1)
  })

  it('조건 22 는 p 가 0 이어도 rand 를 한 번 돈다 (adbd2)', () => {
    const 난수 = 세는난수(0)
    selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(markEventSeen(기본({ games: 4 }), 400)), 난수.random)
    expect(난수.calls()).toBe(1)
  })

  it('질병 쿨다운이 남았거나 이미 앓고 있으면 rand 를 돌지 않는다', () => {
    const 쿨다운 = 세는난수(0)
    selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(markEventSeen(기본({ games: 4, illnessCooldown: 3 }), 400)), 쿨다운.random)
    expect(쿨다운.calls()).toBe(0)
    const 앓음 = 세는난수(0)
    selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(markEventSeen(기본({ games: 4, illness: 2 }), 400)), 앓음.random)
    expect(앓음.calls()).toBe(0)
  })

  it('사기가 낮으면 490 이 굴림에 걸린다', () => {
    const record = markEventSeen(기본({ games: 4 }), 400)
    expect(selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(record, { teamMorale: 10 }), 고정난수(0)).eventId).toBe(490)
    expect(selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(record, { teamMorale: 10 }), 고정난수(0.5)).eventId).toBeNull()
  })

  it('끝까지 없으면 커서를 0 으로 되감고 "없음"', () => {
    const 고름 = selectSeasonEvent({ position: 5, pending: 0 }, 판정(markEventSeen(기본({ games: 6 }), 400)), 고정난수(0.99))
    expect(고름.eventId).toBeNull()
    expect(고름.cursor).toEqual(START_SEASON_EVENT_CURSOR)
  })

  it('커서가 지난 레코드는 그 호출에서 보지 않는다 (이어 쓰기)', () => {
    // 400 레코드(첨자 0) 뒤에서 시작하면 안 본 400 이 걸리지 않는다
    const 고름 = selectSeasonEvent({ position: 1, pending: 0 }, 판정(기본({ games: 6 })), 고정난수(0.99))
    expect(고름.eventId).toBeNull()
  })

  it('번호로 부르면 +0x2c 가 그 레코드 다음을 가리킨다 (0xae170)', () => {
    const 커서 = cursorAfterCalling(START_SEASON_EVENT_CURSOR, 1)
    expect(커서.pending).toBe(ORIGINAL_SEASON_EVENTS.findIndex((event) => event.id === 1) + 1)
  })

  it('이벤트 100 특례 — 전역 +0xbe 가 서 있으면 본 비트를 켜고 불발', () => {
    const record = markEventSeen(기본({ games: 20 }), 400)
    const 고름 = selectSeasonEvent(START_SEASON_EVENT_CURSOR, 판정(record, { event100Awarded: true }), 고정난수(0.99))
    expect(고름.eventId).toBeNull()
    expect(고름.record.seenEvents).toContain(100)
  })

  it('본 이벤트는 반복이라도 불발이다 — 장면을 새로 만들 때 반복 이벤트의 비트만 지워진다', () => {
    const 본 = markEventSeen(markEventSeen(기본(), 490), 1)
    expect(clearRepeatableSeen(본).seenEvents).toEqual([1])
  })
})

describe('관리 메뉴에 들어온 틀 (0x4efc 끝 + 폴링 eb7e)', () => {
  const 폴링 = (record: SeasonRecord, 덮어쓰기: { newPlayerFlag?: boolean; scene?: typeof SEASON_SCENE_STATE.관리메뉴 | typeof SEASON_SCENE_STATE.외출지도 } = {}) =>
    pollSeasonEvents(START_SEASON_EVENT_CURSOR, {
      scene: 덮어쓰기.scene ?? SEASON_SCENE_STATE.관리메뉴,
      record,
      teamMorale: 100,
      event100Awarded: false,
      newPlayerFlag: 덮어쓰기.newPlayerFlag ?? false,
    }, 고정난수(0.99))

  it('새 선수 플래그가 서 있으면 연초 목표보다도 먼저 오프닝 400', () => {
    expect(폴링(기본({ yearGoalShown: false }), { newPlayerFlag: true }).poll).toEqual({ kind: '오프닝' })
  })

  it('SR+0x187 이 0 이면 연초 목표 0xd4 — 파일 이벤트는 보지 않는다', () => {
    expect(폴링(기본({ yearGoalShown: false })).poll).toEqual({ kind: '연초목표' })
  })

  it('엔딩을 본 시즌(SR+0x1bc)은 연초 목표가 없다', () => {
    expect(폴링(markEventSeen(기본({ yearGoalShown: false, endingSeen: true, games: 6 }), 400)).poll).toEqual({ kind: '없음' })
  })

  it('외출 지도(209)에서는 trigger 0 이 받지 않아 아무것도 안 뜬다', () => {
    expect(폴링(기본(), { scene: SEASON_SCENE_STATE.외출지도 }).poll).toEqual({ kind: '없음' })
  })
})

describe('연초 목표 내장 이벤트 (0x8a680)', () => {
  it('감독 대사 StrUSER_EVT[1] 다음 SYS(sub 1) 목표 창', () => {
    const 내장 = SEASON_PLAYABLE_EVENTS.find((event) => event.id === YEAR_GOAL_EVENT_ID)!
    expect(내장.commands[0]).toMatchObject({ op: 'say', speaker: 2, text: '올해의 목표다!! 많이 달성할수록 1년 후 높은 보너스를 받을 수 있지!!' })
    expect(내장.commands[1]).toMatchObject({ op: 'system', sub: 1 })
  })

  it('목표 창은 내장 이벤트와 392 가 연다', () => {
    expect(opensSeasonGoalWindow(YEAR_GOAL_EVENT_ID)).toBe(true)
    expect(opensSeasonGoalWindow(392)).toBe(true)
    expect(opensSeasonGoalWindow(1)).toBe(false)
  })

  it('392 는 끝에서 목표 결과로 이어진다', () => {
    expect(seasonEventFollowUpOf(392, () => 394)).toBe(394)
    expect(seasonEventFollowUpOf(401, () => 394)).toBeNull()
  })
})

describe('보상 0x8c460 모드 2', () => {
  const 상태 = (record: SeasonRecord = 기본()) => ({ ...startNewSeason(0, 'T'), record })

  it('393~395 는 종류 0·1·3 에 +5y, 396 은 인기도 −10y · 평판 −2y (0x8d508)', () => {
    expect(withSeasonYearAdjust([{ kind: 0, value: 25 }, { kind: 1, value: 30 }, { kind: 3, value: 35 }], 393, 2))
      .toEqual([{ kind: 0, value: 35 }, { kind: 1, value: 40 }, { kind: 3, value: 45 }])
    expect(withSeasonYearAdjust([{ kind: 0, value: -10 }, { kind: 1, value: -5 }], 396, 3))
      .toEqual([{ kind: 0, value: -40 }, { kind: 1, value: -11 }])
    expect(withSeasonYearAdjust([{ kind: 0, value: 15 }], 401, 3)).toEqual([{ kind: 0, value: 15 }])
  })

  it('인기도·평판·소지금을 더하고 0..상한으로 자른다', () => {
    const 적용 = applySeasonEventRewards(상태(기본({ popularity: 5, reputation: 990 })),
      [{ kind: 0, value: -10 }, { kind: 1, value: 20 }, { kind: 3, value: 30 }], 403, 고정난수(0))
    expect(적용.state.record.popularity).toBe(0)
    expect(적용.state.record.reputation).toBe(999)
    expect(적용.state.record.money).toBe(80)
  })

  it('G 는 전역으로 · 이벤트 100 이면 +0xbe 를 켠다', () => {
    const 적용 = applySeasonEventRewards(상태(), [{ kind: 10, value: 1000 }], 100, 고정난수(0))
    expect(적용.gamePoint).toBe(1000)
    expect(적용.event100Awarded).toBe(true)
  })

  it('질병 11 의 값 0 은 rand(0,4)+1 로 다시 써져 실제 병이 된다 — SR+6 = 3 · 쿨다운 20', () => {
    const 적용 = applySeasonEventRewards(상태(), [{ kind: 11, value: 0 }], 490, 고정난수(0.99))
    expect(적용.state.record.illness).toBe(4)
    expect(적용.state.record.illnessSlack).toBe(ILLNESS_SLACK_ON_CATCH)
    expect(적용.state.record.illnessCooldown).toBe(ILLNESS_COOLDOWN)
  })

  it('질병 11 의 값 > 0 은 알림 글이 굴려 적은 번호 — 다시 안 굴린다 (0x8c718)', () => {
    const 굴림 = { next: () => { throw new Error('굴리면 안 된다') } } as unknown as Parameters<typeof applySeasonEventRewards>[3]
    expect(applySeasonEventRewards(상태(), [{ kind: 11, value: 2 }], 490, 굴림).state.record.illness).toBe(2)
  })

  it('첫 항목이 21 이면 엔딩 진입 (500)', () => {
    expect(applySeasonEventRewards(상태(), [{ kind: 21, value: 0 }], 500, 고정난수(0)).entersEnding).toBe(true)
  })
})

describe('시즌 질병 (조건 22) — 팀 사기로 읽고 유리몸·행운 보정이 없다', () => {
  it('확률 구간표 그대로다', () => {
    expect(illnessChancePercentOf(100)).toBe(0)
    expect(illnessChancePercentOf(71)).toBe(0)
    expect(illnessChancePercentOf(70)).toBe(2)
    expect(illnessChancePercentOf(51)).toBe(2)
    expect(illnessChancePercentOf(50)).toBe(4)
    expect(illnessChancePercentOf(31)).toBe(4)
    expect(illnessChancePercentOf(30)).toBe(7)
    expect(illnessChancePercentOf(11)).toBe(7)
    expect(illnessChancePercentOf(10)).toBe(14)
    expect(illnessChancePercentOf(0)).toBe(14)
  })

  it('능력치 −30% 는 질병 종류(SR+5)가 아니라 SR+6 을 본다 (0xb5824)', () => {
    expect(illnessPenaltyFieldOf(기본({ illness: 2, illnessSlack: 0 }))).toBe(0)
    expect(illnessPenaltyFieldOf(기본({ illness: 2, illnessSlack: 3 }))).toBe(3)
  })
})

describe('질병 낫기', () => {
  it('입원은 rand(0,101) ≤ 89 면 낫는다 (90/101)', () => {
    const 아픈 = 기본({ illness: 3, illnessSlack: 3 })
    // 0.88 × 101 = 88.88 → 88 ≤ 89 → 치료
    expect(cureIllnessAtHospital(아픈, 고정난수(0.88)).cured).toBe(true)
    // 0.95 × 101 = 95.95 → 95 > 89 → 실패, 여유 칸만 준다
    const 실패 = cureIllnessAtHospital(아픈, 고정난수(0.95))
    expect(실패.cured).toBe(false)
    expect(실패.record.illness).toBe(3)
    expect(실패.record.illnessSlack).toBe(2)
  })

  it('여유 칸이 0 이면 굴림과 상관없이 낫는다', () => {
    const 결과 = cureIllnessAtHospital(기본({ illness: 3, illnessSlack: 0 }), 고정난수(0.99))
    expect(결과.cured).toBe(true)
    expect(결과.record.illness).toBe(0)
    expect(결과.record.illnessCooldown).toBe(ILLNESS_COOLDOWN)
  })

  it('GP 아이템은 무조건 낫는다', () => {
    expect(cureIllnessByItem(기본({ illness: 4, illnessSlack: 3 })).illness).toBe(0)
  })
})

describe('경기 끝 꼬리 4f374 — 어느 갈래든 목표점 보기·질병 쿨다운이 하나씩 준다', () => {
  it('0 위에서만 줄고, 목표점 보기는 99 로 자른다', () => {
    const 뒤 = tickAfterAnyGame(기본({ illnessCooldown: 20, aimVisionGames: 5 }))
    expect(뒤.illnessCooldown).toBe(19)
    expect(뒤.aimVisionGames).toBe(4)
    expect(tickAfterAnyGame(기본({ illnessCooldown: 0, aimVisionGames: 0 }))).toMatchObject({ illnessCooldown: 0, aimVisionGames: 0 })
    expect(tickAfterAnyGame(기본({ aimVisionGames: 120 })).aimVisionGames).toBe(99)
  })

  it('경기로는 질병이 낫지 않는다', () => {
    expect(tickAfterAnyGame(기본({ illness: 2, illnessCooldown: 0 })).illness).toBe(2)
  })
})

describe('사기에 따른 팀 능력치 정액 감소 (J-4)', () => {
  it('50 초과는 없음 · 31~50 −50 · 11~30 −100 · 10 이하 −200', () => {
    expect(moralePenaltyOf(100)).toBe(0)
    expect(moralePenaltyOf(51)).toBe(0)
    expect(moralePenaltyOf(50)).toBe(50)
    expect(moralePenaltyOf(31)).toBe(50)
    expect(moralePenaltyOf(30)).toBe(100)
    expect(moralePenaltyOf(11)).toBe(100)
    expect(moralePenaltyOf(10)).toBe(200)
  })
})
