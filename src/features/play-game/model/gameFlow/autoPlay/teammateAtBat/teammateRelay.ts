import type { GameState } from '@/entities/game/model/gameState'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { drawnRelayGameOf } from '@/features/play-game/model/gameFlow/autoPlay/relayGame'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 0x21 의 한 틱 — 교체로 공 없이 돌아간 부름(글 없음) */
export function substitutionRelayTickOf(progress: GameProgress): GameAutoRelayTick {
  return {
    progress,
    game: progress.game,
    offenseOurs: true,
    orderIndex: progress.game.battingOrderIndex,
    lineup: progress.ourLineup,
    pitcherSlot: progress.opponentMound.pitcherSlot,
    atBat: null,
  }
}

/** 동료 타석 한 번의 중계 칸 */
export function teammateRelayTickOf(progress: GameProgress, game: GameState, play: QuickPlateAppearance['play']): GameAutoRelayTick {
  const slot = progress.game.battingOrderIndex
  return {
    progress,
    game: drawnRelayGameOf(game, progress.game),
    offenseOurs: true,
    orderIndex: slot,
    lineup: progress.ourLineup,
    pitcherSlot: progress.opponentMound.pitcherSlot,
    atBat: {
      rosterSlot: rosterSlotAt(progress.ourLineup, slot),
      outcome: play.outcome,
      fouled: play.fouled === true,
      swingingStrikeOutLost: play.swingingStrikeOutLost === true,
      strikes: play.strikes,
      balls: play.balls,
    },
  }
}
