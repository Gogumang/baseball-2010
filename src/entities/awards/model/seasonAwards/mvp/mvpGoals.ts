import { BATTING_AVERAGE_SCALE } from '@/entities/awards/model/leaderboard'
import { yearGoalsOf, type PlayerCareer } from '@/entities/awards/model/seasonAwards/otherSlices'

/**
 * 올해의 목표 달성 수 — **단계 2(MVP 판정용)** (0xa3de8, 인자 2).
 * 다섯 목표를 모두 `g + trunc(g × 10 / 100)` 으로 올려 잡고 연말과 같은 기준으로 센다.
 * (투수는 앞 둘 — 방어율·피안타 — 만 −10% 다. 웹에 투수 모드가 없어 타자 쪽만 옮긴다.)
 *
 * `seasonFlow.achievedGoalCount` 는 단계 0·1 만 알아서 여기에 단계 2 를 따로 둔다.
 */
const MVP_GOAL_RAISE_PERCENT = 10

export function achievedGoalCountForMvp(career: PlayerCareer): number {
  const [average, hits, homeRuns, runsBattedIn, popularityGain] = yearGoalsOf(career).map(
    (goal) => goal + Math.trunc((goal * MVP_GOAL_RAISE_PERCENT) / 100),
  )
  const { stats } = career
  const checks = [
    // 원본 타율 = min(1000, trunc(안타 × 1000 / 타수)) — 버림 (0xb8e3d)
    stats.atBats > 0 && Math.min(BATTING_AVERAGE_SCALE, Math.trunc((stats.hits * BATTING_AVERAGE_SCALE) / stats.atBats)) >= average,
    stats.hits >= hits,
    stats.homeRuns >= homeRuns,
    stats.runsBattedIn >= runsBattedIn,
    career.popularity - career.popularityAtSeasonStart >= popularityGain,
  ]
  return checks.filter(Boolean).length
}
