import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { judgeSeasonAwards, type SeasonAwards } from '@/entities/awards/model/seasonAwards/mvp/judgeAwards'
import type { PlayerCareer } from '@/entities/awards/model/seasonAwards/otherSlices'
import { careerLeagueRecordsOf } from '@/entities/awards/model/seasonAwards/records/leagueRecords'
import type { AwardRole } from '@/entities/awards/model/seasonAwards/titles/titleSpecs'

/** 올해 MVP 비트면 +2 */
export const MVP_SALARY_BONUS = 2
/** 타이틀 3개 + MVP 2 = 5 가 최대다 */
export const MAXIMUM_SALARY_RANK = 5

/**
 * 연봉협상 등급 k (0xa4d78, B-5 확정).
 *   타자: 홈런(9)·타점(11)·타율(12) 1위가 내 선수면 각 +1
 *   투수: 다승(1, 마무리면 세이브 3)·탈삼진(6)·방어율(4)
 *   그리고 **올해 MVP 비트면 +2**
 *
 * 이 k 가 `seasonFlow.salaryResultEventId` 의 구간으로 들어가 강경/정중 결과를 **결정적으로** 가른다:
 *   k=0 → 387/391 · k≤2 → 386/390 · k≤4 → 385/389 · k=5 → 384/388 (확률이 아니다).
 */
export function salaryRankOf(awards: SeasonAwards): number {
  return awards.wonCount + (awards.isMostValuablePlayer ? MVP_SALARY_BONUS : 0)
}

/**
 * `app/model/seasonEvents.ts` 가 쓰는 입구 — 커리어 하나로 등급 k 를 낸다.
 *
 * 둘째 인자를 안 주면 **커리어가 들고 있는 리그 선수 기록표**(`career.leaguePlayerStats`)로
 * 순위표를 만든다. 지어낸 성적이 아니라 CPU 경기(0xc2a48)와 사람 경기(0xae24c)가 실제로
 * 0xa8024 로 쌓아 온 표다 — 원본과 같은 재료다.
 */
export function salaryNegotiationRankOf(
  career: PlayerCareer,
  records: readonly LeagueRecord[] = careerLeagueRecordsOf(career),
  role: AwardRole = '타자',
): number {
  return salaryRankOf(judgeSeasonAwards(career, records, role))
}
