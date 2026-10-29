import { isGameOverAt, rosterSlotAt } from '@/entities/mission/model/missionGame/otherSlices'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { clearMissionInningRuns, scoreMissionRuns } from '@/entities/mission/model/missionScoreboard'
import type { MissionGame, MissionTeamBatting } from '@/entities/mission/model/missionGame/types'

/** 한 번의 자동진행이 끝났다 — 그 동안의 중계 틱을 새 `serial` 로 싣는다 */
export function withMissionAutoRelay(game: MissionGame, steps: readonly MissionAutoRelayStep[]): MissionGame {
  return { ...game, autoRelay: { serial: (game.autoRelay?.serial ?? 0) + 1, steps } }
}

/** 점수판 득점 (0xa5c34 → 0xb6a9c 한 점씩) — 그 측 합과 지금 이닝 칸에 더한다 (98 이하일 때만 오른다) */
export function withMissionScore(game: MissionGame, side: 0 | 1, runs: number): MissionGame {
  if (runs <= 0) return game
  const board = scoreMissionRuns(game, game.inning, side, runs)
  return { ...game, scores: board.scores, inningRuns: board.inningRuns }
}

/** **경기 끝 판정 0xb68fc** — 지금 반 이닝 · 주어진 아웃(3아웃 판 끝이면 3)으로 */
export function isMissionGameOver(game: MissionGame, outs: number, scores: readonly [number, number] = game.scores): boolean {
  return isGameOverAt({
    inning: game.inning + 1,
    half: game.offenseSide === 0 ? '초' : '말',
    outs,
    awayScore: scores[0],
    homeScore: scores[1],
  })
}

/**
 * **반 이닝 넘김 0xb6b6c** — 말이 끝났으면 이닝 +1 하고 새 이닝 두 칸을 0 으로(b6b92 · b6ba0), 공격 측을 뒤집는다
 * (주자 · 아웃은 부르는 쪽이 비운다)
 */
export function flipMissionHalf(game: MissionGame): MissionGame {
  if (game.offenseSide === 0) return { ...game, offenseSide: 1 }
  const inning = game.inning + 1
  return { ...game, inning, offenseSide: 0, inningRuns: clearMissionInningRuns(game.inningRuns, inning) }
}

/** 그 타선의 지금 타순 칸에 선 레코드 (마스터 줄 · 미션 타자 표지) */
export function battingRecordAt(batting: MissionTeamBatting, order: number = batting.order): number {
  const record = rosterSlotAt(batting.lineup, order)
  return batting.records[record] ?? record
}
