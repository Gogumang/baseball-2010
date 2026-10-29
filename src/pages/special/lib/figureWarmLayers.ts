import { batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { figureBatterPosesOf } from '@/pages/special/lib/hallOfFameFigure'

/** 겹침 타자 그림이 낼 수 있는 자세(`figureBatterPosesOf`)의 겹 전부 — 그림자 끔 (미리 칠하기용) */
export function figureBatterWarmLayersOf(bodyType: number, equipment: BatterEquipment): BatterLayer[] {
  return figureBatterPosesOf(bodyType).flatMap((pose) => batterLayersOf(pose, bodyType, equipment, false))
}
