import { EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import type { PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/** 연도별 기록 칸 (0x1fa78) — 옛 저장은 `migratePitcherYearlyStats` 가 채운다(이사를 안 거친 값은 빈 목록) */
export function pitcherYearlyStatsOf(career: Pick<PitcherCareer, 'yearlyStats'>): readonly PitcherSeasonStats[] {
  return career.yearlyStats ?? []
}

/** 시즌 줄 숫자 칸 — 통산 − 이번 해로 지난 해들의 합을 낼 때 쓴다 */
const PITCHER_STAT_KEYS = ['games', 'outs', 'runsAllowed', 'saves', 'strikeouts', 'pitches', 'wins', 'losses'] as const

/**
 * **옛 저장 이사 — 지난 해 연도별 칸(0x1fa78) 메우기.** 원본은 새 시즌 0x1b768 이 해마다 내 레코드를 칸 S[0xb3] − 1 에 베껴
 * 연차 s 의 저장에는 늘 s − 1 칸이 있다. 웹이 이 칸(`yearlyStats`)을 남기기 전 저장은 모자라고, 그 뒤 해가 바뀌면 새 칸이 **뒤에**
 * 붙어 칸 i 가 i 번째 해를 가리키지 않는다. 그래서 모자란 칸을 **앞에** 채운다:
 * - 지난 해들의 합 = 통산(`careerStats`) − 이번 해(`stats`) − 남은 칸들. 모자란 칸이 하나면 그 칸이 곧 그 합이다(정확히 되살린다).
 * - 둘 이상이면 해마다 나눈 값이 남아 있지 않다 — 합을 모자란 칸 중 **마지막**(가장 최근 해)에 두고 앞 칸은 0 이다.
 *   통산을 읽는 조건(투수 통산 0x9da28 — 지난 해 + 이번 해의 합)은 이사 앞뒤가 같다. 해마다 읽는 조건(투지 · 의욕 상실 —
 *   `pitcherStoryScene`)은 앞 칸이 0 으로 읽힌다(예전 웹도 없는 해를 0 으로 읽었다).
 * 사사구(+0x2a)는 통산 칸이 0~9999 로 잘려 빼기가 맞지 않아 0 으로 둔다. 칸이 모자라지 않으면 같은 객체
 */
export function migratePitcherYearlyStats<T extends Pick<PitcherCareer, 'season' | 'stats' | 'careerStats' | 'yearlyStats'>>(career: T): T {
  const years = pitcherYearlyStatsOf(career)
  const missing = career.season - 1 - years.length
  if (missing <= 0) return career
  const earlier = { ...EMPTY_PITCHER_SEASON_STATS } as Record<(typeof PITCHER_STAT_KEYS)[number], number>
  for (const key of PITCHER_STAT_KEYS) {
    const known = years.reduce((total, row) => total + row[key], 0)
    earlier[key] = Math.max(0, career.careerStats[key] - career.stats[key] - known)
  }
  const filler: PitcherSeasonStats[] = Array.from({ length: missing }, (_unused, index) =>
    index === missing - 1 ? { ...EMPTY_PITCHER_SEASON_STATS, ...earlier } : EMPTY_PITCHER_SEASON_STATS,
  )
  return { ...career, yearlyStats: [...filler, ...years] }
}
