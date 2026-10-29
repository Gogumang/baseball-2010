import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { currentBatterEntry, isOurOffense, moundStaminaOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { staminaGaugeOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { teamBatterHandOf } from './batterLooks'
import { teamBatterSeasonStatsOf } from './batterSeasonLine'
import type { TeamMatchupRecords } from './matchupRecords'
import { teamPitcherSeasonStatsOf } from './pitcherSeasonLine'

export interface TeamMatchupCards {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/** 투수 칸 — 이름 · 보직 `+0xb & 3` · 손 0xb63c0(폼 & 1, 마투수 표) · 체력 막대(용량 0x66e44 · % 0xaebb0) */
function pitcherFaceOf(progress: TeamGameProgress, pitcherEntry: TeamEntryPitcher | undefined, ourBatting: boolean) {
  if (pitcherEntry === undefined) return {}
  return {
    name: pitcherEntry.name,
    ...(pitcherEntry.role === undefined ? {} : { role: pitcherEntry.role }),
    throwsLeft: pitcherHandOf(pitcherEntry.repertoire.form, pitcherEntry.aceIndex >= 0) === 1,
    stamina: staminaGaugeOf(moundStaminaOf(progress, !ourBatting)),
  }
}

/** 소개 판에 선 두 사람 — 공격 팀 지금 타자와 수비 팀 마운드 투수 */
function matchupEntriesOf(progress: TeamGameProgress, ourBatting: boolean) {
  const { options } = progress
  return {
    battingTeam: ourBatting ? options.ourTeamId : options.opponentTeamId,
    fieldingTeam: ourBatting ? options.opponentTeamId : options.ourTeamId,
    batterEntry: ourBatting ? currentBatterEntry(progress) : progress.opponentEntry[progress.opponentOrderIndex],
    pitcherEntry: ourBatting ? progress.opponentPitcherEntry[progress.opponentPitcherIndex] : progress.ourPitcherEntry[progress.ourPitcherIndex],
    slot: ourBatting ? progress.game.battingOrderIndex : progress.opponentOrderIndex,
    entryRecords: ourBatting ? progress.ourEntryRecords : progress.opponentEntryRecords,
  }
}

/** 시즌 줄 값 두 칸 — 기록표를 안 줬거나 칸이 비면 null */
function seasonStatsOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, entries: ReturnType<typeof matchupEntriesOf>) {
  const { pitcherEntry, batterEntry } = entries
  return {
    pitcherStats: pitcherEntry === undefined ? null : teamPitcherSeasonStatsOf(progress, records, entries.fieldingTeam, pitcherEntry),
    batterStats: batterEntry === undefined ? null : teamBatterSeasonStatsOf(progress, records, entries.battingTeam, batterEntry),
  }
}

/** 타자 칸의 이름 · 수비 `+0x1c & 0xf` */
const batterFaceOf = (batterEntry: TeamEntryBatter | undefined) =>
  batterEntry === undefined ? {} : { name: batterEntry.name, position: batterEntry.position }

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
  const entries = matchupEntriesOf(progress, ourBatting)
  const { batterEntry, slot } = entries
  const batterHand = batterEntry === undefined ? 0 : teamBatterHandOf(entries.battingTeam, batterEntry)
  const { pitcherStats, batterStats } = seasonStatsOf(progress, records, entries)
  return {
    batterHand,
    pitcher: { isComputer: ourBatting, ...pitcherFaceOf(progress, entries.pitcherEntry, ourBatting), ...(pitcherStats ?? {}) },
    batter: {
      isComputer: !ourBatting,
      battingOrder: slot % 9,
      recentResults: entries.entryRecords[slot]?.results ?? [],
      ...batterFaceOf(batterEntry),
      ...(batterStats ?? {}),
    },
  }
}
