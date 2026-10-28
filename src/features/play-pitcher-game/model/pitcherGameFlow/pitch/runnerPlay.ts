import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { finishPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { applyPitcherArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/applyPitcherArrival'
import { afterMyPitchArrival } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchArrival'
import { applyPickoffResult } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/pickoff'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * **실시간 주자 판이 끝났다** — 화면이 키(+0x160)를 받으며 다 돌린 도루 · 폭투 · 견제 판(`pendingRunnerPlay`)의 결과를
 * 경기에 먹이고 투구 흐름을 잇는다. 이미 눈으로 본 판이라 재생 칸(`lastDefensePlay`)에는 다시 안 넣는다.
 */
export function resolveRunnerPlay(progress: PitcherGameProgress, result: DefensePlayResult, random: RandomPort): PitcherGameProgress {
  const pending = progress.pendingRunnerPlay
  if (pending == null) return progress
  const cleared: PitcherGameProgress = { ...progress, pendingRunnerPlay: null }
  if (pending.kind === 'pickoff') {
    if (!isPickoffPlayResult(result)) return cleared
    return applyPickoffResult(cleared, pending.input.targetBase, result, random, true)
  }
  const play = finishPitchArrivalPlay(pending.opened, result as RunnerPlayEngineResult, true)
  return afterMyPitchArrival(applyPitcherArrival(cleared, play), pending.resume ?? { buntKind: 0 }, random)
}
