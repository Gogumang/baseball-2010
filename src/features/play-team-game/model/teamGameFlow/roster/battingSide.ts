import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import type { BatterGameRecord } from '@/entities/batting/model/pinchHitAi'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **한쪽 타선** — 우리 · 상대 두 갈래를 칸마다 `ours ? … : …` 로 고르지 않도록 한 번에 모은 것.
 * 우리 타순 커서는 경기 상태(`game.battingOrderIndex`), 상대 타순 커서는 `opponentOrderIndex` 다.
 */
export interface BattingSide {
  readonly ours: boolean
  readonly teamId: number
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
  /** 타순 커서 그대로 (반 이닝 안에서 9 를 넘어 셀 수 있다) */
  readonly order: number
  /** 커서가 가리키는 명단 칸 0~8 (`lineupSlotOf`) */
  readonly slot: number
}

export function battingSideOf(progress: TeamGameProgress, ours: boolean): BattingSide {
  if (ours) {
    const order = progress.game.battingOrderIndex
    return { ours, teamId: progress.options.ourTeamId, entry: progress.ourEntry, records: progress.ourEntryRecords, order, slot: lineupSlotOf(order) }
  }
  const order = progress.opponentOrderIndex
  return {
    ours,
    teamId: progress.options.opponentTeamId,
    entry: progress.opponentEntry,
    records: progress.opponentEntryRecords,
    order,
    slot: lineupSlotOf(order),
  }
}

/** 명단 칸이 마선수(마타자 · 마투수 — `aceIndex` 0~4)인가 */
export function isAcePlayer(player: { readonly aceIndex: number } | undefined): boolean {
  return player !== undefined && player.aceIndex >= 0
}

/** 한쪽 타순 칸 기록(`ourEntryRecords` · `opponentEntryRecords`)을 바꾼 진행 */
export function withEntryRecords(progress: TeamGameProgress, ours: boolean, records: readonly BatterGameRecord[]): TeamGameProgress {
  return ours ? { ...progress, ourEntryRecords: records } : { ...progress, opponentEntryRecords: records }
}
