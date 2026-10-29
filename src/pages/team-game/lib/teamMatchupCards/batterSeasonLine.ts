import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { EMPTY_LEAGUE_BATTER_LINE, leagueBatterIdOf, leagueBatterLineOf, leagueRecordBatterLineOf } from '@/entities/league/model/leaguePlayerStats'
import type { LeagueBatterLine, LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { BATTERS } from '@/shared/config/original/roster'
import { batterCardStatsOf, batterLineOfRecord, sumBatterLines } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { TeamMatchupRecords } from './matchupRecords'

/** 붙박이 표 칸 타자의 줄 — 기록표가 없으면(일반모드) Xls 행 줄 */
function tableBatterLineOf(stats: LeaguePlayerStats | undefined, id: number): MatchupBatterLine | null {
  if (stats !== undefined) return leagueBatterLineOf(stats, id)
  const row = BATTERS[id]
  return row === undefined ? null : batterLineOfRecord(row.recordLine)
}

/** 마타자의 줄 — XlsACE_BAT 행 줄 */
function aceBatterLineOf(aceIndex: number): MatchupBatterLine | null {
  const ace = ACE_BATTERS[aceIndex]
  return ace === undefined ? null : batterLineOfRecord(ace.recordLine)
}

/** 타자 레코드의 시즌 줄 — 투수(`basePitcherLineOf`)와 같은 출처 (마타자는 XlsACE_BAT 행 줄) */
function baseBatterLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryBatter): MatchupBatterLine | null {
  if (entry.aceIndex >= 0) return aceBatterLineOf(entry.aceIndex)
  const { stats } = records
  if (entry.rosterSlot !== NO_ROSTER_SLOT) return tableBatterLineOf(stats, leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot))
  return entry.recordId === undefined || stats === undefined ? null : leagueRecordBatterLineOf(stats, entry.recordId)
}

type PlateAppearance = TeamGameProgress['leaguePlateAppearances'][number]

/** 이 타석이 그 타자의 것인가 — 붙박이 표 칸은 팀 · 타순 칸, 표 밖 선수는 기록 id */
function isAppearanceOf(appearance: PlateAppearance, tableTeam: number, entry: TeamEntryBatter): boolean {
  if (entry.rosterSlot !== NO_ROSTER_SLOT) {
    return appearance.recordId === undefined && appearance.teamId === tableTeam && appearance.battingOrderIndex === entry.rosterSlot
  }
  return entry.recordId !== undefined && appearance.recordId === entry.recordId
}

/** 이 경기에서 그 타자가 쌓은 줄 (`leaguePlateAppearances` — 진행기가 리그 기록표로 넘길 타석) */
function gameBatterLineOf(progress: TeamGameProgress, teamId: number, entry: TeamEntryBatter): LeagueBatterLine {
  const tableTeam = entry.tableTeamId ?? teamId
  return progress.leaguePlateAppearances.reduce<LeagueBatterLine>((line, appearance) => {
    if (!isAppearanceOf(appearance, tableTeam, entry)) return line
    return {
      atBats: line.atBats + (countsAsAtBat(appearance.outcome) ? 1 : 0),
      hits: line.hits + (isHit(appearance.outcome) ? 1 : 0),
      homeRuns: line.homeRuns + (appearance.outcome.kind === '홈런' ? 1 : 0),
      runsBattedIn: line.runsBattedIn + appearance.runsBattedIn,
    }
  }, EMPTY_LEAGUE_BATTER_LINE)
}

/** 타자 레코드의 시즌 줄 값 — 타율 `0xb8e3c`(×1000) · 홈런 `+0x28` · 타점 `+0x2a` (`teamPitcherSeasonStatsOf` 와 같은 출처) */
export function teamBatterSeasonStatsOf(
  progress: TeamGameProgress,
  records: TeamMatchupRecords | undefined,
  teamId: number,
  entry: TeamEntryBatter,
): { readonly battingAverage: number; readonly homeRuns: number; readonly runsBattedIn: number } | null {
  const base = records === undefined ? null : baseBatterLineOf(records, teamId, entry)
  if (base === null) return null
  const line = records?.countsThisGame === true ? sumBatterLines(base, gameBatterLineOf(progress, teamId, entry)) : base
  return batterCardStatsOf(line)
}
