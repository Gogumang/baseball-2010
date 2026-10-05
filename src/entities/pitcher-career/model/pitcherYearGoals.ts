import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { PITCHER_YEAR_GOALS } from '@/shared/config/original/yearGoals'

/**
 * 나만의리그 **투수편**(모드 3) 올해의 목표 — 판정 `0xa3de8(career, 단계)` 의 투수 갈래.
 *
 * 원본은 타자·투수가 한 함수다. `career[0]`(모드 칸, s8)이 4 가 아니면 투수 갈래로 간다:
 * ```
 *   0xa3e56~0xa3e88  목표[i] = u16 0xd7e9a[연차idx·5 + i]  (+0x82 바이트 = 마무리 표, 0xb6ded == 2)
 *   0xa3e8a          단계 1 → 목표[1..4] >>= 1                       (0xa3e96~0xa3eae, 목표[0] 은 그대로)
 *                    단계 2 → i ≤ 1 이고 모드 3 이면 g − trunc(g·10/100), 그 밖은 g + trunc(g·10/100)
 *                    (0xa3eb2~0xa3efc) — 투수는 방어율·실점 두 칸만 **낮추고** 나머지 셋은 올린다
 *   0xa3f46~0xa3fb4  비교 (r7 = 투수 레코드 0x1fbd1)
 *     ① 방어율 0xb6ce9(r7) ≤ g0           (`bgt` 건너뜀 → 같아도 달성)
 *     ② 실점 s16 +0x22 ≤ g1
 *     ③ 승 s8 +0x2e ≥ g2 — 보직이 2(마무리)면 **세이브 s16 +0x24 + 승** ≥ g2
 *     ④ 탈삼진 s16 +0x26 ≥ g3
 *     ⑤ 인기도 0xb6e79 − career+0x78(시즌 시작 인기도) ≥ g4
 * ```
 * 단계 0(연말 392)·3(국가대표 0x1a090)은 switch 에 없어 표 그대로다.
 *
 * ⚠️ **원본 그대로**: 방어율 함수 0xb6ce8 은 아웃·실점이 모두 0 이면 0 을 돌려준다 —
 *    한 번도 던지지 않은 투수도 ①은 달성이다.
 */

/** 0 연말(392) · 1 중간평가 · 2 MVP 판정(0x8de84) · 3 국가대표(0x1a090) — `0xa3de8` 둘째 인자 */
export type PitcherGoalStage = '연말' | '중간' | 'MVP' | '국가대표'

const MVP_GOAL_PERCENT = 10
/** 단계 2 에서 **낮추는** 칸 수 — i ≤ 1 (방어율·실점) */
const LOWERED_GOAL_COUNT = 2

/** 표 고르기 — 보직 0xb6ded 가 2(마무리)면 둘째 표 (+0x82 바이트) */
export function pitcherYearGoalTableOf(career: PitcherCareer): readonly (readonly number[])[] {
  return PITCHER_YEAR_GOALS[career.role === PITCHER_ROLE.relief ? 1 : 0]
}

/**
 * 단계를 반영한 목표 다섯 칸 `[방어율×100, 실점, 승(마무리 세이브+승), 탈삼진, 인기도 상승]`.
 * 연차idx = career+0xb3 = 연차 − 1. 원본은 범위를 보지 않지만 연차는 13년차(504 은퇴식)에서 끝나므로
 * 표 밖으로 나갈 일이 없다 — 웹은 타자편 `yearGoalsOf` 처럼 마지막 줄로 붙잡아 둔다.
 */
export function pitcherYearGoalsOf(career: PitcherCareer, stage: PitcherGoalStage = '연말'): readonly number[] {
  const table = pitcherYearGoalTableOf(career)
  const goals = table[Math.max(1, Math.min(career.season, table.length)) - 1]
  if (stage === '중간') return goals.map((goal, index) => (index === 0 ? goal : goal >> 1))
  if (stage === 'MVP') {
    return goals.map((goal, index) => {
      const step = Math.trunc((goal * MVP_GOAL_PERCENT) / 100)
      return index < LOWERED_GOAL_COUNT ? goal - step : goal + step
    })
  }
  return goals
}

/** 목표 달성 수 0~5 (0xa3de8 의 돌려주는 값) */
export function achievedPitcherGoalCount(career: PitcherCareer, stage: PitcherGoalStage = '연말'): number {
  const [earnedRunAverage, runsAllowed, wins, strikeouts, popularityGain] = pitcherYearGoalsOf(career, stage)
  const { stats } = career
  const winCount = career.role === PITCHER_ROLE.relief ? stats.saves + stats.wins : stats.wins
  const checks = [
    seasonEarnedRunAverageOf(stats) <= earnedRunAverage,
    stats.runsAllowed <= runsAllowed,
    winCount >= wins,
    stats.strikeouts >= strikeouts,
    career.popularity - career.popularityAtSeasonStart >= popularityGain,
  ]
  return checks.filter(Boolean).length
}
