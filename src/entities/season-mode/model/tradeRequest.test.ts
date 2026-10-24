import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import {
  ACE_BATTER_RECORD_GRADES, TRADE_REQUEST_TAB, playerGradeOf, rollTradeRequest, tradeRecordRowsOf,
} from '@/entities/season-mode/model/tradeRequest'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

/**
 * CPU 트레이드 요청 0x93c8 (경기 뒤 마무리 0xf1 진입 0x953c) — 직접 뜬 굴림 차례를 그대로 따르는지 본다.
 */

const MY_TEAM = 0

/** [값, 아래, 위) 차례대로 `rand(아래, 위)` 가 그 값을 내게 하는 난수. 다 쓰면 터진다 */
function 차례난수(draws: readonly (readonly [number, number, number])[]): RandomPort & { readonly used: () => number } {
  let index = 0
  return {
    ...createFractionRandom(() => {
      const draw = draws[index]
      if (draw === undefined) throw new Error(`난수 ${index} 번째가 더 필요하다`)
      index += 1
      const [value, low, high] = draw
      return (value - low + 0.5) / (high - low)
    }),
    used: () => index,
  }
}

const 레코드 = () => startNewSeason(MY_TEAM, '테스터').record
const 명단 = () => tableRosterOf(MY_TEAM)

describe('요청 굴림 bfa55(0, 10000) < 1000', () => {
  it('1000 이상이면 요청 없음 — 난수 하나만 쓰고 SR+0x17a 도 그대로다', () => {
    const random = 차례난수([[1000, 0, 10000]])
    const { request, record } = rollTradeRequest(random, 레코드(), 명단())

    expect(request.isRequested).toBe(false)
    expect(record.tradeRequestCount).toBe(0)
    expect(random.used()).toBe(1)
  })
})

describe('요청이 서면', () => {
  // 타자 탭(1)에서 상대 칸 0 의 값 이상인 내 타자를 찾는다
  const 상대팀 = 3
  const 상대값 = teamBatters(상대팀)[0]!.grade
  const 큰칸 = teamBatters(MY_TEAM).findIndex((player) => player.grade >= 상대값)
  const 작은칸 = teamBatters(MY_TEAM).findIndex((player) => player.grade < 상대값)

  it('표 값으로 두 칸을 찾을 수 있다 (시험 전제)', () => {
    expect(큰칸).toBeGreaterThanOrEqual(0)
    expect(작은칸).toBeGreaterThanOrEqual(0)
  })

  it('내 팀이 나오면 상대 팀을 다시 뽑고, 값이 같거나 큰 내 선수를 찾으면 선다 — 횟수 +1', () => {
    const random = 차례난수([
      [999, 0, 10000],
      [MY_TEAM, 0, 10], // 내 팀 — 다시
      [상대팀, 0, 10],
      [TRADE_REQUEST_TAB.타자, 0, 2],
      [0, 0, 12], // 상대 칸
      [작은칸, 0, 12], // 값이 작다 — 다시
      [큰칸, 0, 12],
    ])
    const { request, record } = rollTradeRequest(random, 레코드(), 명단())

    expect(request).toEqual({
      isRequested: true, myIndex: 큰칸, opponentIndex: 0, tab: TRADE_REQUEST_TAB.타자, opponentTeamId: 상대팀,
    })
    expect(record.tradeRequestCount).toBe(1)
    expect(random.used()).toBe(7)
  })

  it('나리 선수(+0xa bit7)는 값이 커도 못 고른다', () => {
    const roster = 명단()
    const 나리 = { ...roster.batters[큰칸], kindByte: PLAYER_OWN_BIT | 큰칸 }
    const 나리명단 = { ...roster, batters: roster.batters.map((player, index) => (index === 큰칸 ? 나리 : player)) }
    const 다른큰칸 = teamBatters(MY_TEAM).findIndex((player, index) => index !== 큰칸 && player.grade >= 상대값)
    const random = 차례난수([
      [0, 0, 10000], [상대팀, 0, 10], [TRADE_REQUEST_TAB.타자, 0, 2], [0, 0, 12],
      [큰칸, 0, 12],
      [다른큰칸, 0, 12],
    ])
    const { request } = rollTradeRequest(random, 레코드(), 나리명단)

    expect(request.myIndex).toBe(다른큰칸)
    expect(request.isRequested).toBe(true)
  })
})

describe('못 찾으면 요청이 사라진다 — 타자 13번 · 투수 9번 (n 검사가 뽑은 뒤에 있다)', () => {
  // 상대 칸 중 값이 가장 큰 선수 — 내 팀 누구도 못 넘게 하려면 내 쪽 가장 작은 칸만 뽑으면 된다
  const 상대팀 = 5

  const 실패굴림 = (tab: number, range: number, tries: number) => {
    const table = tab === TRADE_REQUEST_TAB.투수 ? teamPitchers(MY_TEAM) : teamBatters(MY_TEAM)
    const myGrades = table.slice(0, range).map((player) => player.grade)
    const 내최소칸 = myGrades.indexOf(Math.min(...myGrades))
    const opponentTable = tab === TRADE_REQUEST_TAB.투수 ? teamPitchers(상대팀) : teamBatters(상대팀)
    const 상대칸 = opponentTable
      .slice(0, range)
      .findIndex((player) => player.grade > myGrades[내최소칸])
    return { 내최소칸, 상대칸, draws: [
      [0, 0, 10000], [상대팀, 0, 10], [tab, 0, 2], [상대칸, 0, range],
      ...Array.from({ length: tries }, () => [내최소칸, 0, range] as const),
    ] as const }
  }

  it('타자 탭은 13번 뽑고 끝 — 횟수는 그래도 +1', () => {
    const { 상대칸, draws } = 실패굴림(TRADE_REQUEST_TAB.타자, 12, 13)
    expect(상대칸).toBeGreaterThanOrEqual(0)
    const random = 차례난수(draws)

    const { request, record } = rollTradeRequest(random, 레코드(), 명단())

    expect(request.isRequested).toBe(false)
    expect(request.opponentTeamId).toBe(상대팀)
    expect(record.tradeRequestCount).toBe(1)
    expect(random.used()).toBe(4 + 13)
  })

  it('투수 탭은 9번 뽑고 끝', () => {
    const { 상대칸, draws } = 실패굴림(TRADE_REQUEST_TAB.투수, 8, 9)
    expect(상대칸).toBeGreaterThanOrEqual(0)
    const random = 차례난수(draws)

    const { request } = rollTradeRequest(random, 레코드(), 명단())

    expect(request.isRequested).toBe(false)
    expect(random.used()).toBe(4 + 9)
  })
})

describe('+0x1b 읽기', () => {
  it('명단은 id 로 그 선수의 표 팀을 읽고, 표 밖(나리·명전 id)은 0 이다', () => {
    const roster = 명단()
    expect(playerGradeOf(MY_TEAM, TRADE_REQUEST_TAB.투수, roster.pitchers[2])).toBe(teamPitchers(MY_TEAM)[2].grade)
    expect(playerGradeOf(MY_TEAM, TRADE_REQUEST_TAB.타자, { ...roster.batters[0], id: 0xfe })).toBe(0)
  })

  it('트레이드로 옮겨 온 선수는 옛 팀 표의 값이다 (레코드째 옮겨 +0x1b 가 따라간다)', () => {
    const 옮겨옴 = { id: 3, kindByte: 3, fieldPosition: 0, stamina: 0, tableTeamId: 7 }
    expect(playerGradeOf(MY_TEAM, TRADE_REQUEST_TAB.타자, 옮겨옴)).toBe(teamBatters(7)[3]!.grade)
  })
})

describe('상대 팀 레코드', () => {
  it('저장의 CPU 명단을 읽는다 — 거기 간 내 옛 선수의 +0x1b 로 견준다', () => {
    const 상대팀 = 3
    // 상대 0번 타자 자리에 0팀 표에서 가장 값이 큰 선수가 가 있다
    const 큰선수칸 = teamBatters(MY_TEAM).reduce((best, player, index, all) =>
      (player.grade > all[best]!.grade ? index : best), 0)
    const 상대명단 = tableRosterOf(상대팀)
    const 바뀐상대 = {
      ...상대명단,
      batters: 상대명단.batters.map((player, index) =>
        (index === 0 ? { ...player, id: 큰선수칸, tableTeamId: MY_TEAM } : player)),
    }
    const 내값들 = teamBatters(MY_TEAM).map((player) => player.grade)
    const 넘는칸 = 내값들.findIndex((grade) => grade >= 내값들[큰선수칸]!)
    const random = 차례난수([[0, 0, 10000], [상대팀, 0, 10], [TRADE_REQUEST_TAB.타자, 0, 2], [0, 0, 12], [넘는칸, 0, 12]])

    const { request } = rollTradeRequest(random, 레코드(), 명단(), (team) => (team === 상대팀 ? 바뀐상대 : tableRosterOf(team)))

    expect(request).toMatchObject({ isRequested: true, myIndex: 넘는칸, opponentIndex: 0 })
  })
})

/**
 * U-105 r154 — 0xf1 은 경기 끝 뒤라 그날 넣은 마선수가 열 팀 레코드에 남아 있다(빼는 0xb512c 는 0xdf · 0xe5 진입만).
 * 0xb5695 가 보는 타자 배열은 [0..8, 마타자, 10, 11, 옛 9] — 뽑기 0..11 의 9번이 마타자다.
 */
describe('레코드에 남은 마선수 (0xb53f0 0x40 · 0xb521c 0x60 갈래)', () => {
  it('타자는 9번에 앉고 옛 9번은 맨 끝 · 투수는 8번 뒤에 붙는다', () => {
    const roster = 명단()
    const batters = tradeRecordRowsOf(roster, TRADE_REQUEST_TAB.타자, { pitcher: 1, batter: 3 })
    const pitchers = tradeRecordRowsOf(roster, TRADE_REQUEST_TAB.투수, { pitcher: 1, batter: 3 })

    expect(batters).toHaveLength(13)
    expect(batters[9]).toEqual({ kind: '마선수', aceIndex: 3 })
    expect(batters[12]).toEqual({ kind: '선수', player: roster.batters[9] })
    expect(batters[10]).toEqual({ kind: '선수', player: roster.batters[10] })
    expect(pitchers).toHaveLength(9)
    expect(pitchers[8]).toEqual({ kind: '마선수', aceIndex: 1 })
  })

  it('마타자 +0x1b 는 XlsACE_BAT_DATA 행 바이트 27 — 20 · 30 · 40 · 50 · 40', () => {
    expect(ACE_BATTER_RECORD_GRADES).toEqual([20, 30, 40, 50, 40])
  })

  it('상대 9번을 뽑으면 마타자(크라이져 50)와 견준다 — 표 9번(7)이면 섰을 내 칸이 모자라 더 뽑는다', () => {
    const 상대팀 = 3
    const draws = [
      [0, 0, 10000], [상대팀, 0, 10], [TRADE_REQUEST_TAB.타자, 0, 2], [9, 0, 12],
      [1, 0, 12], // 내 1번 +0x1b 10 — 표 9번 7 은 넘고 크라이져 50 은 못 넘는다
      [3, 0, 12], // 내 3번 50 — 넘는다
    ] as const
    // 시험 전제: 표 값
    expect(teamBatters(상대팀)[9]!.grade).toBe(7)
    expect(teamBatters(MY_TEAM)[1]!.grade).toBe(10)
    expect(teamBatters(MY_TEAM)[3]!.grade).toBe(50)

    const 마선수없음 = 차례난수(draws)
    expect(rollTradeRequest(마선수없음, 레코드(), 명단()).request.myIndex).toBe(1)
    expect(마선수없음.used()).toBe(5)

    const random = 차례난수(draws)
    const { request } = rollTradeRequest(random, 레코드(), 명단(), tableRosterOf,
      (team) => (team === 상대팀 ? { pitcher: 0, batter: 3 } : undefined))

    expect(request).toMatchObject({ isRequested: true, myIndex: 3, opponentIndex: 9, tab: TRADE_REQUEST_TAB.타자 })
    expect(random.used()).toBe(6)
  })

  it('내 9번을 뽑으면 내 마타자 — 표 9번(6)으로는 못 넘던 상대 0번(25)을 넘는다', () => {
    const 상대팀 = 3
    expect(teamBatters(상대팀)[0]!.grade).toBe(25)
    expect(teamBatters(MY_TEAM)[9]!.grade).toBe(6)
    const random = 차례난수([[0, 0, 10000], [상대팀, 0, 10], [TRADE_REQUEST_TAB.타자, 0, 2], [0, 0, 12], [9, 0, 12]])

    const { request } = rollTradeRequest(random, 레코드(), 명단(), tableRosterOf,
      (team) => (team === MY_TEAM ? { pitcher: 2, batter: 3 } : undefined))

    expect(request).toMatchObject({ isRequested: true, myIndex: 9, opponentIndex: 0 })
    expect(random.used()).toBe(5)
  })
})
