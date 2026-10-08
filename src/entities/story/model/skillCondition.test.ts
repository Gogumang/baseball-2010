import { describe, expect, it } from 'vitest'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  meetsSkillAcquireCondition, meetsSkillReleaseCondition, withGameSkillCounters,
} from '@/entities/story/model/skillCondition'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { EMPTY_REPUTATION_COUNTS } from '@/entities/career/model/gameEvaluation'

const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({ ...createCareer('테스트'), ...overrides })
/** 조건 값은 스킬 번호 + 1 이다 */
const 값 = (skillId: number) => skillId + 1

describe('조건 20 — 스킬 획득 (0xad1ba)', () => {
  it('이미 가진 스킬이면 뜨지 않는다', () => {
    expect(meetsSkillAcquireCondition(선수({ skillIds: [6] }), 값(6), undefined)).toBe(false)
  })

  it('추가 조건이 없는 스킬(6 행운·8 의외성·9 베테랑·17 하락세)은 안 가졌으면 통과한다', () => {
    const career = 선수({ skillIds: [] })
    expect([6, 8, 9, 17].map((id) => meetsSkillAcquireCondition(career, 값(id), undefined))).toEqual([
      true, true, true, true,
    ])
  })

  it('그 해 해제한 마이너스 스킬(+0x1d0, 0xa4f31)은 2·3·4·5·18·19·20 의 하위 조건이 맨 앞에서 막는다', () => {
    const 항상 = createConstantRandom(0.99)
    const 약함 = { hit: 400, power: 400, defense: 400, run: 400 }
    const 경우: readonly (readonly [number, Partial<PlayerCareer>])[] = [
      [2, { season: 3, gamesPlayed: 14, seasonPopularityGain: 0 }],
      [3, { gamesPlayed: 12, ability: 약함 }],
      [4, { season: 2, gamesPlayed: 18, ability: 약함 }],
      [5, { season: 4, morale: 0 }],
      [18, { gamesPlayed: 40, ability: 약함 }],
      [19, { gamesPlayed: 20, ability: 약함 }],
      [20, { season: 4, gamesPlayed: 30, ability: 약함 }],
    ]
    for (const [id, overrides] of 경우) {
      expect(meetsSkillAcquireCondition(선수({ skillIds: [], ...overrides }), 값(id), 항상)).toBe(true)
      expect(meetsSkillAcquireCondition(선수({ skillIds: [], ...overrides, removedMinusSkillIds: [id] }), 값(id), 항상)).toBe(false)
    }
  })

  it('17 하락세는 0xad9a2(추가 조건 없음)라 그 해 해제했어도 다시 얻는다 — 0xa4f31 을 안 본다', () => {
    const career = 선수({ skillIds: [], removedMinusSkillIds: [17] })
    expect(meetsSkillAcquireCondition(career, 값(17), undefined)).toBe(true)
  })

  it('3 몹쓸몸의 T 는 u8 통산 − s8 시즌 사본이다 — 사본이 128 을 넘으면 음수로 읽혀 T 가 커진다 (0xad334)', () => {
    const 기본 = { skillIds: [], gamesPlayed: 12, ability: { hit: 400, power: 400, defense: 400, run: 400 } }
    // 통산 = 사본 = 100 → T = 0
    expect(meetsSkillAcquireCondition(
      선수({ ...기본, trainingCounts: { 히트: 100 }, seasonStartTrainingCounts: { 히트: 100 } }), 값(3), undefined,
    )).toBe(true)
    // 통산 = 사본 = 200 → u8 200 − s8(−56) = 256 ≠ 0
    expect(meetsSkillAcquireCondition(
      선수({ ...기본, trainingCounts: { 히트: 200 }, seasonStartTrainingCounts: { 히트: 200 } }), 값(3), undefined,
    )).toBe(false)
    // 통산 256(u8 0) · 사본 256(s8 0) → T = 0
    expect(meetsSkillAcquireCondition(
      선수({ ...기본, trainingCounts: { 히트: 256 }, seasonStartTrainingCounts: { 히트: 256 } }), 값(3), undefined,
    )).toBe(true)
  })

  it('5 무력감은 사기 ≤ 20 · 연차 인덱스 ≥ 3 · 30% 를 본다', () => {
    const 항상 = createConstantRandom(0.99)
    const 절대 = createConstantRandom(0)
    const 지친선수 = 선수({ skillIds: [], morale: 20, season: 4 })

    expect(meetsSkillAcquireCondition(지친선수, 값(5), 항상)).toBe(true)
    expect(meetsSkillAcquireCondition(지친선수, 값(5), 절대)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ skillIds: [], morale: 21, season: 4 }), 값(5), 항상)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ skillIds: [], morale: 20, season: 3 }), 값(5), 항상)).toBe(false)
  })

  it('아직 기록 칸을 못 옮긴 스킬은 통과시키지 않는다 (7 전설·10 해결사)', () => {
    const career = 선수({ skillIds: [] })
    expect([7, 10].map((id) => meetsSkillAcquireCondition(career, 값(id), undefined))).toEqual([false, false])
  })

  it('2 먹튀 — 연차 ≥ 2 이고 14경기째 이번 시즌 인기도 합 ≤ 15 (0xad2a2)', () => {
    const 기본 = { skillIds: [], season: 3, gamesPlayed: 14 }
    expect(meetsSkillAcquireCondition(선수({ ...기본, seasonPopularityGain: 15 }), 값(2), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition(선수({ ...기본, seasonPopularityGain: 16 }), 값(2), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ ...기본, season: 2, seasonPopularityGain: 0 }), 값(2), undefined)).toBe(false)
  })

  it('2 먹튀의 인기도 합은 s16 +0x1c2 를 ldrsh 로 읽는다 (0xad2c0) — 32767 을 넘긴 합은 음수로 돌아 걸린다', () => {
    const 기본 = { skillIds: [], season: 3, gamesPlayed: 14 }
    // 0x8000 = −32768 · 0x10010 = 16
    expect(meetsSkillAcquireCondition(선수({ ...기본, seasonPopularityGain: 0x8000 }), 값(2), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition(선수({ ...기본, seasonPopularityGain: 0x10010 }), 값(2), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ ...기본, seasonPopularityGain: 0x1000f }), 값(2), undefined)).toBe(true)
  })

  it('20 에러왕 — 연차 ≥ 3 · 수비 실효 ≤ 400 · 30경기째 · 이번 시즌 수비 훈련 0', () => {
    const 기본 = { skillIds: [], season: 4, gamesPlayed: 30, ability: { hit: 400, power: 400, defense: 400, run: 400 } }
    expect(meetsSkillAcquireCondition(선수(기본), 값(20), undefined)).toBe(true)
    // 29경기째에는 보지 않는다 — 원본은 경기 수를 같음(==)으로 본다
    expect(meetsSkillAcquireCondition(선수({ ...기본, gamesPlayed: 29 }), 값(20), undefined)).toBe(false)
    // 이번 시즌에 수비를 한 번이라도 훈련했으면 안 걸린다
    const 훈련함 = 선수({ ...기본, trainingCounts: { 수비: 1 }, seasonStartTrainingCounts: {} })
    expect(meetsSkillAcquireCondition(훈련함, 값(20), undefined)).toBe(false)
    // 지난 시즌 훈련은 세지 않는다 (통산 − 새 시즌 사본)
    const 작년훈련 = 선수({ ...기본, trainingCounts: { 수비: 5 }, seasonStartTrainingCounts: { 수비: 5 } })
    expect(meetsSkillAcquireCondition(작년훈련, 값(20), undefined)).toBe(true)
  })
})

describe('조건 20 — 기록 · 카운터로 얻는 스킬 (0xad474 ~ 0xad7cc 모드 4)', () => {
  it('7 전설 — 정규시즌 1위 ≥ 8 이고 MVP 비트(0~12) 수 > 6', () => {
    const 전설 = 선수({ regularSeasonFirstCount: 8, mvpSeasonBits: 0b1111111 })
    expect(meetsSkillAcquireCondition(전설, 값(7), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition({ ...전설, regularSeasonFirstCount: 7 }, 값(7), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition({ ...전설, mvpSeasonBits: 0b111111 }, 값(7), undefined)).toBe(false)
  })

  it('10 해결사 · 16 상승세 — 경기 카운터 S+0x1f0[6] > 5 · [1]+[2]+[3] > 9, 11 번트왕은 카운터를 세지 않아 불발', () => {
    expect(meetsSkillAcquireCondition(선수({ gameSkillCounters: [0, 0, 0, 0, 0, 0, 6] }), 값(10), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition(선수({ gameSkillCounters: [0, 0, 0, 0, 0, 0, 5] }), 값(10), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ gameSkillCounters: [0, 4, 3, 3] }), 값(16), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition(선수({ gameSkillCounters: [0, 3, 3, 3] }), 값(16), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition(선수({ gameSkillCounters: [0, 0, 0, 0, 0, 99, 0] }), 값(11), undefined)).toBe(false)
  })

  it('12 찬스 · 13 좌완UP · 14 우완UP · 15 제압 — 통산(지난 해 + 이번 해) 2루타 · 타점 · 안타 · 3루타와 손', () => {
    const 해 = { ...EMPTY_SEASON_STATS, hits: 300, doubles: 60, triples: 5, runsBattedIn: 100 }
    const 둘째해 = 선수({ season: 2, yearlyStats: [해], stats: 해 })
    expect(meetsSkillAcquireCondition(둘째해, 값(12), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition(둘째해, 값(15), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition({ ...둘째해, battingSide: 0 }, 값(13), undefined)).toBe(true)
    expect(meetsSkillAcquireCondition({ ...둘째해, battingSide: 0 }, 값(14), undefined)).toBe(false)
    expect(meetsSkillAcquireCondition({ ...둘째해, battingSide: 1 }, 값(14), undefined)).toBe(true)
    // 지난 해 칸이 없으면(첫 해) 이번 해만
    expect(meetsSkillAcquireCondition(선수({ stats: 해 }), 값(12), undefined)).toBe(false)
  })

  it('경기 카운터 0xa690c — 전 타수 홈런이면 [1], 아니면 [2]·[3] 에 연타석 홈런, [4] 끝내기 · [6] 만루 홈런', () => {
    const 홈런만 = withGameSkillCounters(선수(), {
      stats: { ...EMPTY_SEASON_STATS, atBats: 2, hits: 2, homeRuns: 2 },
      reputationCounts: { ...EMPTY_REPUTATION_COUNTS, grandSlams: 1, homeRunStreaksOfTwo: 1 },
    })
    expect(홈런만.gameSkillCounters).toEqual([0, 1, 0, 0, 0, 0, 1])
    const 섞임 = withGameSkillCounters(홈런만, {
      stats: { ...EMPTY_SEASON_STATS, atBats: 5, hits: 3, homeRuns: 3 },
      reputationCounts: { ...EMPTY_REPUTATION_COUNTS, walkOffs: 1, homeRunStreaksOfTwo: 1, homeRunStreaksOfThree: 1 },
    })
    expect(섞임.gameSkillCounters).toEqual([0, 1, 1, 1, 1, 0, 1])
  })
})

describe('바이트 칸 읽기 — 원본 그대로 넘친다', () => {
  it('18·19·20 의 칸별 시즌 훈련 수는 u8 통산 − s8 사본 (0xad87e) — 256 회째에 0 으로 돈다', () => {
    const 약함 = { hit: 400, power: 400, defense: 400, run: 400 }
    // 통산 256 = u8 0, 사본 0 → 0 회로 읽혀 똑딱이(파워 훈련 0) 조건을 통과한다
    const 넘침 = 선수({ skillIds: [], gamesPlayed: 20, ability: 약함, trainingCounts: { 파워: 256 } })
    expect(meetsSkillAcquireCondition(넘침, 값(19), undefined)).toBe(true)
  })

  it('먹튀 해제는 s8 경기 수 · s16 합으로 읽는다 (0xad9ce)', () => {
    // 합 32768 은 s16 로 −32768 이라 평균이 음수 — 풀리지 않는다
    expect(meetsSkillReleaseCondition(선수({ skillIds: [2], moneyGrubberGames: 5, moneyGrubberPopularityGain: 32768 }), 값(2))).toBe(false)
  })
})

describe('조건 21 — 스킬 해제', () => {
  it('하위 표 0xd8454 의 6~17(14 는 모드 4 갈래)은 가지고 있으면 곧 통과', () => {
    for (const id of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
      expect(meetsSkillReleaseCondition(선수({ skillIds: [id] }), 값(id))).toBe(true)
    }
  })

  it('가지고 있지 않으면 뜨지 않는다', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [] }), 값(6))).toBe(false)
  })

  it('표에 없는 스킬은 가지고 있으면 통과한다', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [6] }), 값(6))).toBe(true)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [16] }), 값(16))).toBe(true)
  })

  it('3 몹쓸몸은 그 스킬을 가진 채로 훈련 6회를 해야 풀린다 (+0x75 > 5)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [3], badBodyTrainings: 5 }), 값(3))).toBe(false)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [3], badBodyTrainings: 6 }), 값(3))).toBe(true)
  })

  it('18 헛스윙은 히트를 연속 8회 훈련해야 풀린다 (+0x70 > 7)', () => {
    const 일곱 = 선수({ skillIds: [18], consecutiveTrainingCounts: { 히트: 7 } })
    const 여덟 = 선수({ skillIds: [18], consecutiveTrainingCounts: { 히트: 8 } })

    expect(meetsSkillReleaseCondition(일곱, 값(18))).toBe(false)
    expect(meetsSkillReleaseCondition(여덟, 값(18))).toBe(true)
  })

  it('5 무력감은 경기 뒤 사기 ≥ 90 인 경기가 연속 6회여야 풀린다 (+0x1c7 > 5)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [5], highMoraleStreak: 5 }), 값(5))).toBe(false)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [5], highMoraleStreak: 6 }), 값(5))).toBe(true)
  })

  it('2 먹튀는 5경기 이상이고 경기당 인기도 변화가 3 을 넘어야 풀린다 (0xad9ce)', () => {
    expect(meetsSkillReleaseCondition(선수({ skillIds: [2], moneyGrubberGames: 5, moneyGrubberPopularityGain: 20 }), 값(2))).toBe(true)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [2], moneyGrubberGames: 5, moneyGrubberPopularityGain: 15 }), 값(2))).toBe(false)
    expect(meetsSkillReleaseCondition(선수({ skillIds: [2], moneyGrubberGames: 4, moneyGrubberPopularityGain: 40 }), 값(2))).toBe(false)
  })
})
