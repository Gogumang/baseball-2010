import { MISSION_ACE_ROSTER_SLOT, type MissionAcePitcher, type MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import type { MissionAutoRelayCards } from '@/entities/mission/model/missionAutoRelay'
import { battingRecordAt, isMissionGameOver } from '@/entities/mission/model/missionGame/board/board'
import {
  rosterSlotAt,
  teamBatters,
  teamPitchers,
  type HalfInningPlateAppearance,
  type HalfInningTick,
  type QuickLineup,
} from '@/entities/mission/model/missionGame/otherSlices'
import { LINEUP_SLOTS, MISSION_NARI_RECORD, type MissionGame, type MissionTeamBatting } from '@/entities/mission/model/missionGame/types'

type BatterRows = ReturnType<typeof teamBatters>

/** 중계 틱이 읽는 이름 · 두 팀 판 (`missionAutoRelayStepOfTick` 의 `nameOf` · `cardsOf`) */
interface MissionRelayNamers {
  readonly nameOf: (appearance: HalfInningPlateAppearance) => string
  readonly cardsOf: (tick: HalfInningTick, scores: readonly [number, number]) => MissionAutoRelayCards
}

/** 레코드 칸에 든 마스터 줄 (미션 타자 표지면 그 표지) */
function rowAtRecord(batting: MissionTeamBatting, record: number): number {
  return batting.records[record] ?? record
}

/** 수비 팀 지금 투수 이름 — 마투수 칸이면 그 마투수 */
function pitcherNameOf(
  pitching: MissionCpuPitching,
  pitcherRows: ReturnType<typeof teamPitchers>,
  ace: MissionAcePitcher | undefined,
  slot: number | undefined,
): string | null {
  if (slot === undefined) return null
  const row = pitching.roster[slot] ?? slot
  if (row === MISSION_ACE_ROSTER_SLOT) return ace?.name ?? null
  return pitcherRows[row]?.name ?? null
}

/** 그 타순 칸 타자 이름 — 미션 타자 칸은 그 선수(0x1fc20 사본) 자신의 이름이라 판은 이름을 안 들어 그리는 쪽이 채운다(`dueUpIsMissionBatter`) */
function batterNameAt(batting: MissionTeamBatting, rows: BatterRows, lineup: QuickLineup, lineupSlot: number): string | null {
  const row = rowAtRecord(batting, rosterSlotAt(lineup, lineupSlot))
  if (row === MISSION_NARI_RECORD) return null
  return rows[Math.max(0, row) % rows.length]?.name ?? null
}

/** 0x21 두 팀 판 — 수비 팀 지금 투수 이름 · 공격 팀 타순 칸 세 줄 (`MissionAutoRelayCards`) */
function relayCardsOf(
  game: MissionGame,
  batting: MissionTeamBatting,
  rows: BatterRows,
  pitcherName: (slot: number | undefined) => string | null,
): MissionRelayNamers['cardsOf'] {
  return (tick, scores) => {
    const currentOrder = tick.battingOrderIndex % LINEUP_SLOTS
    const lineup = tick.lineup ?? batting.lineup
    const dueUpSlots = [0, 1, 2].map((row) => (currentOrder + row) % LINEUP_SLOTS)
    const isPlateAppearance = tick.kind === 'plateAppearance'
    return {
      pitcherName: pitcherName(tick.pitcherSlot),
      strikes: isPlateAppearance ? tick.strikes : 0,
      balls: isPlateAppearance ? tick.balls : 0,
      outs: tick.outs,
      currentOrder,
      dueUpNames: dueUpSlots.map((slot) => batterNameAt(batting, rows, lineup, slot)),
      dueUpIsMissionBatter: dueUpSlots.map((slot) => battingRecordAt({ ...batting, lineup }, slot) === MISSION_NARI_RECORD),
      gameOver: isMissionGameOver({ ...game, scores: [scores[0], scores[1]] }, tick.outs),
    }
  }
}

/** 자동진행 반 이닝 중계가 읽는 이름 — 0xc25e4 타석 이름 0xb62c0 · 0x21 두 팀 판 */
export function missionRelayNamersOf(
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
  ace: MissionAcePitcher | undefined,
  rows: BatterRows,
): MissionRelayNamers {
  const pitcherRows = teamPitchers(pitching.teamId)
  return {
    // 0xc25e4 — 그 타석에 선 레코드 칸(대타 포함)의 이름 0xb62c0. 미션 타자 표지는 멈춤 갈래가 먼저 걸러 여기 안 온다
    nameOf: (appearance) => {
      const row = rowAtRecord(batting, appearance.rosterSlot ?? rosterSlotAt(batting.lineup, appearance.battingOrderIndex))
      return rows[Math.max(0, row) % rows.length]?.name ?? ''
    },
    cardsOf: relayCardsOf(game, batting, rows, (slot) => pitcherNameOf(pitching, pitcherRows, ace, slot)),
  }
}
