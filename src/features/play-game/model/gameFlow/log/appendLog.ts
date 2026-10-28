import { MAXIMUM_LOG_LENGTH } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameLogEntry, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

export function appendLog(progress: GameProgress, text: string, isMine: boolean): GameProgress {
  const entry: GameLogEntry = { id: progress.nextLogId, text, isMine }

  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}
