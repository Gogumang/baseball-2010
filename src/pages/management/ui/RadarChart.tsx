import type { BatterAbility } from '@/entities/batting/model/batter'
import { RADAR_LABEL_FRAMES } from '@/pages/management/lib/basicInfoLayout'
import type { RadarGrowthOptions } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { AbilityRadar } from '@/pages/management/ui/radarChart/AbilityRadar'

export { AbilityRadar } from '@/pages/management/ui/radarChart/AbilityRadar'
export { TintedNumber } from '@/pages/management/ui/radarChart/TintedNumber'

const KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']

/** ABILITY 레이더 (0x5a990) — 타자 능력치 네 칸 (축 이름 41~44 히트 · 파워 · 수비 · 주루) */
export function RadarChart({
  base,
  shown,
  growth,
}: {
  readonly base: BatterAbility
  readonly shown: BatterAbility
  /** 자라는 애니를 다시 거는 때 (`useRadarGrowth` 옵션) — 안 주면 목표값이 바뀔 때 지난 값에서 */
  readonly growth?: RadarGrowthOptions
}) {
  return (
    <AbilityRadar
      base={KEYS.map((key) => base[key])}
      shown={KEYS.map((key) => shown[key])}
      labelFrames={RADAR_LABEL_FRAMES}
      {...(growth === undefined ? {} : { growth })}
    />
  )
}
