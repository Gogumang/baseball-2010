import { type AtBatOutcome, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { clearInningRuns } from '@/features/play-pitcher-game/model/pitcherGameState'
import type { DefensivePlayFacts } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayFacts'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import { isHalfInningChanged } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/halfInning'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** `applyDefensivePlay` 의 끝 — 반 이닝이 바뀌었으면 이닝 칸 · 삼자범퇴 표시 · ctx+0x16c 를 다시 세우고 기록 줄을 남긴다 */
export function closeDefensivePlay(resolved: PitcherGameProgress, facts: DefensivePlayFacts, outcome: AtBatOutcome): PitcherGameProgress {
  const { before, applied } = facts
  const closed = isHalfInningChanged(before, applied.game) ? withNewHalfInning(resolved, applied.game.inning) : resolved
  const runs = applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
  return appendLog(closed, `${before.inning}회${before.half} 상대 ${facts.slot + 1}번 — ${describeOutcome(outcome)}${runs}`, facts.mine)
}

/** 이닝 칸을 비우고 삼자범퇴 표시를 다시 세운다 — ctx+0x16c 는 반 이닝이 시작할 때 0 이 된다 (0xa5b00) */
function withNewHalfInning(progress: PitcherGameProgress, inning: number): PitcherGameProgress {
  return {
    ...progress,
    inningRuns: clearInningRuns(progress.inningRuns, inning),
    perfectInningFlag: true,
    halfInningPitches: 0,
  }
}
