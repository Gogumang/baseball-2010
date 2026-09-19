import { advancePostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * CPU 끼리의 포스트시즌 진행 (binary.mod 0xc2760 한 경기 · 0x13da0 자동 소화 루프).
 *
 * 원본은 내 팀 차례가 올 때까지 CPU 시리즈를 알아서 끝낸다:
 *   - `playCpuSeriesGame`(0xc2760) 이 한 경기를 연출 없이 돌리고 승패를 기록한 뒤 날짜를 넘긴다
 *   - `autoRunCpuPostseason`(0x13da0) 이 그 시리즈가 끝날 때까지, 그리고 내 차례가 나올 때까지 반복한다
 * 경기 자체는 정규시즌과 같은 타석 엔진을 쓴다 — 포스트시즌 전용 계산은 없다.
 */
/** 한 시리즈는 최대 7경기다. 대진이 셋이라 넉넉히 잡은 안전망 (원본에는 없다) */
const MAXIMUM_GAMES = 40

/** 시리즈 한 경기를 CPU 끼리 치르고 결과를 반영한다 (0xc2760) */
export function playCpuSeriesGame(series: PostseasonSeries, random: RandomPort): PostseasonSeries {
  if (series.round === '종료') return series
  // 윗 시드가 홈이다 — 0xb7844 는 포스트시즌에서 series[s][1](올라온 아랫 시드)을 슬롯 1 로 둔다
  const score = simulateLeagueGame({ away: series.teams[1], home: series.teams[0] }, random)
  const winner = score.awayRuns > score.homeRuns ? series.teams[1] : series.teams[0]
  return advancePostseason(series, winner)
}

/**
 * 내 팀 차례가 나오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0).
 * 내 팀이 이미 지금 시리즈에 있으면 아무것도 하지 않는다.
 */
export function runCpuPostseason(
  series: PostseasonSeries,
  myTeamId: number,
  random: RandomPort,
): PostseasonSeries {
  let current = series
  for (let game = 0; game < MAXIMUM_GAMES; game += 1) {
    if (current.round === '종료' || isMyTurn(current, myTeamId)) return current
    current = playCpuSeriesGame(current, random)
  }
  return current
}
