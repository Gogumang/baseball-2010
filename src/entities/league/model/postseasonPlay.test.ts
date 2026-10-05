import { describe, expect, it } from 'vitest'
import {
  playCpuSeriesGame,
  playCpuSeriesGameWithStamina,
  runCpuPostseason,
  runCpuPostseasonWithStamina,
} from '@/entities/league/model/postseasonPlay'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { rollCpuGamePrep, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
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

const 순위 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('playCpuSeriesGame — 시리즈 한 경기 (0xc2760)', () => {
  it('한 경기를 치르면 어느 한쪽 승수가 하나 는다', () => {
    const 시작 = startPostseason(순위)
    const 뒤 = playCpuSeriesGame(시작, 씨앗난수(7))

    expect(뒤.wins[0] + 뒤.wins[1]).toBe(1)
  })

  it('끝난 시리즈에는 아무 일도 하지 않는다', () => {
    const 끝난것 = { ...startPostseason(순위), round: '종료' as const }

    expect(playCpuSeriesGame(끝난것, 씨앗난수(1))).toBe(끝난것)
  })
})

describe('runCpuPostseason — 내 차례까지 자동 소화 (0x13da0)', () => {
  it('내 팀이 준PO 에 있으면 한 경기도 돌리지 않는다', () => {
    const 시작 = startPostseason(순위)
    // 준PO 는 3위 vs 4위 = 팀 2·3
    expect(runCpuPostseason(시작, 2, 씨앗난수(9))).toBe(시작)
    expect(runCpuPostseason(시작, 3, 씨앗난수(9))).toBe(시작)
  })

  it('내 팀이 1위면 준PO·PO 가 끝나고 한국시리즈에서 멈춘다', () => {
    const 결과 = runCpuPostseason(startPostseason(순위), 0, 씨앗난수(2010))

    expect(결과.round).toBe('한국시리즈')
    expect(결과.teams[0]).toBe(0)
    expect(결과.wins).toEqual([0, 0])
  })

  it('내 팀이 진출하지 못했으면 우승이 정해질 때까지 돌린다', () => {
    const 결과 = runCpuPostseason(startPostseason(순위), 9, 씨앗난수(4242))

    expect(결과.round).toBe('종료')
    expect(결과.champion).not.toBeNull()
    // 우승팀은 진출한 네 팀 중 하나다
    expect([0, 1, 2, 3]).toContain(결과.champion)
  })

  it('같은 씨앗이면 같은 포스트시즌이 나온다', () => {
    expect(runCpuPostseason(startPostseason(순위), 9, 씨앗난수(77)))
      .toEqual(runCpuPostseason(startPostseason(순위), 9, 씨앗난수(77)))
  })
})

describe('스태미나 +0x2c 를 잇는다 (0xc2760 — 하루 끝 0xb818c 포스트시즌 갈래는 회복 없음)', () => {
  it('표를 안 넘기면 예전과 같은 경기가 나온다 (모두 10000)', () => {
    expect(playCpuSeriesGameWithStamina(startPostseason(순위), 씨앗난수(7)).series)
      .toEqual(playCpuSeriesGame(startPostseason(순위), 씨앗난수(7)))
    expect(runCpuPostseasonWithStamina(startPostseason(순위), 9, 씨앗난수(77)).series)
      .toEqual(runCpuPostseason(startPostseason(순위), 9, 씨앗난수(77)))
  })

  it('한 경기는 두 팀 표만 고치고 다른 팀 표는 그대로 둔다', () => {
    const 시작 = startPostseason(순위)
    const 남의표 = [1, 2, 3, 4, 5, 6, 7, 8]
    const 결과 = playCpuSeriesGameWithStamina(시작, 씨앗난수(7), { 9: 남의표 })
    expect(결과.pitcherStaminas[9]).toBe(남의표)
    expect(Object.keys(결과.pitcherStaminas).map(Number).sort()).toEqual([...시작.teams, 9].sort())
    const 깎임 = [...결과.pitcherStaminas[시작.teams[0]]!, ...결과.pitcherStaminas[시작.teams[1]]!]
    expect(깎임.some((value) => value < 10_000)).toBe(true)
  })

  it('넘긴 값으로 선다 — 깎인 표는 다음 경기로 이어지고 회복되지 않는다', () => {
    const 결과 = runCpuPostseasonWithStamina(startPostseason(순위), 9, 씨앗난수(4242))
    for (const staminas of Object.values(결과.pitcherStaminas)) {
      for (const value of staminas) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(10_000)
      }
    }
    const 낮은표 = Object.fromEntries(순위.map((team) => [team, Array.from({ length: 8 }, () => 500)]))
    const 지친쪽 = runCpuPostseasonWithStamina(startPostseason(순위), 9, 씨앗난수(4242), 낮은표)
    for (const staminas of Object.values(지친쪽.pitcherStaminas)) {
      for (const value of staminas) expect(value).toBeLessThanOrEqual(500)
    }
  })
})

describe('선발은 0xc239c 의 로테이션이다 — 시리즈 안 경기 수 g 로 돈다 (c24fc~c254e, rand(0,4) 없음)', () => {
  /** 난수를 몇 번 불렀는지 세는 감싸개 */
  function 세는난수(seed: number) {
    const 바탕 = createSeededRandom(seed)
    const 범위: Array<readonly [number, number]> = []
    const port: RandomPort = {
      next: () => 바탕.next(),
      nextInRange: (minimum, maximum) => {
        범위.push([minimum, maximum])
        return 바탕.nextInRange(minimum, maximum)
      },
      pick: (candidates) => 바탕.pick(candidates),
    }
    return { port, 범위 }
  }

  /** 원본 차례로 손으로 짠 한 경기 — 준비 굴림 다섯 → 초 공격 윗 시드 명단 → 덜 낸 명단의 팀 승 */
  function 기대승자(series: PostseasonSeries, seed: number, g: number): number {
    const random = createSeededRandom(seed)
    const rolls = rollCpuGamePrep(random)
    const 기대 = simulateLeagueGame({ away: series.teams[0], home: series.teams[1] }, random, g, undefined, {
      aces: { away: rolls.teamA, home: rolls.teamB },
    })
    return 기대.awayRuns > 기대.homeRuns ? series.teams[1] : series.teams[0]
  }

  it('양 팀 모두 rotationSlotOf(두 팀 승수 합) 칸이 선발이고 같은 난수로 같은 경기가 된다', () => {
    const 시작 = startPostseason(순위)
    // 1승 1패 뒤 셋째 경기 = g 2
    const 둘째뒤 = advancePostseason(advancePostseason(시작, 시작.teams[0]), 시작.teams[1])
    for (const [series, g] of [[시작, 0], [둘째뒤, 2]] as const) {
      for (const seed of [31, 32, 33]) {
        expect(playCpuSeriesGame(series, createSeededRandom(seed))).toEqual(
          advancePostseason(series, 기대승자(series, seed, g)),
        )
      }
    }
  })

  it('경기 준비 굴림은 구장 rand(0,4) · 마선수 rand(0,5) 넷뿐이다 — 선발 굴림이 없다', () => {
    const 시작 = startPostseason(순위)
    const 세기 = 세는난수(5)
    playCpuSeriesGame(시작, 세기.port)
    const 그대로 = 세는난수(5)
    const rolls = rollCpuGamePrep(그대로.port)
    simulateLeagueGame({ away: 시작.teams[0], home: 시작.teams[1] }, 그대로.port, 0, undefined, {
      aces: { away: rolls.teamA, home: rolls.teamB },
    })
    expect(세기.범위.slice(0, 5)).toEqual([[0, 4], [0, 5], [0, 5], [0, 5], [0, 5]])
    expect(세기.범위).toEqual(그대로.범위)
  })

  it('새 시리즈 g 는 0 부터지만 앞 시리즈에서 돈 칸이 이어진다 — 3경기 준PO 를 이긴 팀은 2칸 더 돈 채로 PO 에 선다', () => {
    const 시작 = startPostseason(순위)
    let series = 시작
    for (let game = 0; game < 3; game += 1) series = advancePostseason(series, 시작.teams[0])
    expect(series.round).toBe('플레이오프')
    // 윗 시드(2위, 기다린 팀) = 0번 · 올라온 팀 = (44 + 2) % 4 = 2번
    for (const seed of [8, 9, 10]) {
      const random = createSeededRandom(seed)
      const rolls = rollCpuGamePrep(random)
      const 기대 = simulateLeagueGame({ away: series.teams[0], home: series.teams[1] }, random, { away: 0, home: 2 }, undefined, {
        aces: { away: rolls.teamA, home: rolls.teamB },
      })
      const 승자 = 기대.awayRuns > 기대.homeRuns ? series.teams[1] : series.teams[0]
      expect(playCpuSeriesGame(series, createSeededRandom(seed))).toEqual(advancePostseason(series, 승자))
    }
  })
})
