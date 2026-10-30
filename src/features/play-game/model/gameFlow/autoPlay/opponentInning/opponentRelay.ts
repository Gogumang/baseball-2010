import { withInningRuns, type GameState } from '@/entities/game/model/gameState'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { HalfInningTick } from '@/entities/game/model/simulateHalfInning'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 타석 틱의 중계 칸 — 교체 틱(0xc1ba4 가 공 없이 돌아감)은 null */
function opponentRelayAtBatOf(tick: HalfInningTick, progress: GameProgress): GameAutoRelayTick['atBat'] {
  if (tick.kind !== 'plateAppearance') return null
  const { appearance } = tick
  return {
    rosterSlot: appearance.rosterSlot ?? rosterSlotAt(tick.lineup ?? progress.opponentLineup, tick.battingOrderIndex),
    outcome: appearance.outcome,
    fouled: appearance.fouled === true,
    swingingStrikeOutLost: appearance.swingingStrikeOutLost === true,
    strikes: tick.strikes,
    balls: tick.balls,
  }
}

/** 상대 반 이닝 0xc262c 한 번의 중계 칸 — 점수 · 이닝별 칸은 그 틱까지 든 득점(`runsSoFar`), 아웃은 그 틱의 st[6] */
export function opponentRelayTickOf(progress: GameProgress, tick: HalfInningTick, runsSoFar: number): GameAutoRelayTick {
  const opponentSide = 1 - progress.game.playerSide
  return {
    progress,
    game: withInningRuns({ ...progress.game, opponentScore: progress.game.opponentScore + runsSoFar, outs: tick.outs }, opponentSide, runsSoFar),
    offenseOurs: false,
    orderIndex: tick.battingOrderIndex,
    lineup: tick.lineup ?? progress.opponentLineup,
    pitcherSlot: tick.pitcherSlot ?? progress.ourMound.pitcherSlot,
    atBat: opponentRelayAtBatOf(tick, progress),
  }
}

/** 경기를 끝낸 마지막 틱은 끝난 판으로 그린다(끝내기 · 콜드 — 0xc2198 의 0xb68fc 가 그 다음 틱을 거짓으로). 중계 칸을 고친다 */
export function markFinishedRelayTail(relay: GameAutoRelayTick[], progress: GameProgress, game: GameState): void {
  const lastTick = relay[relay.length - 1]
  if (lastTick === undefined || lastTick.progress !== progress || !game.isFinished) return
  relay[relay.length - 1] = { ...lastTick, game: { ...lastTick.game, isFinished: true } }
}
