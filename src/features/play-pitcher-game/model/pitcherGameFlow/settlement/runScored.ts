import { applyRunScored, type DecisionState, REGULATION_LAST_INNING_INDEX } from '@/entities/game/model/winLossSave'
import {
  MY_PITCHER_NUMBER,
  opponentPitcherNumberOf,
  teammatePitcherNumberOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 우리 마운드 지금 투수의 표지 — 내가 던지고 있으면 나, 아니면 그 동료 (0xa5c34 는 측의 현재 투수를 적는다) */
function ourMoundPitcherNumberOf(progress: PitcherGameProgress, meOnMound: boolean): number {
  return meOnMound ? MY_PITCHER_NUMBER : teammatePitcherNumberOf(progress.ourMound.pitcherSlot)
}

/** 한 점이 들어올 때마다 승·패·세이브 칸을 다시 잡는다 (0xa5c34) */
export function applyRunScoredFor(progress: PitcherGameProgress, decision: DecisionState, runIndex: number, mine: boolean): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const opponentScore = game.opponentScore + runIndex
  const ourPitcher = ourMoundPitcherNumberOf(progress, mine)
  const opponentPitcher = opponentPitcherNumberOf(progress.opponentMound.pitcherSlot)
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: opponentSide,
    defenseSide: ourSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : opponentScore),
    moundPitcherOf: (side) => (side === ourSide ? ourPitcher : opponentPitcher),
  })
}

/** 상대 공격의 득점 `runs` 점을 차례로 먹인 승·패·세이브 칸 */
export function decisionAfterRunsOf(progress: PitcherGameProgress, runs: number, mine: boolean): DecisionState {
  let decision = progress.decision
  for (let run = 1; run <= runs; run += 1) {
    decision = applyRunScoredFor(progress, decision, run, mine)
  }
  return decision
}

/** 우리 팀 공격에서 점수가 날 때도 같은 함수가 돈다 (공격·수비가 뒤바뀐 인자) */
export function applyRunScoredForOffense(progress: PitcherGameProgress, decision: DecisionState, runIndex: number): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const ourScore = game.ourScore + runIndex
  // 우리 공격 중에도 우리 "지금 투수" 는 우리 마운드에 선 투수다 — 내가 마운드에 있으면 나
  const ourPitcher = ourMoundPitcherNumberOf(progress, progress.onMound)
  const opponentPitcher = opponentPitcherNumberOf(progress.opponentMound.pitcherSlot)
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: ourSide,
    defenseSide: opponentSide,
    scoreOf: (side) => (side === ourSide ? ourScore : game.opponentScore),
    moundPitcherOf: (side) => (side === ourSide ? ourPitcher : opponentPitcher),
  })
}

/** 우리 공격의 득점 `runs` 점을 차례로 먹인 승·패·세이브 칸 */
export function decisionAfterOffenseRunsOf(progress: PitcherGameProgress, runs: number): DecisionState {
  let decision = progress.decision
  for (let run = 1; run <= runs; run += 1) {
    decision = applyRunScoredForOffense(progress, decision, run)
  }
  return decision
}
