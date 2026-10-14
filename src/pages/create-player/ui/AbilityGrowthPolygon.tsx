import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { abilityGrowthVerticesOf } from '@/pages/create-player/lib/teamSelectLayout'
import type { ChartPoint } from '@/pages/create-player/lib/teamSelectLayout'

/**
 * 값 도형 채움 알파 — `anim+0x80 = 0xb4ffff00`(0x5b386) 의 위 바이트 0xb4.
 * 아래 세 바이트 ffff00 이 `radarFill`(#FFFF00) 과 같고 `anim+0x7c = makeColor(255,255,255)`(0x5b380) 가 `radarEdge`(#FFFFFF) 다.
 */
export const ABILITY_FILL_ALPHA = 0xb4 / 0xff

/**
 * 능력치 도형 0x5aefc 의 값 도형 — 레이더 객체 [skin+0xd4] 의 자라는 애니(`useRadarGrowth`)로 지금값을 굴려 꼭짓점을 잡는다.
 * 0x5aefc 는 [anim+0x1e3] == 0 이면 0x5b344~0x5b3b8 에서 다시 만들고(0x75ebd(anim, 서술자, 4, 0)) 매 그림 0x764c9 가
 * 한 걸음 0x760e8 을 굴린 뒤 그린다. 들어옴이 +0xad = 0 으로 두므로 붙을 때 0 에서 자라고, `restartKey` 가 바뀐 그림에서
 * 지난 목표값부터 다시 오르내린다. 목표값이 비면(잠긴 팀 idx −1 · 빈 명전 칸 기록 0 — 0x5afe8 · 0x5b2d2) 네 값 0 으로 내려간다.
 * ⚠️ 네 축이 모두 0 이면 웹은 값 도형을 안 그린다 — 원본 0x75e30 이 한가운데 점 하나를 찍는지는 안 봤다.
 */
export function AbilityGrowthPolygon({ center, targets, maximumLength, restartKey, fromZero = true }: {
  readonly center: ChartPoint
  /** 네 값 — 비면 0 네 개 */
  readonly targets: readonly number[]
  /** 최대길이 = 반지름 × 축 최대치 / 999 (팀 999 → 30 · 명전 선수 800 → 24) */
  readonly maximumLength: number
  readonly restartKey?: string | number
  /** 붙을 때 0 에서 자라나 (`useRadarGrowth` 의 같은 이름) */
  readonly fromZero?: boolean
}) {
  const goal = targets.length === 0 ? [0, 0, 0, 0] : targets
  const current = useRadarGrowth(goal, restartKey === undefined ? { fromZero } : { restartKey, fromZero })
  if (current.every((value) => value === 0)) return null
  return (
    <polygon data-part="values" points={abilityGrowthVerticesOf(center, current, maximumLength).map((point) => `${point.x},${point.y}`).join(' ')}
      fill={ORIGINAL_COLORS.radarFill} fillOpacity={ABILITY_FILL_ALPHA} stroke={ORIGINAL_COLORS.radarEdge} strokeWidth={1} />
  )
}
