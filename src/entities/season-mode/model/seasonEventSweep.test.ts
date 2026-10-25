import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  applySeasonEventRewards,
  seasonRewardsIn,
  selectSeasonEvent,
  START_SEASON_EVENT_CURSOR,
  withSeasonYearAdjust,
} from '@/entities/season-mode/model/seasonEventFlow'
import { ORIGINAL_SEASON_EVENTS } from '@/shared/config/original/seasonEvents'
import type { SeasonOriginalEvent } from '@/shared/config/original/seasonEvents'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

/**
 * **시즌모드 s_event 전수 대조 (r257)** — 시즌모드도 나리와 **같은 해석기**를 돈다: 파서 0xadd10 · 고르기 0xadc70 · 판정 0xacfbc
 * (모드 2 는 대상 4 · 조건 0~3 통과 · 22 는 팀 사기 · 23 불발) · 보상 0x8c460 (0x7b999 참 갈래 — 2 사기는 팀 레코드 +2).
 * 대상 4 다섯 편을 원본 해석대로 맞춘 기록으로 하나씩 띄워 보고, 보상 있는 편마다 0x8c460 모드 2 식과 견준다.
 */

const 자동이벤트 = ORIGINAL_SEASON_EVENTS.filter((event) => event.audience === 4)

function 맞춤기록(event: SeasonOriginalEvent): SeasonRecord {
  const seenEvents = ORIGINAL_SEASON_EVENTS.filter((other) => other.id !== event.id).map((other) => other.id)
  const [a, b] = event.dateFrom
  const [c, d] = event.dateTo
  const 날짜 = a !== 0 && b !== 0 && c !== 0 && d !== 0 ? { yearIndex: a - 1, games: b - 1 } : {}
  return { ...startNewSeason(0, '전수').record, yearGoalShown: true, seenEvents, illness: 0, illnessCooldown: 0, ...날짜 }
}

describe('시즌모드 s_event 전수 — 훑기 (0xadc70 · 0xacfbc 모드 2)', () => {
  it('대상 4(시즌 자동)는 400 · 490 · 1 · 5 · 100 다섯 편이다', () => {
    expect(자동이벤트.map((event) => event.id)).toEqual([400, 490, 1, 5, 100])
  })

  for (const event of 자동이벤트) {
    it(`이벤트 ${event.id} (조건 ${JSON.stringify(event.conditions)}) — 원본 해석대로 맞으면 뜬다`, () => {
      const record = 맞춤기록(event)
      // 조건 22 는 팀 사기 ≤ 10 → 14 % · rand(0, 100) = 0
      const input = { record, teamMorale: 0, screenCode: 201, event100Awarded: false }
      expect(selectSeasonEvent(START_SEASON_EVENT_CURSOR, input, createConstantRandom(0)).eventId).toBe(event.id)
      if (event.conditions.length > 0) {
        const without = { ...input, teamMorale: 100 }
        expect(selectSeasonEvent(START_SEASON_EVENT_CURSOR, without, createConstantRandom(0.99)).eventId).toBeNull()
      }
    })
  }

  it('대상 0(코드 호출 전용)은 맞춰도 훑기에 안 뜬다', () => {
    for (const event of ORIGINAL_SEASON_EVENTS.filter((candidate) => candidate.audience === 0)) {
      const input = { record: 맞춤기록(event), teamMorale: 0, screenCode: 201, event100Awarded: false }
      expect(selectSeasonEvent(START_SEASON_EVENT_CURSOR, input, createConstantRandom(0)).eventId).toBeNull()
    }
  })
})

/**
 * 0x8c460 모드 2 갈래 — 0 인기도 SR+0x48 (0~9999) · 1 평판 SR+0x62 (0~999) · 2 팀 레코드 +2 사기 (0~100) ·
 * 3 소지금 SR+2 (0~9999) · 10 전역 G (상한 99999). 연차 보정 0x8d508 은 393~395 종류 0·1·3 +5y · 396 종류 0 −10y · 1 −2y.
 */
function 원본보상(state: SeasonState, event: SeasonOriginalEvent) {
  const y = state.record.yearIndex
  let { popularity, reputation, money } = state.record
  let teamMorale = state.teamMorale
  let gamePoint = 0
  const clamp = (value: number, limit: number) => Math.max(0, Math.min(limit, value))
  for (const { kind, value: raw } of seasonRewardsIn(event.commands)) {
    let value = raw
    if ([393, 394, 395].includes(event.id) && [0, 1, 3].includes(kind)) value += 5 * y
    if (event.id === 396 && kind === 0) value -= 10 * y
    if (event.id === 396 && kind === 1) value -= 2 * y
    if (kind === 0) popularity = clamp(popularity + value, 9999)
    if (kind === 1) reputation = clamp(reputation + value, 999)
    if (kind === 2) teamMorale = clamp(teamMorale + value, 100)
    if (kind === 3) money = clamp(money + value, 9999)
    if (kind === 10) gamePoint = Math.min(99_999, gamePoint + value)
  }
  return { popularity, reputation, money, teamMorale, gamePoint }
}

describe('시즌모드 s_event 전수 — 보상 (0x8c460 모드 2)', () => {
  const 보상이벤트 = ORIGINAL_SEASON_EVENTS.filter(
    (event) => seasonRewardsIn(event.commands).length > 0 && !seasonRewardsIn(event.commands).some((reward) => reward.kind === 11),
  )

  for (const yearIndex of [0, 4]) {
    for (const event of 보상이벤트) {
      it(`연차idx ${yearIndex} · 이벤트 ${event.id} 보상 ${JSON.stringify(seasonRewardsIn(event.commands))} 이 원본 식과 같다`, () => {
        const base = startNewSeason(0, '보상')
        const state: SeasonState = { ...base, teamMorale: 50, record: { ...base.record, yearIndex, popularity: 100, reputation: 100, money: 100 } }
        const web = applySeasonEventRewards(state, seasonRewardsIn(event.commands), event.id, createConstantRandom(0.5))
        expect({
          popularity: web.state.record.popularity, reputation: web.state.record.reputation, money: web.state.record.money,
          teamMorale: web.state.teamMorale, gamePoint: web.gamePoint,
        }).toEqual(원본보상(state, event))
        expect(web.entersEnding).toBe(seasonRewardsIn(event.commands)[0]?.kind === 21)
      })
    }
  }

  it('연차 보정은 명령에 있는 항목만 고친다 (394 는 평판 항목이 없다)', () => {
    expect(withSeasonYearAdjust([{ kind: 0, value: 20 }, { kind: 3, value: 20 }], 394, 2)).toEqual([
      { kind: 0, value: 30 }, { kind: 3, value: 30 },
    ])
  })
})
