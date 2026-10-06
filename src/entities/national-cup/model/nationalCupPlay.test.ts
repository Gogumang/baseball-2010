import { describe, expect, it } from 'vitest'
import { STARTING_PITCHER_CANDIDATES } from '@/entities/team/model/teamRoster'
import {
  advanceNationalCupDay,
  nationalCupStartingPitcherIndex,
  playCpuNationalCupGame,
} from '@/entities/national-cup/model/nationalCupPlay'
import { createNationalCup, endNationalCupDay } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { simulateLeagueGame } from '@/entities/league/model/leagueDay'

function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return {
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    },
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

describe('국가대항전 CPU 경기 선발 — 같은 레코드를 같은 k 로 두 번 맞바꿔 제자리 (0xc2c4c c2d18~c2d40 · 0x1f570)', () => {
  it('양 팀 모두 상대국 슬롯의 0번 — 첫날은 마스터 0번, 그 뒤로는 그날 사람 경기 준비가 한 번 돌린 1번이다', () => {
    const cup = createNationalCup()
    expect(nationalCupStartingPitcherIndex(cup)).toBe(0)
    for (const day of [1, 2, 3, STARTING_PITCHER_CANDIDATES]) {
      expect(nationalCupStartingPitcherIndex({ ...cup, day })).toBe(1)
    }
  })
})

describe('CPU 끼리 한 경기 0xc2dac', () => {
  it('같은 씨앗이면 같은 경기가 나오고 승·패가 하나씩 정해진다', () => {
    const 첫번째 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(2010), 1)
    const 두번째 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(2010), 1)

    expect(첫번째).toEqual(두번째)
    expect([첫번째.winner, 첫번째.loser].sort()).toEqual([12, 13])
  })

  it('칸 1(a, 말 공격)이 더 내면 a 승, 아니면(동점 포함) b 승이다 (0xc2f12~0xc2f46)', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const 결과 = playCpuNationalCupGame(11, 12, 13, createSeededRandom(seed), 0)
      const 이긴쪽 = 결과.firstSlotRuns > 결과.secondSlotRuns ? 11 : 12
      expect(결과.winner).toBe(이긴쪽)
    }
  })

  it('두 나라 모두 그날 사람 경기 상대국의 선수로 선다 — a·b 와 상관없이 명단이 같다 (0x1f570 → base+0x934)', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const 짝1 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(seed), 1)
      const 짝2 = playCpuNationalCupGame(13, 12, 11, createSeededRandom(seed), 1)
      // 같은 경기가 나오고 칸만 바뀐다
      expect(짝2.firstSlotRuns).toBe(짝1.firstSlotRuns)
      expect(짝2.secondSlotRuns).toBe(짝1.secondSlotRuns)
      const 직접 = simulateLeagueGame({ away: 11, home: 11 }, createSeededRandom(seed), 1, undefined, { sharedRoster: true })
      expect([짝1.firstSlotRuns, 짝1.secondSlotRuns]).toEqual([직접.homeRuns, 직접.awayRuns])
    }
  })

  it('사람 경기가 깎아 둔 상대국 레코드 스태미나에서 선다 — 레코드 하나를 같이 쓴다 (base+0x934, 4d09e39)', () => {
    const 지친표 = [0, 0, 0, 0, 0, 0, 0, 0]
    let 달라짐 = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const 지침 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(seed), 1, 지친표)
      const 직접 = simulateLeagueGame({ away: 11, home: 11 }, createSeededRandom(seed), 1, { away: 지친표 }, { sharedRoster: true })
      expect([지침.firstSlotRuns, 지침.secondSlotRuns]).toEqual([직접.homeRuns, 직접.awayRuns])
      const 가득 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(seed), 1)
      if (가득.firstSlotRuns !== 지침.firstSlotRuns || 가득.secondSlotRuns !== 지침.secondSlotRuns) 달라짐 += 1
    }
    // 탈진(0)한 투수진은 결과를 바꾼다 — 값이 실제로 쓰인다
    expect(달라짐).toBeGreaterThan(0)
  })

  it('하루 넘기기도 상대국 끝 스태미나를 CPU 경기에 넘긴다', () => {
    const 표 = [0, 0, 0, 0, 0, 0, 0, 0]
    const 기대 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(77), 0, 표)
    const 하루뒤 = advanceNationalCupDay(createNationalCup(), 10, 11, createSeededRandom(77), 표)
    expect(하루뒤.wins[createNationalCup().teams.indexOf(기대.winner)]).toBe(1)
  })

  it('하루 넘기기의 CPU 경기는 nationalCupMatchupOf 의 상대를 명단으로 쓴다', () => {
    const cup = createNationalCup()
    // 첫날: 사람 10–11, CPU 12–13 → 명단은 11, 선발 0번
    const 기대 = playCpuNationalCupGame(12, 13, 11, createSeededRandom(77), 0)
    const 하루뒤 = advanceNationalCupDay(cup, 10, 11, createSeededRandom(77))
    expect(하루뒤.wins[cup.teams.indexOf(기대.winner)]).toBe(1)
    expect(하루뒤.losses[cup.teams.indexOf(기대.loser)]).toBe(1)
  })
})

describe('하루 넘기기 0x4ea0c → 0xb818c', () => {
  it('사람 경기와 CPU 경기가 함께 기록되어 하루에 두 경기가 쌓인다', () => {
    const 하루뒤 = advanceNationalCupDay(createNationalCup(), 10, 11, 씨앗난수(3))
    const 총승 = 하루뒤.wins.reduce((sum, wins) => sum + wins, 0)
    const 총패 = 하루뒤.losses.reduce((sum, losses) => sum + losses, 0)

    expect(총승).toBe(2)
    expect(총패).toBe(2)
    expect(하루뒤.wins[0]).toBe(1) // 대한민국 승
    expect(하루뒤.losses[1]).toBe(1) // 일본 패
    expect(하루뒤.stage).toBe(3)
  })

  it('결승 날에는 CPU 경기가 없어 한 경기만 쌓이고, 이긴 팀이 우승국이 된다', () => {
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [10, 13] }
    const 끝 = advanceNationalCupDay(결승, 10, 13, 씨앗난수(4))

    expect(끝.wins.reduce((sum, wins) => sum + wins, 0)).toBe(1)
    expect(끝.champion).toBe(10)
    expect(끝.stage).toBe(0)
  })

  it('풀리그 3일을 치르면 4국이 각각 3경기씩 하고 결승 두 팀이 정해진다', () => {
    let cup = createNationalCup()
    for (let day = 0; day < 3; day += 1) {
      cup = advanceNationalCupDay(cup, 10, cup.matches[day][1], 씨앗난수(day + 1))
    }

    expect(cup.stage).toBe(1)
    expect(cup.wins.map((wins, index) => wins + cup.losses[index])).toEqual([3, 3, 3, 3])
    // 대한민국은 3전 전승이라 무조건 1위다
    expect(cup.finalists[0]).toBe(10)
    expect(cup.finalists[1]).not.toBe(10)
  })
})

describe('날짜 칸은 하루 끝마다 는다', () => {
  it('CPU 경기 선발 칸은 날짜 % 4 를 따르지 않는다 — 상대국 슬롯이 매일 마스터에서 새로 덮인다', () => {
    let cup = createNationalCup()
    const 칸 = [nationalCupStartingPitcherIndex(cup)]
    for (let day = 0; day < 4; day += 1) {
      cup = endNationalCupDay(cup)
      칸.push(nationalCupStartingPitcherIndex(cup))
    }
    expect(칸).toEqual([0, 1, 1, 1, 1])
  })
})
