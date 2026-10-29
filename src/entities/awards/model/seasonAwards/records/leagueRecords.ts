import { EMPTY_LEAGUE_RECORD, type LeagueRecord } from '@/entities/awards/model/leaderboard'
import {
  LEAGUE_TEAM_COUNT,
  leagueBatterIdOf,
  leagueBatterLineOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  teamBatters,
  teamPitchers,
  type LeaguePlayerStats,
  type PlayerCareer,
} from '@/entities/awards/model/seasonAwards/otherSlices'

/**
 * 내 선수의 순위표 한 줄. 리그 기록표를 만들 때 **내 팀 명단 자리에** 끼워 넣는 용도다.
 * (원본은 내 선수 레코드가 팀 명단 안에 있어 동점 순서까지 자연히 맞는다. 웹은 명단이
 * `shared/config` 의 붙박이 표라 순서를 흉내 내야 한다 — 부르는 쪽이 자리를 정한다.)
 *
 * 투수 칸(세이브·탈삼진·승·패·자책점)은 채우지 않는다. `career.stats.strikeouts` 는
 * **타자가 당한 삼진**이라 원본 +0x26(투수 탈삼진)과 뜻이 다르다.
 */
export function myLeagueRecordOf(career: PlayerCareer): LeagueRecord {
  return {
    ...EMPTY_LEAGUE_RECORD,
    teamId: career.teamId,
    name: career.name,
    isMine: true,
    atBatsOrOuts: career.stats.atBats,
    hits: career.stats.hits,
    homeRuns: career.stats.homeRuns,
    runsBattedIn: career.stats.runsBattedIn,
  }
}

/**
 * 리그 선수 기록표 → 순위표가 훑을 레코드 줄들 (0x9d789 의 순회 순서 그대로).
 *
 * 원본은 **팀 0부터, 팀 안에서는 명단 순서대로** 훑는다. 동점이면 먼저 들어간 쪽이 1위이므로
 * 이 순서가 곧 동점 우선순위다. 웹은 `BATTERS` 가 팀마다 12명씩 이어 붙어 있어 그대로 맞는다.
 *
 * `myRecord` 를 주면 **내 팀 명단 끝**에 끼운다. 원본은 내 선수 레코드가 팀 명단 안에 있지만
 * 몇 번째인지는 모른다 — 선수 생성(0x1762e)이 명단에 더하는 모양이라 끝으로 두었다 (**추정**).
 * 동점일 때만 차이가 나고, 그때는 같은 팀 로스터 타자가 앞선다.
 */
export function leagueRecordsOf(stats: LeaguePlayerStats, myRecord: LeagueRecord | null = null): readonly LeagueRecord[] {
  const records: LeagueRecord[] = []
  for (let teamId = 0; teamId < LEAGUE_TEAM_COUNT; teamId += 1) {
    teamBatters(teamId).forEach((player, slot) => {
      const line = leagueBatterLineOf(stats, leagueBatterIdOf(teamId, slot))
      records.push({
        ...EMPTY_LEAGUE_RECORD,
        teamId,
        name: player.name,
        atBatsOrOuts: line.atBats,
        hits: line.hits,
        homeRuns: line.homeRuns,
        runsBattedIn: line.runsBattedIn,
      })
    })
    if (myRecord !== null && myRecord.teamId === teamId) records.push(myRecord)
  }
  return records
}

/** 커리어 하나로 순위표 재료를 만든다 — 리그 선수 표 + 내 선수 한 줄 */
export function careerLeagueRecordsOf(career: PlayerCareer): readonly LeagueRecord[] {
  return leagueRecordsOf(career.leaguePlayerStats, myLeagueRecordOf(career))
}

/**
 * 리그 **투수** 기록표 → 순위표가 훑을 레코드 줄들.
 *
 * 원본은 한 순위표 함수(0x9d789)가 종류에 따라 팀의 타자 명단(0xb53d1)이나 **투수 명단**(0xb51fd,
 * 레코드 +0xc 개수)을 훑는다 — 투수 타이틀(승·탈삼진·방어율)은 투수 명단 쪽이다.
 * 웹은 명단이 `shared/config` 의 붙박이 표라 표만 갈아 끼운다: 팀 0부터, 팀 안에서는 로스터 순서.
 *
 * 칸 대응은 P1 6절 그대로다 — `atBatsOrOuts` = +0x20 아웃, `hits`·`earnedRuns` = +0x22 실점
 * (자책 구분이 없어 같은 칸이다), `saves` = +0x24, `strikeouts` = +0x26, `wins` = +0x2e,
 * `losses` = +0x2f.
 */
export function leaguePitcherRecordsOf(stats: LeaguePlayerStats, myRecord: LeagueRecord | null = null): readonly LeagueRecord[] {
  const records: LeagueRecord[] = []
  for (let teamId = 0; teamId < LEAGUE_TEAM_COUNT; teamId += 1) {
    teamPitchers(teamId).forEach((player, slot) => {
      const line = leaguePitcherLineOf(stats, leaguePitcherIdOf(teamId, slot))
      records.push({
        ...EMPTY_LEAGUE_RECORD,
        teamId,
        name: player.name,
        atBatsOrOuts: line.outs,
        hits: line.runsAllowed,
        saves: line.saves,
        strikeouts: line.strikeouts,
        earnedRuns: line.runsAllowed,
        wins: line.wins,
        losses: line.losses,
      })
    })
    if (myRecord !== null && myRecord.teamId === teamId) records.push(myRecord)
  }
  return records
}
