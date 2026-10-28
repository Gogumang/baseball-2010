import type { SeasonState, SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { type League, type PostseasonSeries, rankingOf, withSemiPlayoffWinner } from '@/entities/league/model/league'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  type LeaguePlayerStats,
  EMPTY_LEAGUE_BATTER_LINE,
  leagueRecordBatterLineOf,
  leagueBatterLineOf,
  leagueBatterIdOf,
  leaguePitcherLineOf,
  leaguePitcherIdOf,
  leagueRecordPitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import { type SeasonEntryRecordSource, type SeasonRecordAces, seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import {
  goalRankOf,
  type SeasonGoalInput,
  teamBattingAverageOf,
  teamEarnedRunAverageOf,
  goalPitcherLinesWithAce,
  type SeasonGoalWindowNumbers,
  seasonGoalWindowNumbersOf,
  seasonGoalWindowRankOf,
  type GoalPostseasonBracket,
} from '@/entities/season-mode/model/seasonGoals'
import { entryBattersOfOrder, NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'

/** 목표 판정의 재료가 사는 곳 — 세션 저장의 여러 칸 */
export interface SeasonGoalSource {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
  readonly playerStats: LeaguePlayerStats
  readonly series: PostseasonSeries | null
  /** 영입한 명전 선수의 기록 — 경기 명단(`entryOrderOf`)과 같은 칸을 보려고 같은 것을 넘긴다 */
  readonly recordOf?: SeasonEntryRecordSource
  /** 내 팀 레코드에 남은 마선수 (`SeasonSave.recordAces[내 팀]`) — 목표 ④ 가 마투수 줄까지 센다 (`goalPitcherLinesWithAce`) */
  readonly recordAces?: SeasonRecordAces | undefined
}

/**
 * `0xb7aa0(L, 팀, 0)` — 그 팀의 지금 순위(0부터). 포스트시즌 중이면 대진 칸 순위(`goalRankOf`), 아니면 정규시즌 순위.
 * 목표 ① · 구단정보 0xd5 줄 6 · 이름 입력 0xc8 줄 6(SR[1] = 고른 팀, b9ee) 이 같은 함수다
 */
export function seasonTeamRankOf(source: Pick<SeasonGoalSource, 'state' | 'league' | 'series'>, team: number): number {
  const regularRank = Math.max(0, rankingOf(source.league).indexOf(team))
  return goalRankOf(team, regularRank, source.state.record.inPostseason ? goalBracketOf(source.series) : null)
}

/**
 * 시즌 목표 판정 `0xa37bc` 의 입력 다섯 칸 (P4 2b · 직접 떴다):
 * ```
 * ① 0xb7aa0(L, 팀, 0)      — 포스트시즌 중이면 대진 칸 순위(`goalRankOf`), 아니면 정규시즌 순위
 * ② 0xb7908 / (0xb7908 + 0xb7968) × 100
 * ③ 0xa3700(SR, 1)         — 팀 레코드 타자 0~8번 타율 평균
 * ④ 0xa3764(SR)            — 팀 레코드 투수 전원 방어율 평균
 * ⑤ 인기도 − SR+0x78
 * ```
 * ③④ 의 선수 줄은 리그 선수 기록표(`playerStats`)에서 **경기가 쌓을 때와 같은 열쇠**로 찾는다 —
 * 타자는 저장 명단 차례를 `entryBattersOfOrder` 로 붙박이 표 칸에 맞춘 `팀 × 12 + 칸`, 투수는 `팀 × 8 + 칸`.
 *
 * 사람 경기의 투수 줄도 쌓인다 — 팀 경기 요약 `leaguePitchers`(양 팀 표 칸 줄 + 경기 끝 판정)를 정규시즌 정산이
 * `recordSeasonHumanGamePitchers` 로 넣는다(원본 0xa8024 · 0xa7de8, 0xa56dc 모드 2 갈래라 정규시즌만). 그래서 ④ 는 내 팀 투수가
 * 실점하면 0 보다 커진다.
 *
 * 선수 줄 열쇠:
 * - 트레이드로 옮겨 온 선수는 옛 팀 표 자리(`tableTeamId` · id), 영입한 명전·나리 선수(id ≥ 0xb4 · 0xfe)는 원본 id 의
 *   표 밖 줄(`recordBatters`·`recordPitchers` — 0xa56dc 모드 2 갈래가 마선수만 거른다)로 쌓였다 — 같은 열쇠로 읽는다.
 *   기록을 못 찾은 표 밖 선수(`recordOf` 를 안 넘긴 길 — 앱 길에서는 닿지 않는다, `tableSlotsOfOrder` 주석)는 경기가 남은 표
 *   칸으로 세우고 그 칸으로 쌓으므로 여기도 같은 칸을 읽는다.
 * - 대진 칸의 플레이오프 아랫 시드(L+0x3b 준PO 승자)는 시리즈의 `semiPlayoffWinner` 가 포스트시즌 끝까지 든다(옛 저장은
 *   `withSemiPlayoffWinner` 가 이사) — `goalBracketOf` 가 읽는다.
 */
export function seasonGoalInputOf(source: SeasonGoalSource): SeasonGoalInput {
  const { record } = source.state
  const team = record.teamId
  const order = seasonEntryOrderOf(source.roster, source.recordOf)
  // 기록을 실은 칸(영입한 명전·나리 선수)은 그 레코드에 쌓인 표 밖 줄(원본 id)로 센다 — 기록을 못 찾은 칸은 빈 줄
  const batterLines = entryBattersOfOrder(team, order).map((batter) => {
    if (batter.rosterSlot === NO_ROSTER_SLOT) {
      return batter.recordId === undefined ? EMPTY_LEAGUE_BATTER_LINE : leagueRecordBatterLineOf(source.playerStats, batter.recordId)
    }
    // 트레이드로 옮겨 온 선수는 옛 팀 표 자리(원본 id)로 쌓였다 — 같은 열쇠로 읽는다
    return leagueBatterLineOf(source.playerStats, leagueBatterIdOf(batter.tableTeamId ?? team, batter.rosterSlot))
  })
  const pitcherLines = order.pitchers.map((slot) => {
    if (typeof slot === 'number') {
      return slot >= 0 ? leaguePitcherLineOf(source.playerStats, leaguePitcherIdOf(team, slot)) : { outs: 0, runsAllowed: 0 }
    }
    if ('tableSlot' in slot) return leaguePitcherLineOf(source.playerStats, leaguePitcherIdOf(slot.tableTeamId ?? team, slot.tableSlot))
    return slot.recordId === undefined ? { outs: 0, runsAllowed: 0 } : leagueRecordPitcherLineOf(source.playerStats, slot.recordId)
  })
  return {
    rank: seasonTeamRankOf(source, team),
    wins: source.league.wins[team] ?? 0,
    losses: source.league.losses[team] ?? 0,
    teamBattingAverage: teamBattingAverageOf(batterLines),
    // 0xa3764 는 마선수를 거르지 않는다 — 0xdf · 0xe5 전이면 레코드 8번 마투수 줄이 하나 더 든다 (U-105 r163)
    teamEarnedRunAverage: teamEarnedRunAverageOf(goalPitcherLinesWithAce(pitcherLines, source.recordAces?.pitcher)),
    popularityGain: record.popularity - record.popularityAtSeasonStart,
  }
}

/**
 * 올해의 목표 창(SYS sub 1) 시즌모드 갈래의 숫자 — ②~⑤ 는 판정 입력(`seasonGoalInputOf`)과 같고 ① 만 정규시즌 순위다
 * (`seasonGoalWindowRankOf` — 0xb7aa0 셋째 인자 1).
 */
export function seasonGoalWindowNumbersFor(source: SeasonGoalSource): SeasonGoalWindowNumbers {
  const { record } = source.state
  const regularRank = Math.max(0, rankingOf(source.league).indexOf(record.teamId))
  return seasonGoalWindowNumbersOf(
    record.yearIndex,
    seasonGoalInputOf(source),
    seasonGoalWindowRankOf(regularRank, record.games, record.inPostseason),
  )
}

/**
 * 결산 0xef 의 한국시리즈 보상이 보는 **포스트시즌 순위** — 갱신 0x85ec(8622~8636)가 부르는 `0xb7aa0(L, SR[1], 0)`
 * (b7aa0~b7b2a 직접 떴다 — 목표 ① 과 같은 함수 · 같은 셋째 인자):
 * ```
 * (L+0x34 포스트시즌 ≠ 0 || L+0x36 끝남 ≠ 0) && 셋째 == 0:
 *     L+0x37(우승팀) == 팀 → 0
 *     i = 0..2: L[0x38+2i+1] == 팀 || L[0x38+2i] == 팀 → i + 1     ; 0 한국시리즈 · 1 플레이오프 · 2 준플레이오프 칸
 *     → 10
 * 그 밖: 0xb79d8 정렬표에서 팀의 자리(0부터), 없으면 −1
 * ```
 * 0x85ec 는 0 이면 우승 [197], 1 이면 준우승 [198], 그 밖은 보상 없이 0x87b4 다. 결과 키 0x9dc8 이 SR+0xb6(= L+0x36) ≠ 0
 * 일 때만 이 사슬을 열므로 늘 대진 갈래다 — 우승팀 0, 한국시리즈에서 진 팀(칸 0 의 둘 중 남은 하나) 1,
 * 플레이오프에서 진 팀 2, 준플레이오프에서 진 팀 3, 못 든 팀 10.
 */
export function seasonPostseasonRankOf(
  record: Pick<SeasonRecord, 'teamId' | 'inPostseason'>,
  league: League,
  series: PostseasonSeries | null,
): number {
  const regularRank = rankingOf(league).indexOf(record.teamId)
  const isBracket = record.inPostseason || series?.round === '종료'
  return goalRankOf(record.teamId, regularRank, isBracket ? goalBracketOf(series) : null)
}

/**
 * 웹 시리즈 객체 → 원본 대진 칸 `L+0x38 + 2i` (0xb80a8: 1위·미정 · 2위·미정 · 3위·4위, 이긴 팀은 다음 라운드 칸 1).
 * 시리즈가 없으면 대진 칸이 빈 것과 같다.
 */
function goalBracketOf(series: PostseasonSeries | null): GoalPostseasonBracket {
  if (series === null) return { champion: null, pairs: [] }
  const [first, second, third, fourth] = series.qualifiers
  const inKoreanSeries = series.round === '한국시리즈' || series.round === '종료'
  // 플레이오프 칸 1(L+0x3b) = 준PO 승자 — 준PO 가 끝나면 0xb7724 가 넣고 포스트시즌 끝까지 남는다(`semiPlayoffWinner`).
  // 옛 저장은 불러올 때 `withSemiPlayoffWinner` 가 채운다 — 그래도 모르면(로테이션 칸도 없는 저장) 빈 칸이다
  const playoffLower = series.round === '준플레이오프' ? null : (withSemiPlayoffWinner(series).semiPlayoffWinner ?? null)
  return {
    champion: series.champion,
    pairs: [
      [first ?? null, inKoreanSeries ? series.teams[1] : null],
      [second ?? null, playoffLower],
      [third ?? null, fourth ?? null],
    ],
  }
}
