import { describe, expect, it } from 'vitest'
import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
import { scanPitcherEventFrom } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { createPitcherCareer, EMPTY_PITCHER_SEASON_STATS, pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { applySkillReward } from '@/entities/career/model/playerCareer'
import { rewardsIn } from '@/entities/story/model/eventReward'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **나리 투수편 이벤트 전수 대조 (r257)** — 투수편 훑기(0x8be80 → 0xadc70 → 판정 0xacfbc 모드 3 갈래)가 받는 이벤트(대상 1 · 3)
 * 하나하나에 원본 해석(A-2 · A-3 · A-4, 하위 표 0xd8408 · 0xd8454 의 모드 ≠ 4 갈래)대로 맞는 투수를 세워, 웹 훑기가 **그 이벤트를
 * 고르는지**와 맞는 몫을 빼면 **안 고르는지**를 본다 (타자편 `batterEventSweep` 과 같은 틀).
 * 이어서 보상(0x8c460 점프표 0xd4e50 — 모드 3 갈래)을 원본 식으로 따로 셈해 웹 `applyPitcherEventRewards` 와 견준다.
 */

const 투수편이벤트 = ORIGINAL_EVENTS.filter((event) => event.audience === 1 || event.audience === 3)
const 약함 = { control: 400, velocity: 400, breaking: 400, stamina: 400 }
const 기록 = (overrides: Partial<PitcherSeasonStats>): PitcherSeasonStats => ({ ...EMPTY_PITCHER_SEASON_STATS, ...overrides })

/**
 * 조건 20 의 투수 스킬별 맞춤 (스킬 번호 = 값 − 1 = 투수 보유 비트). 하위 표 0xd8408[s − 2] 의 모드 3 갈래:
 *   2 먹튀 0xad2a2 · 3 몹쓸몸 0xad2e6 · 4 유리몸 0xad3ac · 5 무력감 0xad43a · 7 전설 0xad474 · 10 끈기 0xad494→0xad4ac ·
 *   11 닥터K 0xad4e0→0xad4f8 · 12 좌타UP 0xad514→0xad53c · 13 우타UP 0xad598→0xad5c8 · 14 투지 0xad622→0xad668 ·
 *   16 안정감 0xad7cc→0xad7ec · 18 비겁자 0xad842 · 19 깃털 0xad8c8
 */
const 획득맞춤: Readonly<Record<number, Partial<PitcherCareer>>> = {
  2: { season: 3, gamesPlayed: 14, seasonPopularityGain: 15 },
  3: { ability: 약함, gamesPlayed: 12 },
  4: { season: 2, ability: 약함, gamesPlayed: 18 },
  5: { season: 4, morale: 20 },
  7: { regularSeasonFirstCount: 8, mvpSeasonBits: 0b1111111 },
  // 체력 실효 > 599 · 통산 투구 수 ≥ 6000
  10: { ability: { ...약함, stamina: 700 }, careerStats: 기록({ pitches: 6000 }) },
  11: { careerStats: 기록({ strikeouts: 500 }) },
  // 통산(1년차 = 이번 해) 세이브 + 승 ≥ 200 — 보직과 상관없이 넘는다. 12 는 우완(손 0) · 13 은 좌완(손 1)
  12: { handIndex: 0, stats: 기록({ saves: 200 }) },
  13: { handIndex: 1, stats: 기록({ saves: 200 }) },
  // 연차idx 3 — 지난 세 해 모두 승 ≥ 15 (선발) · 세이브 + 승 ≥ 20 (구원)
  14: { season: 4, yearlyStats: [기록({ wins: 20 }), 기록({ wins: 20 }), 기록({ wins: 20 })] },
  // 통산 이닝(아웃/3) ≥ 500 · 탈삼진 ≥ 200
  16: { careerStats: 기록({ outs: 1500, strikeouts: 200 }) },
  // 16경기째 이번 시즌 이닝 ≤ 14
  18: { gamesPlayed: 16 },
  // 연차idx > 2 · 변화 실효 ≤ 500 · 30경기째 · 이번 시즌 변화 훈련 0
  19: { season: 4, ability: 약함, gamesPlayed: 30 },
}
/** 조건 21 의 투수 해제 맞춤 — 하위 표 0xd8454[s − 2] */
const 해제맞춤: Readonly<Record<number, Partial<PitcherCareer>>> = {
  2: { moneyGrubberGames: 5, moneyGrubberPopularityGain: 20 },
  3: { badBodyTrainings: 6 },
  4: { fragileTrainings: 8 },
  5: { highMoraleStreak: 6 },
  // 0xada22 모드 3: 연차idx > 2 · 작년 승(선발) ≤ 6
  14: { season: 4, yearlyStats: [기록({}), 기록({}), 기록({})] },
  // 해제 카운터 +0x70+칸 > 7 — 18 → 칸 3 · 19 → 칸 2 · 20 → 칸 0
  18: { releaseTrainingStreaks: [0, 0, 0, 8, 0] },
  19: { releaseTrainingStreaks: [0, 0, 8, 0, 0] },
  20: { releaseTrainingStreaks: [8, 0, 0, 0, 0] },
}

interface 맞춤 {
  readonly career: PitcherCareer
  readonly random: RandomPort
  readonly withoutConditions: PitcherCareer
  readonly randomWithout: RandomPort
}

function 맞춤투수(event: OriginalEvent): 맞춤 {
  const 안봐야할 = new Set([event.id, ...event.conditions.filter((c) => c.type === 25).map((c) => c.value)])
  const seenEventIds = ORIGINAL_EVENTS.filter((other) => !안봐야할.has(other.id)).map((other) => String(other.id))
  const [fromSeason, fromGame] = event.dateFrom
  const [toSeason, toGame] = event.dateTo
  const 날짜있음 = fromSeason !== 0 && fromGame !== 0 && toSeason !== 0 && toGame !== 0
  const 날짜 = 날짜있음 ? { season: fromSeason, gamesPlayed: fromGame - 1 } : {}
  const base: PitcherCareer = { ...createPitcherCareer('전수'), seenEventIds, morale: 50, ...날짜 }
  const allSeen = ORIGINAL_EVENTS.filter((other) => other.id !== event.id).map((other) => String(other.id))
  let fitted: PitcherCareer = base
  let random = createConstantRandom(0.5)
  for (const condition of event.conditions) {
    const skillId = condition.value - 1
    const ability = PITCHER_ABILITY_ORDER[condition.type]
    if (ability !== undefined) {
      fitted = { ...fitted, ability: { ...fitted.ability, [ability]: condition.value } }
      continue
    }
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
    randomWithout: createConstantRandom(0.99),
  }
}

describe('나리 투수편 이벤트 전수 — 훑기 (0xadc70 · 0xacfbc 모드 3)', () => {
  it('투수편이 받는 파일 이벤트는 대상 1 · 3 의 152 개다', () => {
    expect(투수편이벤트).toHaveLength(152)
  })

  for (const event of 투수편이벤트) {
    it(`이벤트 ${event.id} (trigger ${event.trigger} · 조건 ${JSON.stringify(event.conditions)}) — 원본 해석대로 맞으면 뜬다`, () => {
      const fit = 맞춤투수(event)
      const scan = scanPitcherEventFrom(fit.career, ORIGINAL_EVENTS, event.trigger, 0, fit.random)
      expect(scan.event?.id).toBe(event.id)
      if (event.conditions.length > 0) {
        const without = scanPitcherEventFrom(fit.withoutConditions, ORIGINAL_EVENTS, event.trigger, 0, fit.randomWithout)
        expect(without.event?.id).not.toBe(event.id)
      }
    })
  }

  it('타자 전용(대상 2)은 맞춰도 투수편에 안 뜬다 (0xacfbc 2번 — 모드 3 은 1 · 3)', () => {
    const batterOnly = ORIGINAL_EVENTS.filter((event) => event.audience === 2 && event.conditions.length === 0 && event.requiresEvent === 0)
    for (const event of batterOnly) {
      const fit = 맞춤투수(event)
      expect(scanPitcherEventFrom(fit.career, ORIGINAL_EVENTS, event.trigger, 0, fit.random).event?.id).not.toBe(event.id)
    }
  })
})

/**
 * 0x8c460 모드 3 갈래를 따로 셈한다 — 0 인기도(0~9999) · 1 평판(0~999) · 2 사기(0~100, 0xa3a25/0xa3a45) ·
 * 3 소지금(100만 단위, 0~9999) · 4 스킬(+ 얻기 0xa4bd8 · − 풀기 0xa4430) · 6 선수[0x204 + v] = 1(0x8c5da, 0x7b985 참) ·
 * 7 히든 오픈 |v| · 13~16 투수 기록 +0xc + 2i 에 +v(999 상한), 기본값이 보직 한계 `0xd4d88[(보직 ? 4 : 0) + i] × 10` 을
 * 넘으면 한계 · 17 네 칸 모두. 393~396 연차 보정은 1년차라 0.
 */
function 원본보상(career: PitcherCareer, event: OriginalEvent): PitcherCareer {
  const limit = pitcherAbilityLimitsOf(career)
  let next = career
  const raise = (key: (typeof PITCHER_ABILITY_ORDER)[number], value: number) => {
    const raised = Math.min(999, next.ability[key] + value)
    next = { ...next, ability: { ...next.ability, [key]: raised > limit[key] ? Math.min(limit[key], 999) : raised } }
  }
  for (const { kind, value } of rewardsIn(event.commands)) {
    if (kind === 0) next = { ...next, popularity: Math.max(0, Math.min(9999, next.popularity + value)) }
    if (kind === 1) next = { ...next, reputation: Math.max(0, Math.min(999, next.reputation + value)) }
    if (kind === 2) next = { ...next, morale: Math.max(0, Math.min(100, next.morale + value)) }
    if (kind === 3) next = { ...next, money: Math.max(0, Math.min(9999 * 100, next.money + value * 100)) }
    if (kind === 4 && value !== 0) next = applySkillReward(next, value)
    if (kind === 6) next = { ...next, hiddenPitchRows: next.hiddenPitchRows.map((open, row) => open || row === value) }
    if (kind === 7 && !next.openedHiddenIds.includes(Math.abs(value))) {
      next = { ...next, openedHiddenIds: [...next.openedHiddenIds, Math.abs(value)] }
    }
    if (kind >= 13 && kind <= 16) raise(PITCHER_ABILITY_ORDER[kind - 13], value)
    if (kind === 17) PITCHER_ABILITY_ORDER.forEach((key) => raise(key, value))
  }
  return next
}

describe('나리 투수편 이벤트 전수 — 보상 (0x8c460 모드 3)', () => {
  // 11 질병은 굴림이 끼어 아래에서 따로 본다
  const 보상이벤트 = 투수편이벤트.filter(
    (event) => rewardsIn(event.commands).length > 0 && !rewardsIn(event.commands).some((reward) => reward.kind === 11),
  )

  for (const role of [PITCHER_ROLE.starter, PITCHER_ROLE.relief]) {
    for (const event of 보상이벤트) {
      it(`보직 ${role} · 이벤트 ${event.id} 보상 ${JSON.stringify(rewardsIn(event.commands))} 이 원본 식과 같다`, () => {
        const career: PitcherCareer = {
          ...createPitcherCareer('보상'),
          role,
          morale: 50,
          popularity: 100,
          reputation: 100,
          money: 1000,
          ability: { control: 795, velocity: 845, breaking: 300, stamina: 595 },
        }
        const web = applyPitcherEventRewards(career, rewardsIn(event.commands), createConstantRandom(0.5), event.id)
        const original = 원본보상(career, event)
        const pick = (c: PitcherCareer) => ({
          popularity: c.popularity,
          reputation: c.reputation,
          morale: c.morale,
          money: c.money,
          ability: c.ability,
          skillIds: [...c.skillIds].sort((a, b) => a - b),
          equippedSkillIds: [...c.equippedSkillIds].sort((a, b) => a - b),
          removedMinusSkillIds: c.removedMinusSkillIds,
          hiddenPitchRows: c.hiddenPitchRows,
          openedHiddenIds: c.openedHiddenIds,
        })
        expect(pick(web)).toEqual(pick(original))
      })
    }
  }
})

describe('보상 11 — 질병 · 치료 (0x8c718, 모드 갈림 없음)', () => {
  it('값 < 0 치료는 남은 기간을 0 으로 한다 — +6 = 표 0xd4d98[0] = 0 (0x8c73e~0x8c752, r257)', () => {
    const 아픈투수: PitcherCareer = { ...createPitcherCareer('치료'), isSick: true, illnessName: '감기', illnessRemaining: 3, illnessCooldown: 0 }
    const 나음 = applyPitcherEventRewards(아픈투수, [{ kind: 11, value: -1 }])
    expect(나음).toMatchObject({ isSick: false, illnessName: null, illnessRemaining: 0, illnessCooldown: 20 })
  })

  it('490 (값 0 — 알림 글이 r + 1 로 다시 쓴 값이 오면 그 번호) 은 질병 · 기간 3 · 쿨다운 20', () => {
    const event = ORIGINAL_EVENTS.find((candidate) => candidate.id === 490)!
    expect(rewardsIn(event.commands)).toEqual([{ kind: 11, value: 0 }])
    const 아픔 = applyPitcherEventRewards(createPitcherCareer('질병'), [{ kind: 11, value: 2 }])
    expect(아픔).toMatchObject({ isSick: true, illnessRemaining: 3, illnessCooldown: 20 })
  })
})
