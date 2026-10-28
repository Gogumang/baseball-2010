import { type GameState, runnersOfGame } from '@/entities/game/model/gameState'
import type { OpponentAtBatResult } from '@/features/play-pitcher-game/model/pitcherGameState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { AdvanceResult } from '@/entities/game/model/baseState'
import { type BaseRunners, EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import {
  chargeMoundLine,
  chargeRunsToResponsible,
  scoredFromBasesOfAtBat,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** `finishDefensiveAtBat` 의 정산 0xa8024 우리 마운드 투수 줄 · 책임 투수 실점 — 몸통에서 그대로 떼어 냈다(r344) */
export function defensiveAtBatChargesOf(
  progress: TeamGameProgress,
  before: GameState,
  applied: OpponentAtBatResult,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  quick: { readonly advance: AdvanceResult; readonly runners: BaseRunners; readonly stolenRunners: readonly number[] } | undefined,
  droppedThirdStrike: boolean,
  walk: boolean,
) {
  return chargeRunsToResponsible(
    progress,
    chargeMoundLine(progress, true, {
      // 낫아웃은 a8cb0 이 삼진 사건까지 더하고 보정(−1)은 R+0x13c · R[3] 에만 건다 — +0x20 이 하나 많다(원본 그대로)
      outs: applied.outsAdded + (droppedThirdStrike ? 1 : 0),
      strikeouts: outcome.kind === '삼진' ? 1 : 0,
      // a8b04~a8bee — 사람 수비 타석의 볼넷 · 사구도 지금 마운드(우리) 투수 +0x2a. 간이 타석(`quick`)의 포볼 c1918 은 볼을
      // 3 에서 안 올려(판정 0x9d57c · c18d4) `state[5] > 3` 이 서지 않는다 — 안 센다
      walks: walk && quick === undefined ? 1 : 0,
    }),
    applied.game,
    true,
    lineupSlotOf(progress.opponentOrderIndex),
    scoredFromBasesOfAtBat(
      before,
      runnersOfGame(before, progress.opponentOrderIndex),
      applied.game.inning === before.inning && applied.game.half === before.half
        ? runnersOfGame(applied.game, applied.opponentOrderIndex)
        : EMPTY_BASE_RUNNERS,
      outcome,
      defensePlay,
      quick !== undefined,
      applied.outsAdded,
      applied.runsScored,
    ),
  )
}
