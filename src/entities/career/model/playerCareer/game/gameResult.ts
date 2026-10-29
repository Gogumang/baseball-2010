import type { GameSummary } from '@/entities/game/model/gameSummary'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { advancePostseason, recordLeagueResult } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import {
  recordLeagueErrors,
  recordLeagueFreePasses,
  recordLeaguePlateAppearances,
  recordLeagueStolenBases,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import { recordHumanGamePitchers, staminaTableAfterHumanGame } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { mergeStats, recordGamePlayed, withoutRecordLine } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import { MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer/constants'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/** 경기 결과를 커리어에 반영한다. G포인트 지급과 체력 회복이 함께 일어난다. */
export function applyGameResult(career: PlayerCareer, summary: GameSummary): PlayerCareer {
  // 레코드 +0x20~+0x2c(타수 · 안타 · 2루타 · 3루타 · 홈런 · 타점 · 도루)는 정산 0xa8024 의 타자 게이트 0xa56dc 가 참일 때만 오르고,
  // 모드 4 갈래 0xa571c 는 포스트시즌(시즌 객체 +0xb4)이면 거짓이다 — 포스트시즌 경기는 내 타격 줄을 시즌 · 통산에 안 쌓는다
  const regularSeason = career.postseason === null
  const playedStats = recordGamePlayed(regularSeason ? summary.stats : withoutRecordLine(summary.stats))
  const won = summary.result === '승'

  return {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint + gamePointRewardOf(summary)),
    gamesPlayed: career.gamesPlayed + 1,
    // 부상 중 치른 경기 수 (+0x1b6). 부상 기간은 경기로 줄지 않고 휴식·입원으로만 줄어든다 (G-2)
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    // 원본은 **경기마다** 행동 플래그를 지운다 (0x4f158, G-6 확정).
    // 투수편(`pitcherCareer.ts`)과 같은 기준이다 — 예전에는 2경기(관리 주기)마다 풀었다.
    hasActedThisCycle: false,
    bestHomeRunsInGame: Math.max(career.bestHomeRunsInGame, summary.stats.homeRuns),
    cycleHitGames: career.cycleHitGames + (isCycleHit(summary.stats) ? 1 : 0),
    eagleEyeGamesRemaining: Math.max(0, career.eagleEyeGamesRemaining - 1),
    stats: mergeStats(career.stats, playedStats),
    careerStats: mergeStats(career.careerStats, playedStats),
    leaguePlayerStats: leaguePlayerStatsAfterGame(career.leaguePlayerStats, summary, regularSeason),
    ...staminaTableAfterGame(career, summary),
    ...standingsAfterGame(career, summary, won),
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
  }
}

/**
 * 사람 경기도 원본은 **같은 기록 함수 0xa8024** 를 부른다 — 동료 여덟 타순과 상대 팀 타석이
 * CPU 끼리 경기와 한 표에 쌓인다 (B-2). 내 선수만 빠져 있는데, 내 성적은 `stats` 가 이미
 * 세고 있어 두 번 세지 않으려는 것이다 (순위표를 만들 때 `myLeagueRecordOf` 로 끼워 넣는다).
 * 미션·홈런더비처럼 리그 밖 경기는 이 칸을 주지 않으므로 그때는 표가 그대로다.
 * 투수 줄도 같은 정산 0xa8024 · 경기 끝 0xa7de8 이 쌓는다 — 정규시즌 경기만 (0xa56dc 의 포스트시즌 거짓)
 */
function leaguePlayerStatsAfterGame(stats: LeaguePlayerStats, summary: GameSummary, regularSeason: boolean): LeaguePlayerStats {
  // 동료 · 상대 타석의 레코드 줄도 같은 게이트(0xa56dc — 타자마다)라 포스트시즌이면 안 쌓인다
  const plateAppearances = regularSeason ? (summary.leaguePlateAppearances ?? []) : []
  // 도루 +0x2c 의 게이트 0xa56dc(c1a42)는 모드 4 포스트시즌이면 거짓 — 정규시즌 경기만
  const stolenBases = regularSeason ? (summary.leagueStolenBases ?? []) : []
  const gated = recordHumanGamePitchers(
    recordLeagueStolenBases(recordLeaguePlateAppearances(stats, plateAppearances), stolenBases),
    summary.leaguePitchers,
    regularSeason,
  )
  // 사사구 +0x2a — 정산 꼬리 a8b04~a8bee 는 게이트 0xa56dc 밖이라 포스트시즌에도 쌓인다.
  // 실책 +0x2e — 수비 그림 0x43278 은 게이트가 없다(포스트시즌에도)
  return recordLeagueErrors(recordLeagueFreePasses(gated, summary.leaguePitchers?.lines ?? []), summary.leagueErrors ?? [])
}

/** 두 팀 투수 레코드 +0x2c 는 경기 끝 값이 남는다 — 준비 0x1c46c 가 g == 0 이면 열 팀을 10000 으로 채운 뒤다 */
function staminaTableAfterGame(career: PlayerCareer, summary: GameSummary): { readonly leaguePitcherStaminas?: PitcherStaminaTable } {
  if (summary.pitcherStaminas === undefined) return {}
  return {
    leaguePitcherStaminas: staminaTableAfterHumanGame(career, leagueDayCounterOf(career), [
      { teamId: summary.ourTeamId, staminas: summary.pitcherStaminas.ours },
      { teamId: summary.opponentTeamId, staminas: summary.pitcherStaminas.opponent },
    ]),
  }
}

/**
 * 정산 0x4ea0c 모드 4 → 4f020 → 4f072: 측 1 점수 > 측 0 점수 ? 측 1 승 : 측 0 승 — 무승부 갈래가 없다.
 * 경기 끝 0xb68fc 가 동점이면 끝을 안 내 경기는 늘 갈리므로(웹 경기도 연장 상한이 없다 — `gameState`) 이긴 쪽 = 점수가 많은 쪽이다.
 * **포스트시즌 중에는 정규시즌 전적을 건드리지 않는다** — 0xb76dc 가 포스트시즌 플래그로 갈라져
 * 시리즈 승수만 깎는다(포스트시즌 분기). 그래서 45경기 뒤에 치른 경기가 순위표에 더 쌓이지 않는다.
 */
function standingsAfterGame(
  career: PlayerCareer,
  summary: GameSummary,
  won: boolean,
): { readonly league: League; readonly postseason: PostseasonSeries | null } {
  const winner = won ? summary.ourTeamId : summary.opponentTeamId
  if (career.postseason !== null) return { league: career.league, postseason: advancePostseason(career.postseason, winner) }
  const loser = won ? summary.opponentTeamId : summary.ourTeamId
  return { league: recordLeagueResult(career.league, winner, loser), postseason: career.postseason }
}

/** 경기 끝 G포인트 = 달성 기록 금액 합 (0x4ea0c, 누락 탐색 9차). 출전·승리 보너스는 원본에 없다 */
export function gamePointRewardOf(summary: GameSummary): number {
  return recordGamePointsOf(summary.recordIds)
}

/** 한 경기에 단타·2루타·3루타·홈런을 모두 쳤는가 */
function isCycleHit(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}
