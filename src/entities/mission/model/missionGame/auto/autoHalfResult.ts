import type { MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { isMissionGameOver } from '@/entities/mission/model/missionGame/board/board'
import {
  EMPTY_BASE_RUNNERS,
  EMPTY_BASES,
  FRESH_HELD_CPU_MAGIC,
  heldCpuMagicAfterPitcherChange,
  lineupSlotOf,
  type BaseRunners,
  type HalfInningResult,
} from '@/entities/mission/model/missionGame/otherSlices'
import type { MissionAutoHalf, MissionGame, MissionTeamBatting } from '@/entities/mission/model/missionGame/types'

/** 간이 엔진 타순 커서 신원 → 타순 칸 (0~8) */
function slotRunnersOf(runners: BaseRunners): BaseRunners {
  const slot = (cursor: number | null) => (cursor === null ? null : lineupSlotOf(cursor))
  return { first: slot(runners.first), second: slot(runners.second), third: slot(runners.third) }
}

/** A(+0x284) — 멈춘 반 이닝이면 마지막 교체 뒤 이 반 이닝 실점이 남는다 */
function inningRunsAllowedOf(result: HalfInningResult): number {
  const lastChange = result.pitcherChanges?.[result.pitcherChanges.length - 1]
  return result.runs - (lastChange?.runsBefore ?? 0)
}

/** 간이 엔진 교체(0xc1ba4 → 0xac428 ac644 → 0xaf09c af0d4 → 0xaebe4 aec7a)도 +0x28 을 −1 로 비운다 — 교체가 없었으면 칸을 안 싣는다 */
function magicAfterChangesOf(pitching: MissionCpuPitching, result: HalfInningResult): Pick<MissionCpuPitching, 'magic'> {
  if ((result.pitcherChanges?.length ?? 0) <= 0) return {}
  return { magic: heldCpuMagicAfterPitcherChange(pitching.magic ?? FRESH_HELD_CPU_MAGIC) }
}

/** 수비 투수진 — 마운드 · 이 반 이닝 실점 A · 교체가 있었으면 마구 칸 */
function pitchingAfterHalf(pitching: MissionCpuPitching, result: HalfInningResult): MissionCpuPitching {
  const inningRunsAllowed = inningRunsAllowedOf(result)
  return {
    ...pitching,
    mound: result.mound ?? pitching.mound,
    inningRunsAllowed,
    ...magicAfterChangesOf(pitching, result),
  }
}

/** 간이 엔진 반 이닝 끝 → 미션 자동진행 반 이닝 하나의 끝 */
export function missionAutoHalfOf(
  result: HalfInningResult,
  game: MissionGame,
  batting: MissionTeamBatting,
  pitching: MissionCpuPitching,
): MissionAutoHalf {
  const pitchingAfter = pitchingAfterHalf(pitching, result)
  const scores: [number, number] = [game.scores[0], game.scores[1]]
  scores[game.offenseSide] += result.runs
  return {
    batting: { ...batting, lineup: result.lineup ?? batting.lineup, order: result.nextBattingOrderIndex },
    pitching: pitchingAfter,
    runs: result.runs,
    outs: result.outs,
    bases: result.bases ?? EMPTY_BASES,
    runners: slotRunnersOf(result.runners ?? EMPTY_BASE_RUNNERS),
    gameEnded: result.gameEnded === true || isMissionGameOver({ ...game, scores }, result.outs),
    stoppedBeforeNari: result.stoppedBeforeBatter === true,
  }
}
