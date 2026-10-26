import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { playCpuSeriesGame } from '@/entities/league/model/postseasonPlay'
import { startPostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { rollCpuGamePrep, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 순위 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 같은 굴림으로 짠 한 경기의 명단별 득점 — 초(칸 0)는 윗 시드 teams[0] 의 명단, 말(칸 1)은 아랫 시드 teams[1] 의 명단 */
function 명단득점(series: PostseasonSeries, seed: number): { readonly upper: number; readonly lower: number } {
  const random = createSeededRandom(seed)
  rollSimulatorInit(random)
  const rolls = rollCpuGamePrep(random)
  const score = simulateLeagueGame({ away: series.teams[0], home: series.teams[1] }, random, 0, undefined, {
    aces: { away: rolls.teamA, home: rolls.teamB },
  })
  return { upper: score.awayRuns, lower: score.homeRuns }
}

const 이긴팀 = (before: PostseasonSeries, after: PostseasonSeries) =>
  (after.wins[0] > before.wins[0] ? before.teams[0] : before.teams[1])

describe('B-04 CPU 끼리 포스트시즌은 덜 낸 팀이 이김', () => {
  it('원본: 점수를 덜 낸 명단의 팀이 이긴다(동점은 윗 시드)', () => {
    const 시작 = startPostseason(순위)
    for (let seed = 1; seed <= 12; seed += 1) {
      const { upper, lower } = 명단득점(시작, seed)
      const 기대 = upper > lower ? 시작.teams[1] : 시작.teams[0]
      expect(이긴팀(시작, playCpuSeriesGame(시작, createSeededRandom(seed)))).toBe(기대)
    }
  })

  it('고침: 더 낸 명단의 팀이 이긴다(동점은 원본처럼 윗 시드) — 굴림은 원본과 같다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-04']))
    const 시작 = startPostseason(순위)
    let 갈린판 = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const { upper, lower } = 명단득점(시작, seed)
      const 기대 = lower > upper ? 시작.teams[1] : 시작.teams[0]
      if (upper !== lower) 갈린판 += 1
      expect(이긴팀(시작, playCpuSeriesGame(시작, createSeededRandom(seed)))).toBe(기대)
    }
    expect(갈린판).toBeGreaterThan(0)
  })
})
