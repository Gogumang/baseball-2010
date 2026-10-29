import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { useDefenseUnderBurstWindow } from './otherSlices'

type BurstSlot = PitcherGameProgress['burst']

/** 아직 대사를 안 보인 돌발 제안 행 (`shownProposal` 은 이미 보인 행) */
function proposalOf(burst: BurstSlot, shownProposal: BurstMissionRow | null) {
  if (burst === null || burst.current === null) return null
  return burst.current !== shownProposal ? burst.current : null
}

/** 그 행의 돌발 대사 — 돌발 표의 그 행 줄 (`ORIGINAL_BURST_TABLES`) */
function burstLinesOf(burst: BurstSlot, burstRow: BurstMissionRow | null | undefined) {
  if (burst === null || burstRow == null) return null
  return ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null
}

/** 돌발 미션 — 제안 창(0x1b) · 결과 창(0x1d · 0x1c)의 행과 대사 */
export function usePitcherBurst(progress: PitcherGameProgress, shownProposal: BurstMissionRow | null) {
  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  /** 판 끝에서 난 돌발 판정(상태 0x1c)이면 그 판을 창 아래에 이어 그린다 (`useDefenseUnderBurstWindow`) */
  const defenseUnderBurst = useDefenseUnderBurstWindow(resolution)
  const proposal = proposalOf(burst, shownProposal)
  const burstRow = resolution?.row ?? proposal
  const burstLines = burstLinesOf(burst, burstRow)
  return { burst, resolution, defenseUnderBurst, proposal, burstLines }
}
