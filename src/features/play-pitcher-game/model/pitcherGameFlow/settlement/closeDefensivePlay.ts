import type { GameState } from '@/entities/game/model/gameState'
import { type AtBatOutcome, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { clearInningRuns, type OpponentAtBatResult } from '@/features/play-pitcher-game/model/pitcherGameState'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** `applyDefensivePlay` 의 끝 — 반 이닝이 바뀌었으면 이닝 칸 · 삼자범퇴 표시 · ctx+0x16c 를 다시 세우고 기록 줄을 남긴다 */
export function closeDefensivePlay(
  resolved: PitcherGameProgress,
  before: GameState,
  applied: OpponentAtBatResult,
  slot: number,
  outcome: AtBatOutcome,
  mine: boolean,
): PitcherGameProgress {
  const halfChanged = applied.game.half !== before.half || applied.game.inning !== before.inning
  const closed: PitcherGameProgress = halfChanged
    ? {
        ...resolved,
        // 이닝 칸을 비우고 삼자범퇴 표시를 다시 세운다
        inningRuns: clearInningRuns(resolved.inningRuns, applied.game.inning),
        perfectInningFlag: true,
        // ctx+0x16c 는 반 이닝이 시작할 때 0 이 된다 (0xa5b00)
        halfInningPitches: 0,
      }
    : resolved

  return appendLog(
    closed,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}
