import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { currentBatterEntry, isOurOffense, moundStaminaOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import type { PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames } from '@/widgets/batting-stage/model/stageRefs'
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
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import {
  aceBatterProfileOf,
  batterCardStatsOf,
  batterHandOf,
  batterLineOfRecord,
  pitcherLineOfRecord,
  pitcherCardStatsOf,
  staminaGaugeOf,
  sumBatterLines,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterLine, MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * 팀경기 레코드 시즌 줄의 출처 — 시즌 세션이 대는 리그 선수 기록표(시즌 레코드 +0x20~ 의 웹 자리)와
 * 이 경기 줄을 더할지(기록 게이트 0xa56dc 모드 2 갈래: 국가대항전·포스트시즌이면 거짓).
 * `stats` 가 없으면(일반모드 1) 레코드는 Xls 행 사본이라 표의 줄(`RosterPlayer.recordLine`)을 읽는다 — 게이트 0xd8204 의 모드 1 은
 * 늘 거짓이라 경기 중에도 안 오른다(`countsThisGame` 거짓).
 */
export interface TeamMatchupRecords {
  readonly stats?: LeaguePlayerStats
  readonly countsThisGame: boolean
}

/** 일반모드(1)의 시즌 줄 출처 — 레코드 = Xls 행 그대로(행 바이트 32~43), 게이트 거짓 */
export const XLS_ROW_MATCHUP_RECORDS: TeamMatchupRecords = { countsThisGame: false }

export interface TeamMatchupCards {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/**
 * 투수 레코드의 시즌 줄 (경기를 세울 때) — 붙박이 표 칸 · 표 밖 id 로.
 * 마투수는 0x20094 6번 갈래가 XlsACE_PIT 행을 부은 저장 레코드(0x1f824)를 0xb521c 로 통째 베낀 칸이고 게이트 0xa56dc 가 늘 거른다
 * (모드 1 거짓 · 2 · 3 · 4 는 0xb633d) — 표의 줄 그대로다(`AcePlayer.recordLine`).
 * 기록표가 없으면(일반모드) 붙박이 표 칸은 Xls 행 줄, 표 밖 선수는 ⚠️ 미확인이라 비운다.
 */
function basePitcherLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryPitcher): MatchupPitcherLine | null {
  if (entry.aceIndex >= 0) {
    const ace = ACE_PITCHERS[entry.aceIndex]
    return ace === undefined ? null : pitcherLineOfRecord(ace.recordLine)
  }
  const { stats } = records
  if (entry.tableSlot !== undefined) {
    const id = leaguePitcherIdOf(entry.tableTeamId ?? teamId, entry.tableSlot)
    if (stats === undefined) {
      const row = PITCHERS[id]
      return row === undefined ? null : pitcherLineOfRecord(row.recordLine)
    }
    return leaguePitcherLineOf(stats, id)
  }
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

/** 타자 레코드의 시즌 줄 — 투수(`basePitcherLineOf`)와 같은 출처 (마타자는 XlsACE_BAT 행 줄) */
function baseBatterLineOf(records: TeamMatchupRecords, teamId: number, entry: TeamEntryBatter): MatchupBatterLine | null {
  if (entry.aceIndex >= 0) {
    const ace = ACE_BATTERS[entry.aceIndex]
    return ace === undefined ? null : batterLineOfRecord(ace.recordLine)
  }
  const { stats } = records
  if (entry.rosterSlot !== NO_ROSTER_SLOT) {
    const id = leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)
    if (stats === undefined) {
      const row = BATTERS[id]
      return row === undefined ? null : batterLineOfRecord(row.recordLine)
    }
    return leagueBatterLineOf(stats, id)
  }
  return entry.recordId === undefined || stats === undefined ? null : leagueRecordBatterLineOf(stats, entry.recordId)
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

/**
 * 타자 레코드 +0xb(폼 니블) — 붙박이 표 행, 표 밖 선수(영입한 명전·나리)는 기록 사본의 +0xb(`TeamEntryBatter.profile`).
 * ⚠️ 칸이 생기기 전의 옛 기록 사본은 모른다(null)
 */
export function batterProfileOf(teamId: number, entry: TeamEntryBatter): number | null {
  if (entry.rosterSlot === NO_ROSTER_SLOT) return entry.profile ?? null
  return BATTERS[leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)]?.profile ?? null
}

/**
 * 타자 손 `0xb63c0`(1 좌타 · 0 우타) — 마타자는 마선수 표, 그 밖은 레코드 +0xb 폼 니블. ⚠️ +0xb 를 모르는 옛 기록 사본은
 * 우타(0)로 둔다.
 */
export function teamBatterHandOf(teamId: number, entry: TeamEntryBatter): number {
  if (entry.aceIndex >= 0) return batterHandOf(0, entry.aceIndex)
  const profile = batterProfileOf(teamId, entry)
  return profile === null ? 0 : batterHandOf(profile)
}

/**
 * **사람 타석 타자 그림 · 판정 재료** — 지금 타자 `0xae89c(공격 팀 = 우리)` 레코드에서 (`BattingStage` 의 batterForm · batterSkinIndex ·
 * batterHand). 타석 교대 0x47d98~0x47dd6 이 타자 그림 적재 0x78ab0 에 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` ·
 * 손 0xb63c0 을 넘기고, 0x47d58~0x47d70 이 같은 손을 장면 +0x17e1(배치 side)에 쓴다. 마타자는 XlsACE_BAT +0xb
 * (`aceBatterProfileOf`)와 손 표 0xd88b0 — 폼의 낮은 비트가 아니다. ⚠️ +0xb 를 모르는 옛 기록 사본은 0(타격형 · 우타 · 피부 0)
 */
export function teamBattingStageBatterOf(progress: TeamGameProgress): {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterHand: number
} {
  const teamId = progress.options.ourTeamId
  const batter = currentBatterEntry(progress)
  if (batter === undefined) return { batterForm: 0, batterSkinIndex: 0, batterHand: 0 }
  const profile = batter.aceIndex >= 0 ? aceBatterProfileOf(batter.aceIndex) : (batterProfileOf(teamId, batter) ?? 0)
  return { batterForm: profile >> 4, batterSkinIndex: (profile >> 2) & 3, batterHand: teamBatterHandOf(teamId, batter) }
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

/**
 * **팀경기 상태 0xe 의 소개 판 값** (0x44944) — 투수 `0xae83c(수비 팀)` · 타자 `0xae89c(공격 팀)` 레코드에서.
 * - 팀 글자 `0xb6c20(st, 측)`: 우리가 치면 타자 PLAYER · 투수 COM, 던지면 반대.
 * - 투수: 이름 · 보직 `+0xb & 3` · 손 0xb63c0(폼 & 1, 마투수 표) · 체력 막대(용량 0x66e44 · % 0xaebb0) ·
 *   방어율 0xb6ce8 · 탈삼진 +0x26.
 * - 타자: 타순 `팀+0x32` · 이름 · 수비 `+0x1c & 0xf` · 손 0xb63c0 · 타율 0xb8e3c · 홈런 +0x28 · 타점 +0x2a ·
 *   오늘 타석 기록 = 그 타순 칸 기록의 링(`BatterGameRecord.results`).
 * - 시즌 줄(방어율·탈삼진·타율·홈런·타점)은 `records` 를 줄 때만 적는다 — 시즌 레코드 = 리그 기록표 줄 + (게이트가 열렸으면)
 *   이 경기 줄. 일반(1)은 Xls 행의 줄(행 바이트 32~43, `XLS_ROW_MATCHUP_RECORDS`) — 게이트가 늘 거짓이라 경기 중에도 안 오른다.
 *   마선수는 모든 모드에서 XlsACE 행의 줄이다. ⚠️ 대전(8 · 9)은 웹에 없다.
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

  const pitcherStats = pitcherEntry === undefined ? null : teamPitcherSeasonStatsOf(progress, records, fieldingTeam, pitcherEntry)
  const batterStats = batterEntry === undefined ? null : teamBatterSeasonStatsOf(progress, records, battingTeam, batterEntry)

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
      ...(pitcherStats ?? {}),
    },
    batter: {
      isComputer: !ourBatting,
      battingOrder: slot % 9,
      recentResults: entryRecords[slot]?.results ?? [],
      ...(batterEntry === undefined ? {} : { name: batterEntry.name, position: batterEntry.position }),
      ...(batterStats ?? {}),
    },
  }
}

/**
 * **사람이 던지는 타석 장면의 그림 재료** (`PitcherSideStage`) — 타자 `0xae89c(공격 팀 = 상대)` · 투수 `0xae83c(수비 팀 = 우리)`.
 * 타자: 폼 `rec[0xb] >> 4`(몸통 · 자세 · 손) · 피부 `(rec[0xb] >> 2) & 3` · 팀. 마타자는 XlsACE_BAT_DATA +0xb
 * (`aceBatterProfileOf`) · 손 표 0xd88b0. 표 밖 선수(영입한 명전·나리)는 웹 명단에 폼 칸이 없어 0.
 * 투수: 폼 · 손 0xb63c0. 타석 교대 0x47cc8 이 마운드 그림(장면 +0xf1c)을 다시 싣는다 — 마투수(0xb633c)면 0x482fc 의 적재 0x793b0 이
 * 순번 0xb63a0 으로 `ace/pitcher_*` 를(`acePitcher`), 아니면 48138~4816a 가 레코드 +0x19 · +0x1a 니블 − 1 로 장비 겹 0x79790 을
 * (`pitcherEquipment`) 싣는다. 투수편 · 투수 미션(0x108f8 → 0x10810 → 0x79790)과 같은 겹이다.
 */
export function teamPitcherSideStageOf(progress: TeamGameProgress): {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  readonly batterSide?: number
  readonly aceBatterOrder?: number
  readonly pitcherForm: number
  readonly pitcherHand: number
  readonly pitcherEquipment?: PitcherEquipment
  readonly acePitcher: AcePitcherFrames | null
} {
  const teamId = progress.options.opponentTeamId
  const batter = progress.opponentEntry[progress.opponentOrderIndex]
  const pitcher = progress.ourPitcherEntry[progress.ourPitcherIndex]
  const pitcherForm = pitcher?.repertoire.form ?? 0
  const pitcherHand = pitcher === undefined ? 0 : pitcherHandOf(pitcherForm, pitcher.aceIndex >= 0)
  const ace = pitcher === undefined ? undefined : ACE_PITCHERS[pitcher.aceIndex]
  const mound = {
    pitcherForm,
    pitcherHand,
    acePitcher: ace === undefined ? null : acePitcherFramesOf(ace),
    ...(ace !== undefined || pitcher?.equipment === undefined ? {} : { pitcherEquipment: pitcherEquipmentOfNibbles(pitcher.equipment) }),
  }
  if (batter === undefined) return { batterForm: 0, batterSkinIndex: 0, batterTeamIndex: teamId, ...mound }
  if (batter.aceIndex >= 0) {
    const profile = aceBatterProfileOf(batter.aceIndex)
    return {
      batterForm: profile >> 4,
      batterSkinIndex: (profile >> 2) & 3,
      batterTeamIndex: teamId,
      batterSide: teamBatterHandOf(teamId, batter),
      aceBatterOrder: batter.aceIndex,
      ...mound,
    }
  }
  const profile = batterProfileOf(teamId, batter) ?? 0
  return { batterForm: profile >> 4, batterSkinIndex: (profile >> 2) & 3, batterTeamIndex: teamId, ...mound }
}

