import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { leaguePitcherIdOf, leaguePitcherLineOf, leagueRecordPitcherLineOf } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { PITCHERS } from '@/shared/config/original/roster'
import { pitcherCardStatsOf, pitcherLineOfRecord, sumPitcherLines } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { TeamMatchupRecords } from './matchupRecords'

/** 붙박이 표 칸 투수의 줄 — 기록표가 없으면(일반모드) Xls 행 줄 */
function tablePitcherLineOf(stats: LeaguePlayerStats | undefined, id: number): MatchupPitcherLine | null {
  if (stats !== undefined) return leaguePitcherLineOf(stats, id)
  const row = PITCHERS[id]
  return row === undefined ? null : pitcherLineOfRecord(row.recordLine)
}

/** 마투수의 줄 — XlsACE_PIT 행 그대로 (`AcePlayer.recordLine`) */
function acePitcherLineOf(aceIndex: number): MatchupPitcherLine | null {
  const ace = ACE_PITCHERS[aceIndex]
  return ace === undefined ? null : pitcherLineOfRecord(ace.recordLine)
}

/**
 * 투수 레코드의 시즌 줄 (경기를 세울 때) — 붙박이 표 칸 · 표 밖 id 로.
 * 마투수는 0x20094 6번 갈래가 XlsACE_PIT 행을 부은 저장 레코드(0x1f824)를 0xb521c 로 통째 베낀 칸이고 게이트 0xa56dc 가 늘 거른다
 * (모드 1 거짓 · 2 · 3 · 4 는 0xb633d) — 표의 줄 그대로다(`AcePlayer.recordLine`).
 * 기록표가 없으면(일반모드) 붙박이 표 칸은 Xls 행 줄이다. ⚠️ 그때 표 밖 선수만 줄이 없어 비운다(대전 8 · 9 는 웹에 없다).
 */
function basePitcherLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryPitcher): MatchupPitcherLine | null {
  if (entry.aceIndex >= 0) return acePitcherLineOf(entry.aceIndex)
  const { stats } = records
  if (entry.tableSlot !== undefined) return tablePitcherLineOf(stats, leaguePitcherIdOf(entry.tableTeamId ?? teamId, entry.tableSlot))
  return entry.recordId === undefined || stats === undefined ? null : leagueRecordPitcherLineOf(stats, entry.recordId)
}

/** 이 경기에서 그 투수가 쌓은 줄 (`pitcherLines` — 진행기가 마운드 투수에게 매긴 아웃·실점·탈삼진) */
function gamePitcherLineOf(progress: TeamGameProgress, teamId: number, entry: TeamEntryPitcher): MatchupPitcherLine {
  const tableTeam = entry.tableTeamId ?? teamId
  const line = progress.pitcherLines.find((candidate) =>
    entry.tableSlot !== undefined
      ? candidate.teamId === tableTeam && candidate.pitcherSlot === entry.tableSlot && candidate.recordId === undefined
      : entry.recordId !== undefined && candidate.recordId === entry.recordId,
  )
  return { outs: line?.outs ?? 0, runsAllowed: line?.runsAllowed ?? 0, strikeouts: line?.strikeouts ?? 0 }
}

/**
 * 투수 레코드의 시즌 줄 값 — 방어율 `0xb6ce8`(×100) · 탈삼진 `+0x26`. 시즌 레코드 = 리그 기록표 줄 + (게이트가 열렸으면) 이 경기 줄.
 * 소개 판(0x44944)과 교체 창 목록 줄(0x37904 · 0x37e5c)이 같은 레코드 칸을 읽는다. 기록표를 안 줬거나 마투수면 null.
 */
export function teamPitcherSeasonStatsOf(
  progress: TeamGameProgress,
  records: TeamMatchupRecords | undefined,
  teamId: number,
  entry: TeamEntryPitcher,
): { readonly earnedRunAverage: number; readonly strikeouts: number } | null {
  const base = records === undefined ? null : basePitcherLineOf(records, teamId, entry)
  if (base === null) return null
  const line = records?.countsThisGame === true ? sumPitcherLines(base, gamePitcherLineOf(progress, teamId, entry)) : base
  return pitcherCardStatsOf(line)
}
