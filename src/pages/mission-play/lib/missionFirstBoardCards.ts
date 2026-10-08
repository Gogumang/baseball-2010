import type { MissionRun } from '@/entities/mission/model/missionRun'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import type { MissionTeamBatting } from '@/entities/mission/model/missionGame'
import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuBatting, MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { dueUpLineupSlotOf } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'

/** DUE UP 줄 수 (0x4245e i = 0..2) */
const DUE_UP_ROWS = 3
/** 타순 칸 수 */
const LINEUP_SIZE = 9

/** 미션 판에 없는 두 선수의 이름 — 0xb62c0 이 그 선수 기록 +1 을 주는 사람 선수 (그리는 쪽이 안다) */
export interface MissionBoardPlayerNames {
  /** 타자 미션의 미션 타자 0x1fc20 (나리 타자편 저장 선수 또는 명예 타자) */
  readonly missionBatter: string | null
  /** 투수 미션의 미션 투수 0x1fbd0 (나리 투수편 저장 선수 또는 명예 투수) */
  readonly missionPitcher: string | null
}

/** 사람 칸 팀 타순 칸의 이름 — 미션 타자 표지면 그 선수, 아니면 마스터 팀 타자 줄 */
function humanBatterNameAt(batting: MissionTeamBatting, lineupSlot: number, missionBatter: string | null): string | null {
  const record = rosterSlotAt(batting.lineup, lineupSlot)
  const row = batting.records[record] ?? record
  if (row === MISSION_NARI_RECORD) return missionBatter
  const rows = teamBatters(batting.teamId)
  return rows[Math.max(0, row) % rows.length]?.name ?? null
}

/** CPU 타선 타순 칸의 이름 — 마타자 칸(0xaae7c 가 끼운 레코드)이면 그 마타자, 아니면 마스터 팀 타자 줄 */
function cpuBatterNameAt(batting: MissionCpuBatting, lineupSlot: number, aceOrder: number): string | null {
  const record = rosterSlotAt(batting.lineup, lineupSlot)
  const row = batting.records[record] ?? record
  if (row === MISSION_ACE_ROSTER_SLOT) return missionOpponentOf('타자', aceOrder)?.name ?? null
  return teamBatters(batting.teamId)[row]?.name ?? null
}

/** CPU 마운드의 지금 투수 — 마투수 칸(0xaae7c 가 0 ↔ 8 로 세운)이면 그 마투수, 아니면 마스터 팀 투수 줄 */
function cpuPitcherName(pitching: MissionCpuPitching, aceOrder: number): string | null {
  const slot = pitching.mound.pitcherSlot
  const row = pitching.roster[slot] ?? slot
  if (row === MISSION_ACE_ROSTER_SLOT) return missionOpponentOf('투수', aceOrder)?.name ?? null
  return teamPitchers(pitching.teamId)[row]?.name ?? null
}

/**
 * **미션 시작의 첫 0x18 판의 두 팀 판 값** (그리기 0x4fe9c 교대 가지 0x4ff16~0x5001a → 0x420dc "PITCHER" · 0x42364 "DUE UP").
 *
 * 판이 서는 그림의 경기 칸은 상태 8 끝(48c86)이 0x18 앞에 깐 그대로다:
 * - st[9] — 0xaa57c aa6ac: 모드 5(투수 미션) 공격 = 다른 칸(CPU), 모드 6(타자 미션) 공격 = 사람 칸 (`run.game.offenseSide`).
 * - st[4] · st[5] · st[6] — 48c86 의 0xaae7c(…, 0xd, 0x18, 0) aaf70~aaf8a 가 레코드 +4 를 스트라이크(비트 4~5) · 볼(2~3) · 아웃(0~1)으로
 *   깐다. 0x18 진입 0x3ac90 의 0xb67d0 은 이 세 칸을 안 지우고(b67d0~b6810 은 +0 · +7 · +0xb~+0x13 · +0x1a~+0x1f · +0x20 · +0x25 · +0x80 · +0x87 · +0x8b 만)
 *   시작 아웃 ≤ 2 라 0xb6b6c 도 안 뒤집는다 → **미션 시작 카운트가 판의 점으로 남는다**(보통의 교대 판은 빈 카운트).
 * - PITCHER = 수비 팀 지금 투수 0xae83c(팀[st[0xa]]) → 0xb62c0: 타자 미션은 CPU 마운드(0xaa57c aa8a0 0xb8c94 가 세운 선발 칸, 마투수면
 *   48c86 0xaae7c 가 0 ↔ 8 로 세운 그 마투수), 투수 미션은 미션 투수(aa81c~aa878 이 0번에 세운 0x1fbd0).
 * - DUE UP = 공격 팀 타순 칸 (팀[+0x32] + i) mod 9 의 0xae914 → 0xb62c0: 타자 미션은 사람 칸 팀(미션 타자 칸 포함 — aa7e8 · aa88c),
 *   투수 미션은 CPU 타선(마타자면 0xaae7c ab078~ 가 지금 타순 레코드에 끼운 그 마타자).
 * - 타석 준비 0x3d954 의 CPU 교체는 판 뒤 0xe OK 다음이라 판은 바뀌기 앞 이름이다.
 */
export function missionFirstBoardCardsOf(run: MissionRun, names: MissionBoardPlayerNames): HalfInningCardsData {
  const { mission, game, cpu } = run
  const count = { strikes: mission.start.strikes, balls: mission.start.balls, outs: mission.start.outs }
  if (mission.side === '타자') {
    const batting = game.humanBatting
    const currentOrder = ((batting.order % LINEUP_SIZE) + LINEUP_SIZE) % LINEUP_SIZE
    return {
      battingSide: game.offenseSide,
      count,
      pitcherName: cpu.pitching === null ? null : cpuPitcherName(cpu.pitching, mission.opponentAce),
      currentOrder,
      dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) =>
        humanBatterNameAt(batting, dueUpLineupSlotOf(currentOrder, row), names.missionBatter)),
    }
  }
  const batting = cpu.batting
  const currentOrder = batting === null ? 0 : ((batting.order % LINEUP_SIZE) + LINEUP_SIZE) % LINEUP_SIZE
  return {
    battingSide: game.offenseSide,
    count,
    pitcherName: names.missionPitcher,
    currentOrder,
    dueUpNames: Array.from({ length: DUE_UP_ROWS }, (_unused, row) =>
      batting === null ? null : cpuBatterNameAt(batting, dueUpLineupSlotOf(currentOrder, row), mission.opponentAce)),
  }
}
