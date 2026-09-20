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

describe('국가대항전 선발 투수 0xb6c2d', () => {
  it('양 팀 모두 날짜 % 4 번째 투수다 — 정규 경기처럼 랜덤이 아니다', () => {
    const cup = createNationalCup()
    expect(nationalCupStartingPitcherIndex(cup)).toBe(0)
    expect(nationalCupStartingPitcherIndex({ ...cup, day: 3 })).toBe(3)
    expect(nationalCupStartingPitcherIndex({ ...cup, day: STARTING_PITCHER_CANDIDATES })).toBe(0)
  })
})

describe('CPU 끼리 한 경기 0xc2dac', () => {
  it('같은 씨앗이면 같은 경기가 나오고 승·패가 하나씩 정해진다', () => {
    const 첫번째 = playCpuNationalCupGame(12, 13, 씨앗난수(2010))
    const 두번째 = playCpuNationalCupGame(12, 13, 씨앗난수(2010))

    expect(첫번째).toEqual(두번째)
    expect([첫번째.winner, 첫번째.loser].sort()).toEqual([12, 13])
  })

  it('판정이 정상이다 — 칸 1(a) 이 더 내면 a 승이다 (0xc2a48 의 뒤집힘 버그 없음)', () => {
    // 같은 씨앗으로 여러 짝을 돌려, 점수가 많은 쪽이 늘 이기는지 본다
    for (let seed = 1; seed <= 12; seed += 1) {
      const 결과 = playCpuNationalCupGame(11, 12, 씨앗난수(seed))
      const 많은쪽 = 결과.firstSlotRuns > 결과.secondSlotRuns ? 11 : 12
      expect(결과.winner).toBe(많은쪽)
    }
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
  it('선발 투수 칸이 날짜를 따라 돈다', () => {
    let cup = createNationalCup()
    const 칸 = [nationalCupStartingPitcherIndex(cup)]
    for (let day = 0; day < 4; day += 1) {
      cup = endNationalCupDay(cup)
      칸.push(nationalCupStartingPitcherIndex(cup))
    }
    expect(칸).toEqual([0, 1, 2, 3, 0])
  })
})
