import { applyRunScored, type DecisionState, REGULATION_LAST_INNING_INDEX } from '@/entities/game/model/winLossSave'
import {
  MY_PITCHER_NUMBER,
  opponentPitcherNumberOf,
  teammatePitcherNumberOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 한 점이 들어올 때마다 승·패·세이브 칸을 다시 잡는다 (0xa5c34) */
export function applyRunScoredFor(progress: PitcherGameProgress, decision: DecisionState, runIndex: number, mine: boolean): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const opponentScore = game.opponentScore + runIndex
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: opponentSide,
    defenseSide: ourSide,
    scoreOf: (side) => (side === ourSide ? game.ourScore : opponentScore),
    moundPitcherOf: (side) =>
      side === ourSide
        ? mine
          ? MY_PITCHER_NUMBER
          : teammatePitcherNumberOf(progress.ourMound.pitcherSlot)
        : opponentPitcherNumberOf(progress.opponentMound.pitcherSlot),
  })
}

/** 우리 팀 공격에서 점수가 날 때도 같은 함수가 돈다 (공격·수비가 뒤바뀐 인자) */
export function applyRunScoredForOffense(progress: PitcherGameProgress, decision: DecisionState, runIndex: number): DecisionState {
  const game = progress.game
  const ourSide = game.playerSide
  const opponentSide = 1 - ourSide
  const ourScore = game.ourScore + runIndex
  return applyRunScored(decision, {
    inningIndex: game.inning - 1,
    lastInningIndex: REGULATION_LAST_INNING_INDEX,
    offenseSide: ourSide,
    defenseSide: opponentSide,
    scoreOf: (side) => (side === ourSide ? ourScore : game.opponentScore),
    // 우리 공격 중에도 우리 "지금 투수" 는 우리 마운드에 선 투수다 — 내가 마운드에 있으면 나 (0xa5c34 는 측의 현재 투수를 적는다)
    moundPitcherOf: (side) =>
      side === ourSide
        ? progress.onMound
          ? MY_PITCHER_NUMBER
          : teammatePitcherNumberOf(progress.ourMound.pitcherSlot)
        : opponentPitcherNumberOf(progress.opponentMound.pitcherSlot),
  })
}
