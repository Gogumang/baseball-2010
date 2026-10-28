import type { League } from '@/entities/league/model/league'
import { type SeasonTeamRoster, type SeasonPlayer, HALL_OF_FAME_FIRST_ID, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import {
  type LeaguePlayerStats,
  type LeagueBatterLine,
  leagueRecordBatterLineOf,
  leagueBatterLineOf,
  leagueBatterIdOf,
  EMPTY_LEAGUE_PLAYER_STATS,
  leaguePitcherLineOf,
  leaguePitcherIdOf,
  type LeaguePitcherLine,
  leagueRecordPitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import type { SeasonEntryRecordSource, SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'
import { KOREA_TEAM_ID } from '@/entities/national-cup/model/nationalCup'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/** 시즌 순위표(0x9d789)가 훑는 재료 — 리그 투수 레코드 차례와 열 팀 레코드, 선수 기록표 */
export interface SeasonLeagueRecordSource {
  readonly league: League
  readonly myTeamId: number
  /** 내 팀 레코드 (`SeasonSession.roster`) */
  readonly roster: SeasonTeamRoster
  /** CPU 팀 레코드 (`SeasonSession.cpuRosterOf`) */
  readonly cpuRosterOf: (teamId: number) => SeasonTeamRoster
  readonly playerStats: LeaguePlayerStats
  /** 영입한 명전 선수의 기록(이름) — 경기 명단과 같은 칸 (`SeasonSession.recordSource`) */
  readonly recordOf?: SeasonEntryRecordSource
}

/**
 * 시즌 명단 선수의 이번 시즌 타자 줄 — 리그 선수는 붙박이 표 자리(옮겨 왔으면 옛 팀)로, 표 밖 선수(영입한 명전·나리)는
 * 원본 id 의 표 밖 줄로 쌓였다
 */
export function seasonBatterLineOf(stats: LeaguePlayerStats, ownerTeamId: number, player: SeasonPlayer): LeagueBatterLine {
  if (player.id >= HALL_OF_FAME_FIRST_ID) return leagueRecordBatterLineOf(stats, player.id)
  return leagueBatterLineOf(stats, leagueBatterIdOf(tableTeamOf(player, ownerTeamId), player.id))
}

/**
 * 엔트리 목록 창(0x5c984) 칸 재료 — 시즌 진입들(0x63dc · 0x5980 · 0x5870 · 0x5b28 · 0x5cd0)은 [ed+0x333] = 1 · [ed+0x334] = 2 다.
 * 시즌 줄은 시즌 저장 레코드(0x204e0 이 비운 뒤 경기가 쌓은 줄) = 리그 기록표 줄이다. 투수 +0x2a(사사구 — 0xa8024 꼬리
 * a8b04~a8bee 가 사람 투구 판정의 볼넷 · 사구마다 지금 투수에게 +1) · 타자 +0x2e(실책 — 수비 그림 0x43278 4381a~43904 가 펌블 6 ·
 * 악송구 4 마다 그 칸 타자에게 +1)도 기록표 칸(`walks` · `errors`, 옛 저장은 0)이다 (docs/re R8 11절). CPU 팀 레코드 사기는 표값
 * (`teamRecordMoraleOf` — 시즌 중 그 칸을 쓰는 곳이 없다).
 */
export function seasonEntryCellSourceOf(save: SeasonSave, teamId: number, isUserTeam: boolean): SeasonEntryCellSource {
  if (save.cup !== undefined && save.cup !== null && teamId >= KOREA_TEAM_ID) return seasonCupEntryCellSourceOf(save, teamId, isUserTeam)
  const stats = save.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS
  const cpuStaminas = save.cpuPitcherStaminas?.[teamId]
  return {
    staminaMode: 2,
    // 리그 CPU 팀 레코드 +2 — 시즌 중 쓰는 곳은 돌발 보상 0x8e34c 종류 1(8e3d2, `0x1f570(저장, SR[1])` 내 팀 칸 · 대회 중이면
    // 상대국 슬롯) 하나뿐이라(r101 `0x1f570` 부르는 곳 전수) 다른 팀 칸은 표값 그대로다. 국가대항전 상대국 슬롯 +0x934 도
    // 하루마다 마스터에서 새로 복사되고(b8216 0x20648) 돌발 사기는 경기 안에서만 쌓이므로 0xe0 에서는 표값이다
    teamMorale: isUserTeam ? save.state.teamMorale : teamRecordMoraleOf(teamId),
    ...(isUserTeam ? {} : { staminaOf: (_player: SeasonPlayer, index: number) => cpuStaminas?.[index] ?? FULL_STAMINA }),
    batterLineOf: (player) => {
      const line = seasonBatterLineOf(stats, teamId, player)
      return {
        atBats: line.atBats,
        hits: line.hits,
        doubles: line.doubles ?? 0,
        triples: line.triples ?? 0,
        homeRuns: line.homeRuns,
        runsBattedIn: line.runsBattedIn,
        steals: line.steals ?? 0,
        errors: line.errors ?? 0,
      }
    },
    pitcherLineOf: (player) => {
      const line = seasonPitcherLineOf(stats, teamId, player)
      return {
        outs: line.outs,
        runsAllowed: line.runsAllowed,
        saves: line.saves,
        strikeouts: line.strikeouts,
        pitches: line.pitches,
        walks: line.walks ?? 0,
        wins: line.wins,
        losses: line.losses,
      }
    },
  }
}

/**
 * **국가대항전 두 슬롯의 엔트리 칸 재료** — 대회 중 팀 얻기 0x1f570 이 팀 10 을 대표팀 슬롯 +0x918 로, 나머지 나라를 상대국 슬롯
 * +0x934 로 돌린다. 두 슬롯은 마스터 팀(0x1f8c0 — 0x1ff98 이 Xls 행 0x30 바이트를 통째 베낀 것)을 깊은 복사한 것이라(대회 초기화
 * b7c72 0x205c0 · 하루마다 b8216 0x20648) 붙박이 줄 +0x20~ 은 **Xls 행 줄 그대로**다 — 시즌 리그 기록표가 아니다(나리
 * `nariCupEntryCellSourceOf` 와 같은 근거). 대표팀 슬롯에는 대회 사람 경기가 게이트 밖 두 칸(+0x2a 사사구 · +0x2e 실책)을 더 쌓는다
 * (`SeasonSave.cupPlayerStats`). 사기 · 스태미나는 부르는 쪽 몫 그대로다(대표팀은 `userEntrySourceOf` 가 덮는다).
 */
function seasonCupEntryCellSourceOf(save: SeasonSave, teamId: number, isUserTeam: boolean): SeasonEntryCellSource {
  const marks = teamId === KOREA_TEAM_ID ? (save.cupPlayerStats ?? EMPTY_LEAGUE_PLAYER_STATS) : EMPTY_LEAGUE_PLAYER_STATS
  const isTablePlayer = (player: SeasonPlayer) => player.id < HALL_OF_FAME_FIRST_ID
  return {
    staminaMode: 2,
    teamMorale: isUserTeam ? save.state.teamMorale : teamRecordMoraleOf(teamId),
    ...(isUserTeam ? {} : { staminaOf: () => FULL_STAMINA }),
    batterLineOf: (player) => {
      const row = isTablePlayer(player) ? teamBatters(tableTeamOf(player, teamId))[player.id] : undefined
      const line = entryBatterLineOfRecord(row?.recordLine ?? [])
      const errors = leagueBatterLineOf(marks, leagueBatterIdOf(tableTeamOf(player, teamId), player.id)).errors ?? 0
      return { ...line, errors: Math.min(CUP_RECORD_COUNTER_LIMIT, line.errors + errors) }
    },
    pitcherLineOf: (player) => {
      const row = isTablePlayer(player) ? teamPitchers(tableTeamOf(player, teamId))[player.id] : undefined
      const line = entryPitcherLineOfRecord(row?.recordLine ?? [])
      const walks = leaguePitcherLineOf(marks, leaguePitcherIdOf(tableTeamOf(player, teamId), player.id)).walks ?? 0
      return { ...line, walks: Math.min(CUP_RECORD_COUNTER_LIMIT, line.walks + walks) }
    },
  }
}

/** a8b5a · 0x43838 의 `0x270f` 상한 — 레코드 칸에 더할 때 자른다 */
const CUP_RECORD_COUNTER_LIMIT = 9999

/** 시즌 명단 선수의 이번 시즌 투수 줄 — `seasonBatterLineOf` 와 같은 열쇠 */
export function seasonPitcherLineOf(stats: LeaguePlayerStats, ownerTeamId: number, player: SeasonPlayer): LeaguePitcherLine {
  if (player.id >= HALL_OF_FAME_FIRST_ID) return leagueRecordPitcherLineOf(stats, player.id)
  return leaguePitcherLineOf(stats, leaguePitcherIdOf(tableTeamOf(player, ownerTeamId), player.id))
}
