import { UNFILLED_SPECIAL_SWING, withSpecialSwingSlot } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import type { SubstitutedBatter } from '@/features/play-team-game/model/teamGameFlow/substitution/substituteBatter'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **우리 팀 대타 확정** — 사람 대타(`pinchHit`)와 우리 팀 CPU 대타(간이 엔진 0xac228)가 같은 `0xaebe4` 를 지난다:
 * 명단 · 타순 칸 기록 · 루타 목록 · 타석 결과 목록을 옮기고, 벤치 타자 수 −1(0 밑으로는 안 간다, aed9c~aedae),
 * 0xaede0 — 그 타순의 필살 남은 칸을 −1 로 되돌려 들어온 선수가 자기 횟수를 새로 받는다 (H2 1-2)
 */
export function withOurPinchHitter(progress: TeamGameProgress, swapped: SubstitutedBatter, slot: number): TeamGameProgress {
  return {
    ...progress,
    ourEntry: swapped.entry,
    ourEntryRecords: swapped.records,
    ourHitBases: swapped.hitBases ?? progress.ourHitBases,
    ourBatterLogs: swapped.logs ?? progress.ourBatterLogs,
    ourBenchBatters: Math.max(0, progress.ourBenchBatters - 1),
    ourSpecialSwingRemaining: withSpecialSwingSlot(progress.ourSpecialSwingRemaining, slot, UNFILLED_SPECIAL_SWING),
  }
}
