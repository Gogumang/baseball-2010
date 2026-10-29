import { advancePostseason, recordLeagueResult } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { clamp } from '@/entities/pitcher-career/model/pitcherCareer/bounds'
import { MAXIMUM_GAME_POINT } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import { mergeSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import type { PitcherSeasonDelta } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 경기 한 판의 결과 — `features/play-pitcher-game` 의 `PitcherGameSummary` 에서 뽑아 넘긴다.
 * (entities 는 features 를 모르는 층이라 필요한 칸만 받는 꼴로 둔다.)
 */
export interface PitcherGameOutcome {
  /** 경기 끝 0xb68fc 가 동점이면 끝을 안 내 '무' 는 오지 않는다 — 요약 꼴(`GameResult`)을 그대로 받는다 */
  readonly result: '승' | '패' | '무'
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** `summaryOf(progress).seasonDelta` 그대로 */
  readonly seasonDelta: PitcherSeasonDelta
  /** 경기 뒤 스태미나 (레코드 +0x2c) */
  readonly stamina: number
  /** 이 경기에 실제로 등판했는가 — 웹 전용 등판 경기 수(`PitcherSeasonStats.games`)만 센다 */
  readonly entered: boolean
  /** 경기 끝 G포인트 (기록 달성 합) */
  readonly gamePointReward: number
}

/**
 * 경기 결과를 커리어에 반영한다 (타자편 `applyGameResult` 자리).
 *
 * 스태미나는 경기가 남긴 값을 그대로 받고, **하루가 끝날 때** `0xb60e0` 회복이 더해진다
 * (모드 3 · 내 선수 · 선발 40% · 구원 80%, P1 3절).
 *
 * ⚠️ **원본 그대로**: 관리 주기의 행동 플래그는 **경기마다** 풀린다 (0x4f158, G-6 확정).
 * 타자편 웹 코드는 "2경기마다" 로 두었지만 원본 기준은 경기 한 번이다 — 여기서는 원본을 따른다.
 */
export function applyPitcherGameResult(career: PitcherCareer, outcome: PitcherGameOutcome): PitcherCareer {
  const recovered = recoverStaminaAfterGameDay(outcome.stamina, {
    mode: PITCHER_EDITION_MODE,
    isMine: true,
    isStarterRole: career.role === PITCHER_ROLE.starter,
  })
  const won = outcome.result === '승'
  return {
    ...career,
    gamesPlayed: career.gamesPlayed + 1,
    gamePoint: clamp(career.gamePoint + outcome.gamePointReward, 0, MAXIMUM_GAME_POINT),
    stamina: recovered,
    stats: mergeSeasonStats(career.stats, outcome.seasonDelta, outcome.entered),
    careerStats: mergeSeasonStats(career.careerStats, outcome.seasonDelta, outcome.entered),
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    hasActedThisCycle: false,
    ...standingsAfterGame(career, outcome, won),
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
  }
}

/**
 * 이긴 팀 · 진 팀을 리그 전적(정규시즌) 또는 시리즈(포스트시즌) 한쪽에만 적는다.
 * 정산 0x4ea0c 모드 3 → 4f020 → 4f072: 측 1 점수 > 측 0 점수 ? 측 1 승 : 측 0 승 — 무승부 갈래가 없다.
 * 경기 끝 0xb68fc 가 동점이면 끝을 안 내 경기는 늘 갈린다(웹 경기도 연장 상한이 없다 — `gameState`).
 */
function standingsAfterGame(
  career: PitcherCareer,
  outcome: PitcherGameOutcome,
  won: boolean,
): { readonly league: League; readonly postseason: PostseasonSeries | null } {
  const winner = won ? outcome.ourTeamId : outcome.opponentTeamId
  if (career.postseason !== null) return { league: career.league, postseason: advancePostseason(career.postseason, winner) }
  const loser = won ? outcome.opponentTeamId : outcome.ourTeamId
  return { league: recordLeagueResult(career.league, winner, loser), postseason: career.postseason }
}
