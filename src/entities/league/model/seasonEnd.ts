import { rankingOf, startPostseason } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'

/**
 * 정규시즌 종료와 포스트시즌 개설 (binary.mod 0xb818c · 0xb80a8).
 *
 * 원본은 45경기째가 끝나면 이렇게 한다:
 *   1. 1위가 내 팀이면 세이브 레코드 `+0x7a`(정규시즌 1위 횟수)를 늘린다
 *   2. `setupPostseason`(0xb80a8) 으로 대진을 짜고 포스트시즌 플래그를 세운다
 *
 * 포스트시즌은 **1~4위**만 올라간다: 준PO 3위 vs 4위(5전3선승) → PO 2위 vs 준PO승자(5전3선승)
 * → 한국시리즈 1위 vs PO승자(7전4선승). 대진·승수는 `league.ts` 가 들고 있다.
 */
export interface SeasonEndResult {
  /** 이번 시즌 정규시즌 1위를 했는가 (레코드 +0x7a 를 늘릴지) */
  readonly isRegularSeasonFirst: boolean
  /** 정규시즌 순위 (1위부터 팀 번호) */
  readonly ranking: readonly number[]
  /** 첫 시리즈(준플레이오프) */
  readonly postseason: PostseasonSeries
}

export const POSTSEASON_RANK_LIMIT = 4

/**
 * 45경기가 끝난 시점의 정산.
 * 내 팀이 4위 안에 못 들어도 포스트시즌 자체는 열린다 — 원본은 진출 팀만으로 대진을 짜고
 * 내 팀이 없으면 CPU 끼리 끝까지 치른다 (0x13da0). 그래서 대진은 순위와 무관하게 만든다.
 */
export function finishRegularSeason(league: League, myTeamId: number): SeasonEndResult {
  const ranking = rankingOf(league)
  return {
    isRegularSeasonFirst: ranking[0] === myTeamId,
    ranking,
    postseason: startPostseason(ranking),
  }
}

/** 내 팀이 포스트시즌에 올라갔는가 (1~4위) */
export function isInPostseason(ranking: readonly number[], myTeamId: number): boolean {
  const rank = ranking.indexOf(myTeamId)
  return rank >= 0 && rank < POSTSEASON_RANK_LIMIT
}

/** 지금 시리즈에 내 팀이 나오는가 — 나오면 사람이 치르고, 아니면 CPU 끼리 돌린다 (0x13da0) */
export function isMyTurn(series: PostseasonSeries, myTeamId: number): boolean {
  return series.round !== '종료' && (series.teams[0] === myTeamId || series.teams[1] === myTeamId)
}
