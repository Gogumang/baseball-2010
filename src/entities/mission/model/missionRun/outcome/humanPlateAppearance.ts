import type { OriginalMission } from '@/shared/config/original/missions'
import { humanSideOf, withMissionScore, type MissionGame, type MissionTeamBatting } from '@/entities/mission/model/missionGame'
import { lineupSlotOf, recordLineupPlay, type AtBatOutcome } from '@/entities/mission/model/missionRun/otherSlices'

/**
 * 사람 칸 팀 타석 하나가 끝났다 — 정산 0xa8024 가 그 타순 칸 기록을 올리고 0xaf020 이 타순을 (+1) mod 9 로 넘긴다.
 * 점수판 득점(0xa5c34)은 사람 칸 측, 3아웃이면 0x18 · 자동진행을 기다린다.
 */
export function afterHumanPlateAppearance(
  game: MissionGame,
  mission: OriginalMission,
  outcome: AtBatOutcome | null,
  runs: number,
  inningEnded: boolean,
): MissionGame {
  const scored = withMissionScore(game, humanSideOf(mission), runs)
  return {
    ...scored,
    humanBatting: battingAfterPlateAppearance(game.humanBatting, outcome),
    halfEnded: scored.halfEnded || inningEnded,
  }
}

/** 타석 결과가 있으면(견제 판은 없다) 그 타순 칸 기록을 올리고 다음 타순으로 */
function battingAfterPlateAppearance(batting: MissionTeamBatting, outcome: AtBatOutcome | null): MissionTeamBatting {
  if (outcome === null) return batting
  return { ...batting, lineup: recordLineupPlay(batting.lineup, batting.order, outcome), order: lineupSlotOf(batting.order + 1) }
}

/** 타자가 살아 나간 결과 종류 — 안타 · 볼넷 · 사구 (운명이 없을 때만 본다) */
export function isBatterReachedKind(kind: AtBatOutcome['kind']): boolean {
  return kind === '안타' || kind === '볼넷' || kind === '사구'
}
