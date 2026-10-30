/** 둘째 갈래 — 나리 판 순위 (0x5796c) */
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherLeagueRecordsOf } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { myLeagueRecordOf } from '@/entities/awards/model/seasonAwards'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import { leagueBatterIdOf, leagueBatterLineOf } from '@/entities/league/model/leaguePlayerStats'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { rankSeasonRecords, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry, SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'
import type { NariRecordEdition } from '@/pages/nari-record-room/lib/nariRecordRoom/yearColumns'

/**
 * **둘째 갈래 = 나리 판 순위**(0x5761c 만들기 0 갈래 0x577a8 → 순위 객체 0x9d77d, 그리기 0x5796c — 시즌 0xdb 와 같은 함수).
 * 편(타자 쪽 표 0xd1a4c · 투수 쪽 0xd1a60)은 0x5761c 셋째 인자 = [장면+0xcc] ≠ 4 다. 순위 0x9d789(…, 종류, 모드 3 · 4, 1, 0) 의
 * 규정 문턱은 모드 3 · 4 갈래(9d7da~9d826)가 나리 저장 0x1fa2d 의 S+0xb2(이번 시즌 경기 수)로 셈한다 — 시즌과 같은 식.
 */
export function nariRankingSideOf(edition: NariRecordEdition): SeasonRankingSide {
  return edition
}

/**
 * 타자편 순위 재료 — 열 팀 타자 명단 차례(`seasonAwards.leagueRecordsOf` 와 같은 차례)에 +0x2c 도루(`steals`)까지 채운다
 * (순위 종류 10 이 본다). 내 선수 줄은 `myLeagueRecordOf` 에 내 도루(`SeasonStats.stolenBases` — 동료 간이 타석의 도루, 옛 저장 0)를 얹는다.
 */
export function nariBatterRankingRecordsOf(career: PlayerCareer): readonly LeagueRecord[] {
  const mine = { ...myLeagueRecordOf(career), batterExtra: career.stats.stolenBases ?? 0 }
  const records: LeagueRecord[] = []
  for (let teamId = 0; teamId < LEAGUE_TEAM_COUNT; teamId += 1) {
    teamBatters(teamId).forEach((player, slot) => {
      const line = leagueBatterLineOf(career.leaguePlayerStats, leagueBatterIdOf(teamId, slot))
      records.push({
        ...EMPTY_LEAGUE_RECORD,
        teamId,
        name: player.name,
        atBatsOrOuts: line.atBats,
        hits: line.hits,
        homeRuns: line.homeRuns,
        runsBattedIn: line.runsBattedIn,
        batterExtra: line.steals ?? 0,
      })
    })
    if (mine.teamId === teamId) records.push(mine)
  }
  return records
}

/** 쪽 하나의 상위 10명 */
export function nariRankingEntriesOf(edition: NariRecordEdition, career: PlayerCareer | PitcherCareer, page: number): readonly SeasonRankingEntry[] {
  const categories = rankingCategoriesOf(nariRankingSideOf(edition))
  const category = categories[page] ?? categories[0]
  const records = edition === '타자' ? nariBatterRankingRecordsOf(career as PlayerCareer) : pitcherLeagueRecordsOf(career as PitcherCareer)
  return rankSeasonRecords(records, category.kind, career.gamesPlayed)
}
