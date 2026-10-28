import { MAXIMUM_LOG_LENGTH } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameLogEntry } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/logTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

export function appendLog(progress: PitcherGameProgress, text: string, isMine: boolean): PitcherGameProgress {
  const entry: PitcherGameLogEntry = { id: progress.nextLogId, text, isMine }
  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}
