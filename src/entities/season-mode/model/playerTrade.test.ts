import { describe, expect, it, vi } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { HALL_OF_FAME_FIRST_ID, PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import {
  TRADE_BOOST_RATE, masterRosterSlotOf, swapTradedPlayers, tradePenaltyOf, tradeSlotPenaltyOf, canUseTradeCommand, markTradeUsed,
  rollTradeSuccess, tradeBoostCostOf, tradeMoneyChangeOf, tradeRefusalOf, tradeSuccessRate,
  withTradeMoney,
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

describe('자리 벌점 — 0xb6561 마스터 칸 번호를 탭별로 (0xcf24 cfe0~d0b8)', () => {
  it('탭 0(투수): 0 → 10 · 7 → 8 · 1·4 → 6 · 그 밖(−1 포함) 0', () => {
    expect([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => tradeSlotPenaltyOf(0, v))).toEqual([0, 10, 6, 0, 0, 6, 0, 0, 8, 0])
  })

  it('탭 1(타자): 3 → 10 · 2·4 → 8 · 0 → 6 · 그 밖 0', () => {
    expect([-1, 0, 1, 2, 3, 4, 5].map((v) => tradeSlotPenaltyOf(1, v))).toEqual([0, 6, 0, 8, 10, 8, 0])
  })

  it('⚠️ 투수는 마스터 팀을 id & 7 로 골라 팀 번호 == 팀 안 칸일 때만 찾는다 (원본 그대로)', () => {
    // 3팀 3번 투수 = id 27 → 27 & 7 = 3 = 27 / 8 → 찾는다, 값은 자기 +0xa 하위 5비트
    expect(masterRosterSlotOf(선수({ id: 3, kindByte: 3 }), 3, 0)).toBe(3)
    // 3팀 2번 투수 = id 26 → 마스터 팀 2 (id 16~23) 에 없다
    expect(masterRosterSlotOf(선수({ id: 2, kindByte: 2 }), 3, 0)).toBe(-1)
    // 트레이드로 온 선수는 옛 팀(표 팀)으로 id 를 만든다 — 5팀 5번 → id 45, 45 & 7 = 5 = 45 / 8
    expect(masterRosterSlotOf(선수({ id: 5, kindByte: 1, tableTeamId: 5 }), 0, 0)).toBe(1)
  })

  it('⚠️ 타자는 id / 12 팀을 0~7 칸까지만 훑는다 — 8~11 칸 출신은 못 찾는다', () => {
    expect(masterRosterSlotOf(선수({ id: 7, kindByte: 9 }), 4, 1)).toBe(9)
    expect(masterRosterSlotOf(선수({ id: 8, kindByte: 8 }), 4, 1)).toBe(-1)
  })

  it('표 밖 선수(나리·명전 id)는 −1 → 벌점 0', () => {
    expect(tradePenaltyOf(선수({ id: 0xfe, kindByte: 0 }), 0, 0)).toBe(0)
    expect(tradePenaltyOf(선수({ id: 0, kindByte: 0 }), 0, 0)).toBe(10)
    expect(tradePenaltyOf(선수({ id: 0, kindByte: 0 }), 0, 1)).toBe(6)
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

  it('강제 성공 플래그(this+0x148, CPU 요청 수락)면 뽑기가 커도 성공이다', () => {
    expect(rollTradeSuccess(고정난수(100), 3, true)).toBe(true)
  })

  it('강제 성공이어도 뽑기 하나는 먼저 나간다 (d160 → d16c → d170)', () => {
    const next = vi.fn(() => 0.5)
    rollTradeSuccess({ next, nextInRange: vi.fn(), pick: vi.fn() }, 3, true)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('성공한 트레이드의 소지금 — SR+2 += d (0xd180~0xd1a0)', () => {
  it('d = (내 − 상대) × 10, 음수면 ×2', () => {
    expect(tradeMoneyChangeOf(40, 10)).toBe(300)
    expect(tradeMoneyChangeOf(10, 40)).toBe(-600)
    expect(tradeMoneyChangeOf(7, 7)).toBe(0)
  })

  it('0..9999 로 자른다', () => {
    expect(withTradeMoney(레코드({ money: 100 }), 0, 60).money).toBe(0)
    expect(withTradeMoney(레코드({ money: 9990 }), 60, 0).money).toBe(9999)
    expect(withTradeMoney(레코드({ money: 50 }), 30, 20).money).toBe(150)
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

describe('성공 뒤 두 명단 맞바꾸기 (0xd1cc~0xd3ae)', () => {
  const 내팀 = 0
  const 상대팀 = 4
  const mine: SeasonTeamRoster = {
    pitchers: [선수({ id: 0, kindByte: 0, stamina: 9000 }), 선수({ id: 1, kindByte: 1, stamina: 4000 })],
    batters: [선수({ id: 0, kindByte: 0, fieldPosition: 2 }), 선수({ id: 1, kindByte: 1, fieldPosition: 0 })],
  }
  const theirs: SeasonTeamRoster = {
    pitchers: [선수({ id: 0, kindByte: 0, stamina: 100 }), 선수({ id: 1, kindByte: 1 }), 선수({ id: 2, kindByte: 2, stamina: 700 })],
    batters: [선수({ id: 0, kindByte: 0, fieldPosition: 5 }), 선수({ id: 1, kindByte: 1, fieldPosition: 9 })],
  }

  it('투수(탭 0)는 레코드째 맞바꾼다 — 칸 번호·스태미나가 선수를 따라가고 표 팀이 적힌다 (0xb5625)', () => {
    const 결과 = swapTradedPlayers(내팀, { mine, theirs }, { opponentTeamId: 상대팀, tab: 0, myIndex: 1, opponentIndex: 2 })

    expect(결과.mine.pitchers[1]).toEqual({ id: 2, kindByte: 2, fieldPosition: 0, stamina: 700, tableTeamId: 상대팀 })
    expect(결과.theirs.pitchers[2]).toEqual({ id: 1, kindByte: 1, fieldPosition: 0, stamina: 4000, tableTeamId: 내팀 })
    expect(결과.mine.pitchers[0]).toBe(mine.pitchers[0])
    expect(결과.mine.batters).toBe(mine.batters)
    expect(결과.theirs.batters).toBe(theirs.batters)
  })

  it('타자(탭 1)는 수비 위치를 자리에 남기고 칸 번호를 새 칸으로 쓴다 (0xb5649 → 0xb8e85 · 0xb6605)', () => {
    const 결과 = swapTradedPlayers(내팀, { mine, theirs }, { opponentTeamId: 상대팀, tab: 1, myIndex: 0, opponentIndex: 1 })

    expect(결과.mine.batters[0]).toEqual({ id: 1, kindByte: 0, fieldPosition: 2, stamina: 0, tableTeamId: 상대팀 })
    expect(결과.theirs.batters[1]).toEqual({ id: 0, kindByte: 1, fieldPosition: 9, stamina: 0, tableTeamId: 내팀 })
    expect(결과.mine.pitchers).toBe(mine.pitchers)
  })

  it('제 팀으로 돌아온 선수는 표 팀 칸을 지운다', () => {
    const 한번 = swapTradedPlayers(내팀, { mine, theirs }, { opponentTeamId: 상대팀, tab: 0, myIndex: 0, opponentIndex: 0 })
    const 두번 = swapTradedPlayers(내팀, 한번, { opponentTeamId: 상대팀, tab: 0, myIndex: 0, opponentIndex: 0 })

    expect(두번.mine.pitchers[0]).toEqual(mine.pitchers[0])
    expect(두번.theirs.pitchers[0]).toEqual(theirs.pitchers[0])
  })

  it('탭이 0·1 이 아니거나 칸이 없으면 그대로다', () => {
    const rosters = { mine, theirs }
    expect(swapTradedPlayers(내팀, rosters, { opponentTeamId: 상대팀, tab: 2, myIndex: 0, opponentIndex: 0 })).toBe(rosters)
    expect(swapTradedPlayers(내팀, rosters, { opponentTeamId: 상대팀, tab: 1, myIndex: 5, opponentIndex: 0 })).toBe(rosters)
  })
})
