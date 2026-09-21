import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { HALL_OF_FAME_FIRST_ID, PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import {
  TRADE_BOOST_RATE, applyTrade, batterPositionPenaltyOf, canUseTradeCommand, markTradeUsed,
  pitcherRolePenaltyOf, rollTradeSuccess, tradeBoostCostOf, tradeRefusalOf, tradeSuccessRate,
} from '@/entities/season-mode/model/playerTrade'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 트레이드 성공률·비용 (0xcf24) — `docs/re/J-modes-rules.md` 4-4 확정.
 */

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

const 선수 = (덮어쓰기: Partial<SeasonPlayer> = {}): SeasonPlayer => ({
  id: 0, kindByte: 0, fieldPosition: 0, stamina: 0, ...덮어쓰기,
})

/** 뽑기를 정해 놓은 난수 — `bfa55(1,101)` 이 값 하나만 준다 */
const 고정난수 = (value: number): RandomPort => ({
  next: () => (value - 1) / 100,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

const 성공률 = (덮어쓰기: Partial<Parameters<typeof tradeSuccessRate>[0]> = {}) =>
  tradeSuccessRate({ myGrade: 0, opponentGrade: 0, myPenalty: 0, opponentPenalty: 0, boost: 0, ...덮어쓰기 })

describe('자리 벌점 (0xb6561)', () => {
  it('타자는 자리 0 → 10 · 7 → 8 · 1·4 → 6 · 그 밖 0', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(batterPositionPenaltyOf)).toEqual([10, 6, 0, 0, 6, 0, 0, 8, 0])
  })

  it('투수는 보직 3 → 10 · 2·4 → 8 · 0 → 6 · 그 밖 0', () => {
    expect([0, 1, 2, 3, 4, 5].map(pitcherRolePenaltyOf)).toEqual([6, 0, 8, 10, 8, 0])
  })
})

describe('성공률 r = 40 − |d|·100/250 − 벌점 두 개', () => {
  it('등급이 같고 벌점이 없으면 40% 다', () => {
    expect(성공률()).toBe(40)
  })

  it('벌점은 양쪽 것을 다 뺀다', () => {
    expect(성공률({ myPenalty: 10, opponentPenalty: 8 })).toBe(22)
  })

  it('⚠️ 차이를 **절댓값**으로 본다 — 내가 더 좋은 선수를 내줘도 확률이 떨어진다', () => {
    // d = (5 − 0) × 10 = 50 → 50·100/250 = 20
    expect(성공률({ myGrade: 5 })).toBe(20)
  })

  it('⚠️ 좋은 선수를 달라고 하면 음수라 **두 배로** 떨어진다', () => {
    // d = (0 − 5) × 10 = −50 → ×2 = −100 → |d|·100/250 = 40
    expect(성공률({ opponentGrade: 5 })).toBe(0 + 3)
  })

  it('바닥은 3 이고, 그 아래로는 안 내려간다', () => {
    expect(성공률({ myPenalty: 10, opponentPenalty: 10, opponentGrade: 9 })).toBe(3)
  })

  it('비용 칸은 바닥을 친 **뒤에** 더하고 100 에서 자른다', () => {
    expect(TRADE_BOOST_RATE).toEqual([0, 50, 20])
    expect(성공률({ boost: 1 })).toBe(90)
    expect(성공률({ boost: 2 })).toBe(60)
    expect(성공률({ myPenalty: 10, opponentPenalty: 10, opponentGrade: 9, boost: 1 })).toBe(53)
  })

  it('비용은 0G · 2000G · 1000G 다 (표 [0,20,10] × 100)', () => {
    expect([0, 1, 2].map(tradeBoostCostOf)).toEqual([0, 2000, 1000])
  })
})

describe('성공 판정 — bfa55(1,101) < r', () => {
  it('⚠️ 뽑기가 1..100 이라 실제 확률은 (r−1)% 다 — r 과 같은 값이 나오면 실패다', () => {
    expect(rollTradeSuccess(고정난수(39), 40)).toBe(true)
    expect(rollTradeSuccess(고정난수(40), 40)).toBe(false)
  })

  it('강제 성공 플래그(this+0x148, CPU 요청 수락)는 굴리지 않는다', () => {
    expect(rollTradeSuccess(고정난수(100), 3, true)).toBe(true)
  })
})

describe('트레이드 못 하는 선수 (StrMODE[165]/[166])', () => {
  it('명예의 전당 선수는 id 구간으로 걸린다', () => {
    expect(tradeRefusalOf(선수({ id: HALL_OF_FAME_FIRST_ID }))).toBe('명예선수')
  })

  it('나만의리그 육성 선수는 +0xa 의 bit7 로 걸린다', () => {
    expect(tradeRefusalOf(선수({ kindByte: PLAYER_OWN_BIT | 3 }))).toBe('나리선수')
  })

  it('일반 선수는 걸리지 않는다', () => {
    expect(tradeRefusalOf(선수({ id: 3, kindByte: 3 }))).toBeNull()
  })
})

describe('커맨드 횟수 (SR+0x56)', () => {
  it('한 번 쓰면 막힌다 — 되돌리는 것은 협회허가증(GP 아이템 칸 5)뿐이다', () => {
    const record = 레코드()
    expect(canUseTradeCommand(record)).toBe(true)

    const 쓴뒤 = markTradeUsed(record)
    expect(쓴뒤.tradeUsed).toBe(1)
    expect(canUseTradeCommand(쓴뒤)).toBe(false)
    // 협회허가증은 `rec[0x56] = 0` 한 줄이다
    expect(canUseTradeCommand({ ...쓴뒤, tradeUsed: 0 })).toBe(true)
  })
})

describe('명단 반영 (근사 — 교환 루틴은 미해독)', () => {
  const roster: SeasonTeamRoster = {
    pitchers: [선수({ id: 0, kindByte: 0 }), 선수({ id: 1, kindByte: 1 })],
    batters: [선수({ id: 0, kindByte: 0, fieldPosition: 2 })],
  }

  it('고른 자리만 상대 선수로 바뀌고 칸 번호·수비 자리는 그대로다', () => {
    const 결과 = applyTrade(roster, true, 1, 선수({ id: 7, kindByte: 7, stamina: 500 }))

    expect(결과.pitchers).toHaveLength(2)
    expect(결과.pitchers[1].id).toBe(7)
    expect(결과.pitchers[1].kindByte).toBe(1) // 내주는 선수의 칸 번호를 물려받는다
    expect(결과.pitchers[0].id).toBe(0)
    expect(결과.batters).toBe(roster.batters)
  })

  it('없는 자리면 명단을 그대로 둔다', () => {
    expect(applyTrade(roster, false, 5, 선수({ id: 9 }))).toBe(roster)
  })
})
