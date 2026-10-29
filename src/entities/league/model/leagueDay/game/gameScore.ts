import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { leaguePitcherAppearancesOf } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePitcherAppearance } from '@/entities/league/model/leaguePlayerStats'
import { gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import type { PitcherOfRecord } from '@/entities/game/model/winLossSave'
import type { LeagueGameRun } from '@/entities/league/model/leagueDay/game/halfInning'
import type { LeagueGameSide } from '@/entities/league/model/leagueDay/game/gameSides'
import { ACE_PITCHER_SLOT, AWAY_SIDE } from '@/entities/league/model/leagueDay/roster/slots'
import { recordPlayerAt } from '@/entities/league/model/leagueDay/roster/teamRecord'
import type { LeagueRecordPlayer } from '@/entities/league/model/leagueDay/roster/teamRecord'
import type { LeagueGameScore } from '@/entities/league/model/leagueDay/types/leagueGameScore'

/** 경기가 끝난 진행 칸에서 점수 · 기록 · 스태미나를 읽어 `LeagueGameScore` 로 */
export function leagueGameScoreOf(game: LeagueGameRun): LeagueGameScore {
  const { away, home, tally } = game
  return {
    awayRuns: away.runs,
    homeRuns: home.runs,
    plateAppearances: tally.plateAppearances,
    stolenBases: tally.stolenBases,
    pitcherAppearances: pitcherAppearancesOf(game),
    steals: tally.steals,
    pinchHits: tally.pinchHits,
    // 로스터 칸(0~7)만 다음 CPU 경기로 잇는다 — 8번(마투수)은 다음 경기의 0xb88c8 이 저장 레코드(+0x2c 포함)로 다시 덮는다
    pitcherStaminas: {
      away: away.staminas.slice(0, PITCHERS_PER_TEAM),
      home: home.staminas.slice(0, PITCHERS_PER_TEAM),
    },
    // 그래도 팀 레코드 8번 칸에는 깎인 값이 남는다 (0xb521c 가 저장 레코드에 넣은 칸)
    acePitcherStaminas: {
      ...acePitcherStaminaOf('away', away),
      ...acePitcherStaminaOf('home', home),
    },
  }
}

function acePitcherStaminaOf(key: 'away' | 'home', side: LeagueGameSide): { readonly away?: number; readonly home?: number } {
  if (side.acePitcher === undefined) return {}
  return { [key]: side.staminas[ACE_PITCHER_SLOT] ?? side.acePitcher.stamina }
}

/**
 * 승·패·세 투수 — 경기 끝 0xa7de8 이 읽는 칸 그대로다 (S1 확정, `decisionsAfterHalfInning`).
 * 원본 빈틈도 그대로 옮긴다:
 *   - 승리 투수는 **6회(이닝 index ≥ 5) 이후의 득점 때만** 정해진다 — 5회까지만 점수가 나고 그 뒤로 한 점도
 *     안 나면 **승리 투수가 없다**(패전 투수는 이닝 조건이 없어 남는다). 선발 5이닝 요건 같은 진짜 규칙은 없다.
 *   - 세이브는 **한 번도 기록되지 않는다** — 후보는 교체 0xa60c0 이 잡지만 세이브 코드 `state+0x64` 를 0 으로
 *     되돌리는 곳이 없어 0xa7eaa 에 늘 걸린다 (S1 4-1, CORRECTIONS 2-1 — 원본 버그 B-10, 고친 길은 `gameEndDecisionOf`).
 * 판정은 경기 안의 **실제 점수**로 한다 — 순위표 쪽의 칸·명단 엇갈림(`playLeagueDay`)과는 따로다.
 */
function pitcherAppearancesOf(game: LeagueGameRun): readonly LeaguePitcherAppearance[] {
  const { away, home } = game
  const ended = gameEndDecisionOf(game.decision)
  const teamOfSide = (side: number) => (side === AWAY_SIDE ? away.teamId : home.teamId)
  // 투수 줄·판정도 레코드 칸에 앉은 선수의 붙박이 표 자리로 센다 (타자와 같다 — 기록 칸이 선수를 따라간다).
  // 마투수 8번 칸은 표 자리가 없어 그대로 두고 아래에서 건너뛴다
  const tableSeatOf = (teamId: number, pitcherSlot: number): LeagueRecordPlayer =>
    pitcherSlot === ACE_PITCHER_SLOT
      ? { tableTeamId: teamId, tableSlot: pitcherSlot }
      : recordPlayerAt(teamId === away.teamId ? away.record : home.record, teamId, true, pitcherSlot)
  const recordOf = (record: PitcherOfRecord | null) => {
    if (record === null) return null
    const seat = tableSeatOf(teamOfSide(record.side), record.number)
    return { side: record.side, pitcherSlot: seat.tableSlot, teamId: seat.tableTeamId }
  }
  const lines = [...game.tally.pitched.entries()].flatMap(([teamId, team]) =>
    [...team.entries()].map(([pitcherSlot, line]) => {
      const seat = tableSeatOf(teamId, pitcherSlot)
      return { ...line, teamId: seat.tableTeamId, pitcherSlot: seat.tableSlot }
    }),
  )
  return leaguePitcherAppearancesOf(
    lines,
    { winner: recordOf(ended.winner), loser: recordOf(ended.loser), save: recordOf(ended.save) },
    // 칸 s 에서 **던진** 팀 — 초(칸 0) 수비는 home, 말(칸 1) 수비는 away. 판정 측은 그 칸의 팀이다
    teamOfSide,
    // 마투수 줄·판정은 쌓지 않는다 — 마타자와 같이 팀 레코드 8번 칸이 다음 경기에 저장 레코드로 덮인다
    (_teamId, pitcherSlot) => pitcherSlot === ACE_PITCHER_SLOT,
  )
}
