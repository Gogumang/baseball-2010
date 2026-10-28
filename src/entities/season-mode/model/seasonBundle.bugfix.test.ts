import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { MORALE_LIMIT, startNewSeason, startNextYear } from '@/entities/season-mode/model/seasonRecord'
import { buyStadiumItem, canEquipStadiumItem, equipStadiumItem } from '@/entities/season-mode/model/stadiumItems'
import {
  SEASON_RECORD_CODE,
  clearSeasonGameRecord,
  recordSeasonGameEvent,
  seasonReputationScoreOf,
} from '@/entities/season-mode/model/seasonReputation'
import { rollTradeSuccess, tradeSuccessRate } from '@/entities/season-mode/model/playerTrade'
import { PLAYER_KIND, insertBatter, insertPitcher, recruitPlayer, slotOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { applySeasonEquipment, checkSeasonEquipment } from '@/entities/season-mode/model/seasonEquipment'
import type { RandomPort } from '@/shared/api/random/randomPort'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

describe('B-06 사지 않은 구장 아이템 끼우기', () => {
  it('원본: 안 산 칸도 끼워진다', () => {
    const 레코드 = startNewSeason(0, '테스터').record
    expect(equipStadiumItem(레코드, '관중석', 3).stadiumEquipped[0]).toBe(3)
  })

  it('고침: 산 칸과 칸 0 만 끼운다 — 안 산 칸은 레코드 그대로', () => {
    켜기('B-06')
    const 레코드 = startNewSeason(0, '테스터').record
    expect(canEquipStadiumItem(레코드, '관중석', 3)).toBe(false)
    expect(equipStadiumItem(레코드, '관중석', 3)).toBe(레코드)
    const 산뒤 = buyStadiumItem({ ...레코드, money: 9999 }, '관중석', 3)
    const 바꾼뒤 = equipStadiumItem(산뒤, '관중석', 0)
    expect(바꾼뒤.stadiumEquipped[0]).toBe(0)
    expect(equipStadiumItem(바꾼뒤, '관중석', 3).stadiumEquipped[0]).toBe(3)
  })
})

describe('B-16 평판 코드 4·5 뒤집힘', () => {
  const 기록 = (code: number, times: number) => {
    let slots: number[] = clearSeasonGameRecord()
    for (let index = 0; index < times; index += 1) slots = recordSeasonGameEvent(slots, code, '수비')
    return slots
  }
  const 문맥 = { opponentRuns: 0, myRuns: 0, won: false, tied: true, completeGame: null } as const
  // 동점 · 선공 아님 문맥에서 다른 가산이 없는 바닥 — 차이만 본다
  const 바닥 = seasonReputationScoreOf(clearSeasonGameRecord(), 문맥)

  it('원본: 탈삼진 셋은 +1, 병살 셋은 −2', () => {
    expect(seasonReputationScoreOf(기록(SEASON_RECORD_CODE.탈삼진, 3), 문맥) - 바닥).toBe(1)
    expect(seasonReputationScoreOf(기록(SEASON_RECORD_CODE.병살, 3), 문맥) - 바닥).toBe(-2)
  })

  it('고침: 코드 k 는 칸 k — 병살 셋은 +1, 탈삼진 셋은 −2 (평판식은 그대로)', () => {
    켜기('B-16')
    expect(기록(SEASON_RECORD_CODE.탈삼진, 1)[4]).toBe(1)
    expect(기록(SEASON_RECORD_CODE.병살, 1)[5]).toBe(1)
    expect(seasonReputationScoreOf(기록(SEASON_RECORD_CODE.병살, 3), 문맥) - 바닥).toBe(1)
    expect(seasonReputationScoreOf(기록(SEASON_RECORD_CODE.탈삼진, 3), 문맥) - 바닥).toBe(-2)
  })
})

describe('B-18 국가대항전을 치른 해에 사기 100 이 안 돌아옴 · B-20 트레이드가 시즌 내내 한 번뿐', () => {
  const 대회친해 = () => {
    const 상태 = startNewSeason(0, '테스터')
    return { ...상태, teamMorale: 40, record: { ...상태.record, nationalCup: true, tradeUsed: 1 } }
  }

  it('원본: 대회를 치른 해는 사기가 그대로 · 트레이드 칸도 그대로', () => {
    const 새해 = startNextYear(대회친해())
    expect(새해.teamMorale).toBe(40)
    expect(새해.record.tradeUsed).toBe(1)
  })

  it('B-18 고침: 대회를 치른 해도 사기 100', () => {
    켜기('B-18')
    expect(startNextYear(대회친해()).teamMorale).toBe(MORALE_LIMIT)
  })

  it('B-20 고침: 새 해에 트레이드 칸을 되돌린다', () => {
    켜기('B-20')
    expect(startNextYear(대회친해()).record.tradeUsed).toBe(0)
  })
})

describe('B-19 트레이드 성공률이 절댓값으로 계산됨', () => {
  const 입력 = (myGrade: number, opponentGrade: number) => ({ myGrade, opponentGrade, myPenalty: 0, opponentPenalty: 0, boost: 0 })
  const 고정 = (value: number): RandomPort => ({ rand: () => value, rand9d: () => value })

  it('원본: 더 좋은 선수를 내줘도 깎이고, 뽑기 < r 이라 r 이 나와도 실패', () => {
    expect(tradeSuccessRate(입력(10, 5))).toBe(40 - 20)
    expect(rollTradeSuccess(고정(30), 30)).toBe(false)
  })

  it('고침: 내가 더 좋은 선수를 내주면 등급 차로 안 깎는다 · 달라고 하면 원본대로 · 뽑기 ≤ r', () => {
    켜기('B-19')
    expect(tradeSuccessRate(입력(10, 5))).toBe(40)
    expect(tradeSuccessRate(입력(5, 10))).toBe(3) // 40 − 40 → 바닥 3
    expect(rollTradeSuccess(고정(30), 30)).toBe(true)
    expect(rollTradeSuccess(고정(31), 30)).toBe(false)
  })

  it('고침도 뽑기는 하나다', () => {
    켜기('B-19')
    let calls = 0
    const 세기: RandomPort = {
      rand: () => {
        calls += 1
        return 50
      },
      rand9d: () => 0,
    }
    rollTradeSuccess(세기, 50, true)
    expect(calls).toBe(1)
  })
})

describe('B-22 영입에서 밀려난 선수가 안 빠지고, 투수 칸 번호가 겹침', () => {
  const 투수 = (id: number, slot: number): SeasonPlayer => ({ id, kindByte: PLAYER_KIND.일반투수 | slot, fieldPosition: 0, stamina: 5000 })
  const 타자 = (id: number, slot: number, position: number): SeasonPlayer => ({
    id,
    kindByte: PLAYER_KIND.일반타자 | slot,
    fieldPosition: position,
    stamina: 0,
  })
  const 로스터 = (): SeasonTeamRoster => ({
    pitchers: [0, 1, 2, 3, 4, 5, 6, 7].map((slot) => 투수(100 + slot, slot)),
    batters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((slot) => 타자(200 + slot, slot, slot % 9)),
  })
  const 새투수: SeasonPlayer = { id: 0xb4, kindByte: 0, fieldPosition: 0, stamina: 0 }
  const 새타자: SeasonPlayer = { id: 0xc8, kindByte: 0x20, fieldPosition: 0, stamina: 0 }

  it('원본: 밀려난 선수는 맨 끝으로 · 투수는 칸 번호가 겹친다', () => {
    const 결과 = recruitPlayer(로스터(), 새투수, true, 2)
    expect(결과.roster.pitchers).toHaveLength(9)
    expect(slotOf(결과.roster.pitchers[8]!)).toBe(slotOf(결과.roster.pitchers[2]!))
    expect(insertBatter(로스터().batters, 새타자, 3)).toHaveLength(13)
  })

  it('고침: 그 칸을 바꾼다 — 길이 그대로, 밀려난 선수는 빠지고 타자는 수비 위치를 잇는다', () => {
    켜기('B-22')
    const 결과 = recruitPlayer(로스터(), 새투수, true, 2)
    expect(결과.roster.pitchers).toHaveLength(8)
    expect(결과.roster.pitchers.map((player) => player.id)).not.toContain(102)
    expect(결과.roster.pitchers[2]!.id).toBe(0xb4)
    expect(new Set(결과.roster.pitchers.map(slotOf)).size).toBe(8)
    const 타자들 = insertBatter(로스터().batters, 새타자, 3)
    expect(타자들).toHaveLength(12)
    expect(타자들[3]).toEqual({ ...새타자, fieldPosition: 3 })
    expect(insertPitcher(로스터().pitchers, 새투수, 0)).toHaveLength(8)
  })
})

describe('B-23 장비를 바꿔 끼우면 앞 장비가 사라짐', () => {
  const 레코드 = { popularity: 1000, money: 9999 }
  const 없음 = () => false

  it('원본: 예전에 끼었던 칸도 다시 산다 · 산 칸 비트가 없다', () => {
    expect(checkSeasonEquipment(레코드, { isBatter: false, equipment: [3, 0, 0, 0], ownedEquipment: [1, 0, 0, 0] }, 0, 0, 없음)).toEqual({
      ok: true,
      price: 4,
    })
    expect(applySeasonEquipment(500, { isBatter: false, equipment: [0, 0, 0, 0] }, 0, 0)).toEqual({ money: 460, equipment: [1, 0, 0, 0] })
  })

  it('고침: 산 칸 · 빼낸 칸을 적고, 산 적 있는 칸은 돈 없이 끼운다', () => {
    켜기('B-23')
    // 칸 0 을 사서 끼운다
    const 첫 = applySeasonEquipment(500, { isBatter: false, equipment: [0, 0, 0, 0] }, 0, 0)
    expect(첫).toEqual({ money: 460, equipment: [1, 0, 0, 0], ownedEquipment: [1, 0, 0, 0] })
    // 칸 2 로 바꿔 산다 — 칸 0 은 산 칸으로 남는다
    const 둘 = applySeasonEquipment(첫.money, { isBatter: false, equipment: 첫.equipment, ownedEquipment: 첫.ownedEquipment }, 0, 2)
    expect(둘.money).toBe(460 - 120)
    expect(둘.ownedEquipment).toEqual([0b101, 0, 0, 0])
    // 칸 0 으로 되돌리면 돈 · 인기도 없이
    const 대상 = { isBatter: false, equipment: 둘.equipment, ownedEquipment: 둘.ownedEquipment }
    expect(checkSeasonEquipment({ popularity: 0, money: 0 }, 대상, 0, 0, 없음)).toEqual({ ok: true, price: 0, owned: true })
    expect(applySeasonEquipment(둘.money, 대상, 0, 0)).toEqual({ money: 둘.money, equipment: [1, 0, 0, 0], ownedEquipment: [0b101, 0, 0, 0] })
    // 지금 낀 칸은 원본처럼 이미보유
    expect(checkSeasonEquipment(레코드, 대상, 0, 2, 없음)).toEqual({ ok: false, reason: '이미보유' })
  })

  it('고침: 표에서 시작한 장비(산 기록 없음)도 빼면 산 칸으로 남는다', () => {
    켜기('B-23')
    const 바꿈 = applySeasonEquipment(9999, { isBatter: true, equipment: [4, 0, 0, 0] }, 0, 0)
    expect(바꿈.ownedEquipment).toEqual([0b1001, 0, 0, 0])
  })
})
