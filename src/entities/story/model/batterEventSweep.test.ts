import { describe, expect, it } from 'vitest'
import { applyEventRewards, rewardsIn } from '@/entities/story/model/eventReward'
import { scanEventFrom } from '@/entities/story/model/storyScene'
import { applySkillReward, createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **나리 타자편 이벤트 전수 대조 (r253)** — 타자편 훑기(0x8be80 → 0xadc70 → 판정 0xacfbc)가 받는 이벤트(대상 1 · 2) 하나하나에
 * 원본 해석(A-events-skills A-2 · A-3 · A-4)대로 맞는 선수를 세워, 웹 훑기가 **그 이벤트를 고르는지**와 맞는 몫을 빼면
 * **안 고르는지**를 본다. 다른 이벤트는 모두 본 것으로 두어(본 이벤트는 판정 4번에서 먼저 불발) 파일 차례의 앞 이벤트가 가리지 않게 한다.
 * 이어서 보상(0x8c460 점프표 0xd4e50)을 원본 식으로 따로 셈해 웹 `applyEventRewards` 와 견준다.
 */

const 타자편이벤트 = ORIGINAL_EVENTS.filter((event) => event.audience === 1 || event.audience === 2)
const 약함 = { hit: 400, power: 400, defense: 400, run: 400 }
const 시즌기록 = (overrides: Partial<typeof EMPTY_SEASON_STATS>) => ({ ...EMPTY_SEASON_STATS, ...overrides })
const 카운터 = (slot: number, value: number) => Array.from({ length: 7 }, (_, i) => (i === slot ? value : 0))

/**
 * 조건 20 · 21 의 스킬별 맞춤 (A-4 표 — 스킬 번호 = 값 − 1). 획득은 하위 조건 0xd8408, 해제는 0xd8454 의 타자(모드 4) 갈래.
 * 값이 없는 스킬(6 · 8 · 9 · 17, 해제 6~17)은 보유 여부만 본다.
 */
const 획득맞춤: Readonly<Record<number, Partial<PlayerCareer>>> = {
  2: { season: 3, gamesPlayed: 14, seasonPopularityGain: 15 },
  3: { ability: 약함, gamesPlayed: 12 },
  4: { season: 2, ability: 약함, gamesPlayed: 18 },
  5: { season: 4, morale: 20 },
  7: { regularSeasonFirstCount: 8, mvpSeasonBits: 0b1111111 },
  10: { gameSkillCounters: 카운터(6, 6) },
  11: { gameSkillCounters: 카운터(5, 50) },
  12: { stats: 시즌기록({ doubles: 80, runsBattedIn: 200 }) },
  13: { battingSide: 0, stats: 시즌기록({ hits: 600 }) },
  14: { battingSide: 1, stats: 시즌기록({ hits: 600 }) },
  15: { stats: 시즌기록({ doubles: 120, triples: 10 }) },
  16: { gameSkillCounters: [0, 4, 3, 3, 0, 0, 0] },
  18: { ability: 약함, gamesPlayed: 40 },
  19: { ability: 약함, gamesPlayed: 20 },
  20: { season: 4, ability: { ...약함, defense: 400 }, gamesPlayed: 30 },
}
const 해제맞춤: Readonly<Record<number, Partial<PlayerCareer>>> = {
  2: { moneyGrubberGames: 5, moneyGrubberPopularityGain: 20 },
  3: { badBodyTrainings: 6 },
  4: { fragileTrainings: 8 },
  5: { highMoraleStreak: 6 },
  18: { consecutiveTrainingCounts: { 히트: 8 } },
  19: { consecutiveTrainingCounts: { 파워: 8 } },
  20: { consecutiveTrainingCounts: { 수비: 8 } },
}

interface 맞춤 {
  readonly career: PlayerCareer
  readonly random: RandomPort
  /** 조건 몫을 빼고 날짜 · 선행만 맞춘 선수 — 조건이 있는 이벤트면 이 선수로는 안 떠야 한다 */
  readonly withoutConditions: PlayerCareer
  readonly randomWithout: RandomPort
}

/** 원본 해석대로 그 이벤트가 맞는 선수를 세운다 */
function 맞춤선수(event: OriginalEvent): 맞춤 {
  const 안봐야할 = new Set([event.id, ...event.conditions.filter((c) => c.type === 25).map((c) => c.value)])
  const seenEventIds = ORIGINAL_EVENTS.filter((other) => !안봐야할.has(other.id)).map((other) => String(other.id))
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  const 날짜있음 = fromSeason !== 0 && fromGame !== 0 && toSeason !== 0 && toGame !== 0
  // now = 연차idx·45 + 치른 경기 + 1 이 from 과 같게 (0xacfbc 7번)
  const 날짜 = 날짜있음 ? { season: fromSeason, gamesPlayed: fromGame - 1 } : {}
  const base: PlayerCareer = { ...createCareer('전수'), seenEventIds, morale: 50, ...날짜 }
  // 조건 몫을 뺀 선수는 조건 25 의 대상도 본 것으로 둔다
  const allSeen = ORIGINAL_EVENTS.filter((other) => other.id !== event.id).map((other) => String(other.id))
  let fitted: PlayerCareer = base
  let random = createConstantRandom(0.5)
  for (const condition of event.conditions) {
    const skillId = condition.value - 1
    switch (condition.type) {
      case 18:
        fitted = { ...fitted, popularity: condition.value }
        break
      case 19:
        fitted = { ...fitted, reputation: condition.value }
        break
      case 20:
        fitted = { ...fitted, skillIds: fitted.skillIds.filter((id) => id !== skillId), ...획득맞춤[skillId] }
        // 5 무력감은 rand(0, 100) > 69 (0xad46c)
        if (skillId === 5) random = createConstantRandom(0.99)
        break
      case 21:
        fitted = { ...fitted, skillIds: [...fitted.skillIds, skillId], ...해제맞춤[skillId] }
        break
      case 22:
        // 사기 ≤ 10 → 14 % · rand(0, 100) = 0 (0xadb32)
        fitted = { ...fitted, morale: 0, isSick: false }
        random = createConstantRandom(0)
        break
      default:
        break
    }
  }
  return {
    career: fitted,
    random,
    withoutConditions: { ...base, seenEventIds: allSeen },
    // 조건 22 · 무력감은 굴림이 안 맞으면 불발이다
    randomWithout: createConstantRandom(0.99),
  }
}

describe('나리 타자편 이벤트 전수 — 훑기 (0xadc70 · 0xacfbc)', () => {
  it('타자편이 받는 파일 이벤트는 대상 1 · 2 의 150 개다', () => {
    expect(타자편이벤트).toHaveLength(150)
  })

  for (const event of 타자편이벤트) {
    it(`이벤트 ${event.id} (trigger ${event.trigger} · 조건 ${JSON.stringify(event.conditions)}) — 원본 해석대로 맞으면 뜬다`, () => {
      const fit = 맞춤선수(event)
      const scan = scanEventFrom(fit.career, ORIGINAL_EVENTS, event.trigger, 0, fit.random)
      expect(scan.event?.id).toBe(event.id)
      if (event.conditions.length > 0) {
        const without = scanEventFrom(fit.withoutConditions, ORIGINAL_EVENTS, event.trigger, 0, fit.randomWithout)
        expect(without.event?.id).not.toBe(event.id)
      }
    })
  }
})

/**
 * 0x8c460 를 따로 셈한다 — 0 인기도(0~9999) · 1 평판(0~999) · 2 사기(0~100) · 3 소지금(100만 단위, 0~9999) ·
 * 4 스킬(+ 얻기 · − 풀기) · 13~16 능력치(+v, 999 상한 → 기본값이 한계를 넘으면 한계) · 17 네 칸 모두.
 * 393~396 의 연차 보정(0x8d508)은 1년차라 0 이다.
 */
function 원본보상(career: PlayerCareer, event: OriginalEvent): PlayerCareer {
  const keys = ['hit', 'power', 'defense', 'run'] as const
  const limit = abilityLimitOf(career.battingTypeIndex)
  let next = career
  const raise = (key: (typeof keys)[number], value: number) => {
    const raised = Math.min(999, next.ability[key] + value)
    next = { ...next, ability: { ...next.ability, [key]: Math.min(raised, limit[key]) } }
  }
  for (const { kind, value } of rewardsIn(event.commands)) {
    if (kind === 0) next = { ...next, popularity: Math.max(0, Math.min(9999, next.popularity + value)) }
    if (kind === 1) next = { ...next, reputation: Math.max(0, Math.min(999, next.reputation + value)) }
    if (kind === 2) next = { ...next, morale: Math.max(0, Math.min(100, next.morale + value)) }
    if (kind === 3) next = { ...next, money: Math.max(0, Math.min(9999 * 100, next.money + value * 100)) }
    if (kind === 4) next = applySkillReward(next, value)
    if (kind >= 13 && kind <= 16) raise(keys[kind - 13], value)
    if (kind === 17) keys.forEach((key) => raise(key, value))
  }
  return next
}

describe('나리 타자편 이벤트 전수 — 보상 (0x8c460)', () => {
  const 보상이벤트 = 타자편이벤트.filter((event) => rewardsIn(event.commands).length > 0)

  for (const event of 보상이벤트) {
    it(`이벤트 ${event.id} 보상 ${JSON.stringify(rewardsIn(event.commands))} 이 원본 식과 같다`, () => {
      const career: PlayerCareer = { ...createCareer('보상'), morale: 50, popularity: 100, reputation: 100, money: 1000 }
      const web = applyEventRewards(career, rewardsIn(event.commands), createConstantRandom(0.5), event.id)
      const original = 원본보상(career, event)
      const pick = (c: PlayerCareer) => ({
        popularity: c.popularity, reputation: c.reputation, morale: c.morale, money: c.money,
        ability: c.ability, skillIds: [...c.skillIds].sort((a, b) => a - b),
      })
      expect(pick(web)).toEqual(pick(original))
    })
  }
})

describe('보상 4 — 해제 기록(+0x1d0)은 보상 실행기가 보지 않는다 (0xa4bd8 · 0xa4430)', () => {
  it('그 해 풀었던 하락세(17)도 보상 +18 이 오면 다시 얻는다 — 0xa4bd8 에 해제 기록 검사가 없다', () => {
    const career: PlayerCareer = { ...createCareer('하락세'), skillIds: [], equippedSkillIds: [], removedMinusSkillIds: [17] }
    const next = applySkillReward(career, 18)
    expect(next.skillIds).toContain(17)
    expect(next.equippedSkillIds).toContain(17)
    expect(next.removedMinusSkillIds).toEqual([17])
  })

  it('안 가진 마이너스 스킬을 푸는 보상도 해제 기록을 남긴다 — 0xa4430 은 보유와 상관없이 0xa43fc(P, s, 1)', () => {
    const career: PlayerCareer = { ...createCareer('기록'), skillIds: [], equippedSkillIds: [], removedMinusSkillIds: [] }
    expect(applySkillReward(career, -4).removedMinusSkillIds).toEqual([3])
    // 마이너스가 아닌 스킬(표 0xd7e10 밖)은 기록 칸이 없다
    expect(applySkillReward(career, -9)).toBe(career)
  })
})

describe('조건 switch 0xad1ba — 원본 데이터가 안 쓰는 갈래 (r253)', () => {
  const 가짜 = (conditions: OriginalEvent['conditions']): OriginalEvent => ({
    id: 9001, audience: 2, repeatable: false, trigger: 0, requiresEvent: 0, dateFrom: [0, 0], dateTo: [0, 0], conditions, commands: [],
  })
  const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('갈래'), seenEventIds: ['451'], ...overrides })
  const 뜨나 = (career: PlayerCareer, conditions: OriginalEvent['conditions'], random?: RandomPort) =>
    scanEventFrom(career, [가짜(conditions)], 0, 0, random).event !== null

  it('0~3 · 18 · 19 는 음수 값이면 "값 < |v|" 다 (0xad1e0 · 0xad212)', () => {
    const career = 선수({ ability: { hit: 300, power: 300, defense: 300, run: 300 }, popularity: 50, reputation: 50 })
    expect(뜨나(career, [{ type: 0, value: -301 }])).toBe(true)
    expect(뜨나(career, [{ type: 0, value: -300 }])).toBe(false)
    expect(뜨나(career, [{ type: 3, value: 300 }])).toBe(true)
    expect(뜨나(career, [{ type: 18, value: -51 }])).toBe(true)
    expect(뜨나(career, [{ type: 18, value: -50 }])).toBe(false)
    expect(뜨나(career, [{ type: 19, value: -51 }])).toBe(true)
  })

  it('4~17 · 26 이상은 곧 통과다 (점프표 칸 0xadc34)', () => {
    for (const type of [4, 10, 17, 26, 40]) expect(뜨나(선수(), [{ type, value: 999 }])).toBe(true)
  })

  it('24 · 25 는 v ≤ 0 이면 곧 통과다 (0xadc0c · 0xadc22)', () => {
    expect(뜨나(선수(), [{ type: 24, value: 0 }])).toBe(true)
    expect(뜨나(선수(), [{ type: 25, value: 0 }])).toBe(true)
    expect(뜨나(선수(), [{ type: 24, value: 1 }])).toBe(false)
  })

  it('23 은 질병 중일 때 rand(0, 100) ≤ 9 면 통과다 (0xadbe6)', () => {
    expect(뜨나(선수({ isSick: true }), [{ type: 23, value: 0 }], createConstantRandom(0.09))).toBe(true)
    expect(뜨나(선수({ isSick: true }), [{ type: 23, value: 0 }], createConstantRandom(0.1))).toBe(false)
    expect(뜨나(선수({ isSick: false }), [{ type: 23, value: 0 }], createConstantRandom(0))).toBe(false)
  })
})
