import { describe, expect, it } from 'vitest'
import type { BurstTriggerContext } from '@/entities/burst-mission/model/burstMissionTrigger'
import {
  ACE_BATTER_SITUATIONS,
  ACE_PITCHER_SITUATIONS,
  isRowEligible,
  matchesBases,
  matchesGameRecord,
  matchesOuts,
  matchesScoreDifference,
  matchesSituation,
  rollBurstRow,
  rollChance,
} from '@/entities/burst-mission/model/burstMissionTrigger'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정난수 = (values: number[]): RandomPort => {
  let index = 0
  return {
    next: () => values[index++ % values.length],
    nextInRange: (minimum) => minimum,
    pick: (candidates) => candidates[0],
  }
}

const 상황 = (patch: Partial<BurstTriggerContext> = {}): BurstTriggerContext => ({
  isHumanTeamBatting: true,
  bases: { first: false, second: false, third: false },
  outs: 0,
  inning: 0,
  ourScore: 0,
  opponentScore: 0,
  opponentBattingSlot: 0,
  opponentAceBatterId: null,
  opponentAcePitcherId: null,
  hitsInGame: 0,
  homeRunsInGame: 0,
  strikeoutsInGame: 0,
  ...patch,
})

describe('b0 상황 검사 (0x8ee3c, 점프표 0xd51d8)', () => {
  it('0 이면 언제나 통과한다', () => {
    expect(matchesSituation(행({ situation: 0 }), 상황())).toBe(true)
  })

  it('1 은 상대 타순 슬롯 2~4(3~5번 클린업)일 때만', () => {
    const row = 행({ situation: 1 })
    const 통과 = [2, 3, 4].map((slot) => matchesSituation(row, 상황({ opponentBattingSlot: slot })))
    const 거름 = [0, 1, 5, 8].map((slot) => matchesSituation(row, 상황({ opponentBattingSlot: slot })))

    expect(통과).toEqual([true, true, true])
    expect(거름).toEqual([false, false, false, false])
  })

  it('2 역전찬스 — 0-기준 이닝 > 7 이고 지고 있고 주자 수 ≥ 점수차', () => {
    const row = 행({ situation: 2 })
    const 만루 = { first: true, second: true, third: true }

    // 9회(0-기준 8), 3점 차로 지는 중, 주자 셋 → 통과
    expect(matchesSituation(row, 상황({ inning: 8, ourScore: 1, opponentScore: 4, bases: 만루 }))).toBe(true)
    // 주자가 점수차보다 적으면 거른다
    expect(
      matchesSituation(row, 상황({ inning: 8, ourScore: 0, opponentScore: 4, bases: 만루 })),
    ).toBe(false)
    // 8회(0-기준 7)면 이르다
    expect(matchesSituation(row, 상황({ inning: 7, ourScore: 1, opponentScore: 2, bases: 만루 }))).toBe(false)
    // 이기는 중이면 역전찬스가 아니다
    expect(matchesSituation(row, 상황({ inning: 8, ourScore: 4, opponentScore: 1, bases: 만루 }))).toBe(false)
  })

  it('10·12·20·21·22 는 상대 타자가 그 마타자일 때 (표 0xd5234)', () => {
    expect(matchesSituation(행({ situation: 10 }), 상황({ opponentAceBatterId: 'medica' }))).toBe(true)
    expect(matchesSituation(행({ situation: 10 }), 상황({ opponentAceBatterId: 'roze' }))).toBe(false)
    expect(matchesSituation(행({ situation: 22 }), 상황({ opponentAceBatterId: 'tiger' }))).toBe(true)
  })

  it('11·13·17·18·19 는 상대 투수가 그 마투수일 때 (표 0xd5248)', () => {
    expect(matchesSituation(행({ situation: 17 }), 상황({ opponentAcePitcherId: 'psyker' }))).toBe(true)
    expect(matchesSituation(행({ situation: 19 }), 상황({ opponentAcePitcherId: 'dragona' }))).toBe(true)
    expect(matchesSituation(행({ situation: 19 }), 상황({ opponentAceBatterId: 'dragona' }))).toBe(false)
  })

  it('마선수 번호는 웹 acePlayers 의 id 와 짝이 맞는다', () => {
    const 타자 = ACE_PLAYERS.filter((ace) => ace.role === '타자').map((ace) => ace.id)
    const 투수 = ACE_PLAYERS.filter((ace) => ace.role === '투수').map((ace) => ace.id)

    expect(Object.values(ACE_BATTER_SITUATIONS).sort()).toEqual([...타자].sort())
    expect(Object.values(ACE_PITCHER_SITUATIONS).sort()).toEqual([...투수].sort())
  })

  it('3~9·14~16 은 늘 거짓이다', () => {
    for (const situation of [3, 5, 9, 14, 16]) {
      expect(matchesSituation(행({ situation }), 상황())).toBe(false)
    }
  })
})

describe('b1~b3 주자 검사 (0x8ede8)', () => {
  it('−1 무관 · 0 비어야 · 1 있어야', () => {
    const 주자1루 = 상황({ bases: { first: true, second: false, third: false } })

    expect(matchesBases(행({ bases: [1, 0, 0] }), 주자1루)).toBe(true)
    expect(matchesBases(행({ bases: [1, -1, -1] }), 주자1루)).toBe(true)
    expect(matchesBases(행({ bases: [0, -1, -1] }), 주자1루)).toBe(false)
    expect(matchesBases(행({ bases: [1, 1, -1] }), 주자1루)).toBe(false)
  })

  it('b0 == 2(역전찬스)면 주자 조건을 통째로 건너뛴다', () => {
    const 빈루 = 상황()

    expect(matchesBases(행({ situation: 2, bases: [1, 1, 1] }), 빈루)).toBe(true)
  })
})

describe('b4 아웃 · b5 점수차 · b6·b7 기록 검사', () => {
  it('아웃은 −1 이면 무관, 아니면 같아야 한다 (0x8ec3c)', () => {
    expect(matchesOuts(행({ outs: -1 }), 상황({ outs: 2 }))).toBe(true)
    expect(matchesOuts(행({ outs: 1 }), 상황({ outs: 1 }))).toBe(true)
    expect(matchesOuts(행({ outs: 1 }), 상황({ outs: 2 }))).toBe(false)
  })

  it('점수차 +k 는 1~k 로 이기는 중, −k 는 1~k 로 지는 중이다 (0x8ed50)', () => {
    const 이김2 = 행({ scoreDifference: 2 })
    const 짐2 = 행({ scoreDifference: -2 })

    expect(matchesScoreDifference(이김2, 상황({ ourScore: 3, opponentScore: 1 }))).toBe(true)
    expect(matchesScoreDifference(이김2, 상황({ ourScore: 4, opponentScore: 1 }))).toBe(false)
    expect(matchesScoreDifference(짐2, 상황({ ourScore: 1, opponentScore: 3 }))).toBe(true)
    expect(matchesScoreDifference(짐2, 상황({ ourScore: 1, opponentScore: 4 }))).toBe(false)
  })

  it('동점은 0(무관)이 아닌 한 어느 쪽도 통과하지 못한다', () => {
    const 동점 = 상황({ ourScore: 2, opponentScore: 2 })

    expect(matchesScoreDifference(행({ scoreDifference: 2 }), 동점)).toBe(false)
    expect(matchesScoreDifference(행({ scoreDifference: -2 }), 동점)).toBe(false)
    expect(matchesScoreDifference(행({ scoreDifference: 0 }), 동점)).toBe(true)
  })

  it('기록 조건은 개수가 **같아야** 통과한다 — 1 안타 · 2 홈런 · 3 탈삼진 (0x8ec9c)', () => {
    expect(matchesGameRecord(행({ recordKind: 1, recordCount: 3 }), 상황({ hitsInGame: 3 }))).toBe(true)
    expect(matchesGameRecord(행({ recordKind: 1, recordCount: 3 }), 상황({ hitsInGame: 4 }))).toBe(false)
    expect(matchesGameRecord(행({ recordKind: 2, recordCount: 2 }), 상황({ homeRunsInGame: 2 }))).toBe(true)
    expect(matchesGameRecord(행({ recordKind: 3, recordCount: 9 }), 상황({ strikeoutsInGame: 9 }))).toBe(true)
    expect(matchesGameRecord(행({ recordKind: 0 }), 상황({ hitsInGame: 7 }))).toBe(true)
  })
})

describe('확률 주사위 (0x8ec64)', () => {
  it('rand(0,1000)/10 < b9 — 999 는 99 가 되어 100% 행만 통과한다', () => {
    // next() 0.999 → rand = 999 → 99
    expect(rollChance(100, 고정난수([0.999]))).toBe(true)
    expect(rollChance(99, 고정난수([0.999]))).toBe(false)
    // next() 0 → rand = 0 → 0
    expect(rollChance(1, 고정난수([0]))).toBe(true)
    expect(rollChance(0, 고정난수([0]))).toBe(false)
  })
})

describe('후보 모으기와 추첨 (0x8f000)', () => {
  it('조건을 통과한 행마다 주사위를 굴리고 통과한 후보 중 균등하게 하나를 뽑는다', () => {
    const rows = [행({ index: 0 }), 행({ index: 1 }), 행({ index: 2 })]
    // 주사위 세 번(모두 통과) → 추첨 한 번(0.5 → 3칸 중 1번)
    const random = 고정난수([0, 0, 0, 0.5])

    expect(rollBurstRow(rows, 상황(), random)?.index).toBe(1)
  })

  it('조건에서 걸린 행은 주사위를 굴리지 않는다 — 난수 소모 횟수가 원본과 같아야 한다', () => {
    const rows = [행({ index: 0, outs: 2 }), 행({ index: 1 })]
    // 첫 행은 아웃 조건에서 걸리므로 주사위는 두 번째 행에만 굴린다.
    // 난수 하나(0)로 주사위가 통과하고, 그 다음 0.5 가 추첨(후보 1개 → 0번)에 쓰인다
    const random = 고정난수([0, 0.5])

    expect(rollBurstRow(rows, 상황({ outs: 0 }), random)?.index).toBe(1)
  })

  it('후보가 없으면 발동하지 않는다', () => {
    const rows = [행({ chancePercent: 0 })]

    expect(rollBurstRow(rows, 상황(), 고정난수([0]))).toBeNull()
    expect(rollBurstRow([], 상황(), 고정난수([0]))).toBeNull()
  })

  it('조건을 모두 보는 isRowEligible', () => {
    const row = 행({ situation: 1, bases: [1, -1, 0], outs: 1, scoreDifference: -1, recordKind: 1, recordCount: 2 })
    const 맞는상황 = 상황({
      opponentBattingSlot: 3,
      bases: { first: true, second: true, third: false },
      outs: 1,
      ourScore: 2,
      opponentScore: 3,
      hitsInGame: 2,
    })

    expect(isRowEligible(row, 맞는상황)).toBe(true)
    expect(isRowEligible(row, { ...맞는상황, outs: 2 })).toBe(false)
  })
})
