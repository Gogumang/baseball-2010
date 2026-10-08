import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { currentBatterEntry, isOurOffense, moundStaminaOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'
import {
  EMPTY_LEAGUE_BATTER_LINE,
  leagueBatterIdOf,
  leagueBatterLineOf,
  leaguePitcherIdOf,
  leaguePitcherLineOf,
  leagueRecordBatterLineOf,
  leagueRecordPitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeagueBatterLine, LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { BATTERS } from '@/shared/config/original/roster'
import {
  batterCardStatsOf,
  batterHandOf,
  pitcherCardStatsOf,
  staminaGaugeOf,
  sumBatterLines,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * 팀경기 레코드 시즌 줄의 출처 — 시즌 세션이 대는 리그 선수 기록표(시즌 레코드 +0x20~ 의 웹 자리)와
 * 이 경기 줄을 더할지(기록 게이트 0xa56dc 모드 2 갈래: 국가대항전·포스트시즌이면 거짓).
 */
export interface TeamMatchupRecords {
  readonly stats: LeaguePlayerStats
  readonly countsThisGame: boolean
}

export interface TeamMatchupCards {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/** 투수 레코드의 시즌 줄 (경기를 세울 때) — 붙박이 표 칸 · 표 밖 id 로. 마투수는 표에 칸이 없다 */
function basePitcherLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryPitcher): MatchupPitcherLine | null {
  if (entry.aceIndex >= 0) return null
  if (entry.tableSlot !== undefined) {
    return leaguePitcherLineOf(records.stats, leaguePitcherIdOf(entry.tableTeamId ?? teamId, entry.tableSlot))
  }
  return entry.recordId === undefined ? null : leagueRecordPitcherLineOf(records.stats, entry.recordId)
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

function baseBatterLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryBatter): LeagueBatterLine | null {
  if (entry.aceIndex >= 0) return null
  if (entry.rosterSlot !== NO_ROSTER_SLOT) {
    return leagueBatterLineOf(records.stats, leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot))
  }
  return entry.recordId === undefined ? null : leagueRecordBatterLineOf(records.stats, entry.recordId)
}

/** 이 경기에서 그 타자가 쌓은 줄 (`leaguePlateAppearances` — 진행기가 리그 기록표로 넘길 타석) */
function gameBatterLineOf(progress: TeamGameProgress, teamId: number, entry: TeamEntryBatter): LeagueBatterLine {
  const tableTeam = entry.tableTeamId ?? teamId
  return progress.leaguePlateAppearances.reduce<LeagueBatterLine>((line, appearance) => {
    const isSame =
      entry.rosterSlot !== NO_ROSTER_SLOT
        ? appearance.recordId === undefined
          && appearance.teamId === tableTeam
          && appearance.battingOrderIndex === entry.rosterSlot
        : entry.recordId !== undefined && appearance.recordId === entry.recordId
    if (!isSame) return line
    return {
      atBats: line.atBats + (countsAsAtBat(appearance.outcome) ? 1 : 0),
      hits: line.hits + (isHit(appearance.outcome) ? 1 : 0),
      homeRuns: line.homeRuns + (appearance.outcome.kind === '홈런' ? 1 : 0),
      runsBattedIn: line.runsBattedIn + appearance.runsBattedIn,
    }
  }, EMPTY_LEAGUE_BATTER_LINE)
}

/** 타자 레코드 +0xb(폼 니블) — 붙박이 표 행에서. 표 밖 선수(영입한 명전·나리)는 웹 명단에 칸이 없어 모른다 */
function batterProfileOf(teamId: number, entry: TeamEntryBatter): number | null {
  if (entry.rosterSlot === NO_ROSTER_SLOT) return null
  return BATTERS[leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)]?.profile ?? null
}

/**
 * 타자 손 `0xb63c0`(1 좌타 · 0 우타) — 마타자는 마선수 표, 그 밖은 레코드 +0xb 폼 니블. ⚠️ 표 밖 선수(영입한 명전 · 나리)는
 * 웹 명단에 폼 칸이 없어 우타(0)로 둔다.
 */
export function teamBatterHandOf(teamId: number, entry: TeamEntryBatter): number {
  if (entry.aceIndex >= 0) return batterHandOf(0, entry.aceIndex)
  const profile = batterProfileOf(teamId, entry)
  return profile === null ? 0 : batterHandOf(profile)
}

/**
 * **팀경기 상태 0xe 의 소개 판 값** (0x44944) — 투수 `0xae83c(수비 팀)` · 타자 `0xae89c(공격 팀)` 레코드에서.
 * - 팀 글자 `0xb6c20(st, 측)`: 우리가 치면 타자 PLAYER · 투수 COM, 던지면 반대.
 * - 투수: 이름 · 보직 `+0xb & 3` · 손 0xb63c0(폼 & 1, 마투수 표) · 체력 막대(용량 0x66e44 · % 0xaebb0) ·
 *   방어율 0xb6ce8 · 탈삼진 +0x26.
 * - 타자: 타순 `팀+0x32` · 이름 · 수비 `+0x1c & 0xf` · 손 0xb63c0 · 타율 0xb8e3c · 홈런 +0x28 · 타점 +0x2a ·
 *   오늘 타석 기록 = 그 타순 칸 기록의 링(`BatterGameRecord.results`).
 * - 시즌 줄(방어율·탈삼진·타율·홈런·타점)은 `records` 를 줄 때만 적는다 — 시즌 레코드 = 리그 기록표 줄 + (게이트가 열렸으면)
 *   이 경기 줄. ⚠️ 미해결: 일반(1)·대전(8·9)의 레코드는 Xls 행의 줄(행 바이트 32~45)인데 웹 로스터 표에 그 칸이 없어
 *   비운다(경기 중에도 안 오르는 모드라 그 값 그대로일 것이다). 마선수는 표 칸이 없어 비운다.
 * - ⚠️ 표 밖 선수(영입한 명전·나리)의 타자 손은 웹 명단에 폼 칸이 없어 우타(0)로 둔다.
 */
export function teamMatchupCardsOf(progress: TeamGameProgress, records?: TeamMatchupRecords): TeamMatchupCards {
  const ourBatting = isOurOffense(progress)
  const { options } = progress
  const battingTeam = ourBatting ? options.ourTeamId : options.opponentTeamId
  const fieldingTeam = ourBatting ? options.opponentTeamId : options.ourTeamId
  const batterEntry = ourBatting ? currentBatterEntry(progress) : progress.opponentEntry[progress.opponentOrderIndex]
  const pitcherEntry = ourBatting
    ? progress.opponentPitcherEntry[progress.opponentPitcherIndex]
    : progress.ourPitcherEntry[progress.ourPitcherIndex]

  const batterHand = batterEntry === undefined ? 0 : teamBatterHandOf(battingTeam, batterEntry)

  const pitcherBase = records === undefined || pitcherEntry === undefined
    ? null
    : basePitcherLineOf(records, fieldingTeam, pitcherEntry)
  const pitcherLine = pitcherBase === null || pitcherEntry === undefined
    ? null
    : records?.countsThisGame === true
      ? sumPitcherLines(pitcherBase, gamePitcherLineOf(progress, fieldingTeam, pitcherEntry))
      : pitcherBase
  const batterBase = records === undefined || batterEntry === undefined
    ? null
    : baseBatterLineOf(records, battingTeam, batterEntry)
  const batterLine = batterBase === null || batterEntry === undefined
    ? null
    : records?.countsThisGame === true
      ? sumBatterLines(batterBase, gameBatterLineOf(progress, battingTeam, batterEntry))
      : batterBase

  const slot = ourBatting ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const entryRecords = ourBatting ? progress.ourEntryRecords : progress.opponentEntryRecords

  return {
    batterHand,
    pitcher: {
      isComputer: ourBatting,
      ...(pitcherEntry === undefined
        ? {}
        : {
            name: pitcherEntry.name,
            ...(pitcherEntry.role === undefined ? {} : { role: pitcherEntry.role }),
            throwsLeft: pitcherHandOf(pitcherEntry.repertoire.form, pitcherEntry.aceIndex >= 0) === 1,
            stamina: staminaGaugeOf(moundStaminaOf(progress, !ourBatting)),
          }),
      ...(pitcherLine === null ? {} : pitcherCardStatsOf(pitcherLine)),
    },
    batter: {
      isComputer: !ourBatting,
      battingOrder: slot % 9,
      recentResults: entryRecords[slot]?.results ?? [],
      ...(batterEntry === undefined ? {} : { name: batterEntry.name, position: batterEntry.position }),
      ...(batterLine === null ? {} : batterCardStatsOf(batterLine)),
    },
  }
}
