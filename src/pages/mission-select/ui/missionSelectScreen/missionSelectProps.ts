import type { OriginalMission } from '@/shared/config/original/missions'

export interface MissionSelectScreenProps {
  readonly clearedKeys: readonly string[]
  /** 미션별 클리어 횟수 (0xa51d0) — 보상 G 가 다시 깰수록 줄어서 횟수를 보여 준다 */
  readonly clearCounts?: Readonly<Record<string, number>>
  readonly initialSide: OriginalMission['side']
  readonly onSelect: (mission: OriginalMission) => void
  readonly onBack: () => void
  /** 머리띠 G포인트 — 안 주면 0 */
  readonly gamePoint?: number
  /** 머리띠가 미끄러져 들어오는가(상태 1 진입 0x1d9a4 가 [skin+0x84] = 1). 기본 true — 시험은 false 로 다 내려온 자리에서 본다 */
  readonly slides?: boolean
}
