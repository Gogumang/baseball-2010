import { type SeasonPlayer, HALL_OF_FAME_FIRST_ID } from '@/entities/season-mode/model/playerRecruit'
import { playerFaceOf } from '@/entities/season-mode/model/seasonEntry'
import { type LeagueRecord, EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import { pitcherOrderOf } from '@/entities/league/model/league'
import { type SeasonLeagueRecordSource, seasonBatterLineOf, seasonPitcherLineOf } from '@/app/model/seasonSession/records/entryCells'
import { LEAGUE_TEAM_COUNT } from '@/app/model/seasonSession/stamina/stamina'

/** 순위표 줄의 이름 — 표 밖 명전 선수는 기록 이름(rec + 1)을 명전 칸에서 찾는다(`recordOf`), 그 밖은 `playerFaceOf` */
function recordNameOf(source: SeasonLeagueRecordSource, team: number, player: SeasonPlayer, isPitcher: boolean, index: number): string {
  if (player.id >= HALL_OF_FAME_FIRST_ID && player.record === undefined) {
    const found = isPitcher ? source.recordOf?.pitcher(player) : source.recordOf?.batter(player)
    if (found !== undefined) return found.name
  }
  return playerFaceOf(team, player, isPitcher, index).name
}

/**
 * **시즌 순위표가 훑을 레코드 줄들** — 0x9d789 (직접 떴다): 팀 `k = 0..9` 마다 `0x1f9a9(저장, 모드, k)` 의 팀 레코드를 얻어
 * 종류 > 7 이면 타자 배열(0xb53d1, 수 +0x10) · 아니면 투수 배열(0xb51fd, 수 +0xc)을 **레코드 차례대로** 훑고,
 * +0x20 ≤ 0 이거나 마선수(0xb633d)인 줄을 뺀 뒤 순위에 넣는다. 그래서
 * - 트레이드로 옮겨 간 선수는 **지금 팀**의 줄로, 그 팀 레코드 칸 차례에 나온다 — 성적은 레코드를 따라온 값(표 자리 열쇠).
 * - 투수 배열은 로테이션(0xb5ca8)으로 섞인 레코드 차례다(`League.pitcherOrders` — 동점일 때만 갈린다).
 * 웹 `leagueRecordsOf`(entities/awards)는 붙박이 표를 훑어 옮겨 간 선수가 옛 팀 줄로 나왔다 — 시즌모드는 이것을 쓴다.
 * 이름은 엔트리 편집과 같은 `playerFaceOf`(레코드 id 로 0xaa458 표 · 표 밖이면 기록 이름).
 */
export function seasonLeagueRecordsOf(source: SeasonLeagueRecordSource, isPitcher: boolean): readonly LeagueRecord[] {
  const records: LeagueRecord[] = []
  for (let team = 0; team < LEAGUE_TEAM_COUNT; team += 1) {
    const roster = team === source.myTeamId ? source.roster : source.cpuRosterOf(team)
    records.push(...(isPitcher ? teamPitcherRecordsOf(source, team, roster) : teamBatterRecordsOf(source, team, roster)))
  }
  return records
}

type SeasonRoster = ReturnType<SeasonLeagueRecordSource['cpuRosterOf']>

/** 한 팀 타자 배열(0xb53d1) — 레코드 차례대로 */
function teamBatterRecordsOf(source: SeasonLeagueRecordSource, team: number, roster: SeasonRoster): LeagueRecord[] {
  return roster.batters.map((player, index) => {
    const line = seasonBatterLineOf(source.playerStats, team, player)
    return {
      ...EMPTY_LEAGUE_RECORD,
      teamId: team,
      name: recordNameOf(source, team, player, false, index),
      atBatsOrOuts: line.atBats,
      hits: line.hits,
      homeRuns: line.homeRuns,
      runsBattedIn: line.runsBattedIn,
      // +0x2c 도루 — 순위 종류 10 (0x9d789). 옛 저장은 칸이 없어 0
      batterExtra: line.steals ?? 0,
    }
  })
}

/** 한 팀 투수 배열(0xb51fd) — 로테이션(0xb5ca8)으로 섞인 레코드 차례 */
function teamPitcherRecordsOf(source: SeasonLeagueRecordSource, team: number, roster: SeasonRoster): LeagueRecord[] {
  const order = pitcherOrderOf(source.league, team)
  const indexes = roster.pitchers.length === order.length ? order : roster.pitchers.map((_player, index) => index)
  return indexes.flatMap((index) => {
    const player = roster.pitchers[index]
    if (player === undefined) return []
    const line = seasonPitcherLineOf(source.playerStats, team, player)
    return [
      {
        ...EMPTY_LEAGUE_RECORD,
        teamId: team,
        name: recordNameOf(source, team, player, true, index),
        atBatsOrOuts: line.outs,
        hits: line.runsAllowed,
        saves: line.saves,
        strikeouts: line.strikeouts,
        earnedRuns: line.runsAllowed,
        wins: line.wins,
        losses: line.losses,
      },
    ]
  })
}

/** 순위표 종류가 투수 배열을 훑는가 — 0x9d789 `cmp 종류, #7 ; ble` (9d83e · 9d85c) */
export function isPitcherLeaderKind(kind: number): boolean {
  return kind <= 7
}
