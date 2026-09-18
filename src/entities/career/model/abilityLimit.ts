import type { BatterAbility } from '@/entities/batting/model/batter'

/**
 * 배팅 타입별 능력 한계치 (표 0xcc502 = 0xd80c6 = 0xd4d90, 값 동일 × 10 — 누락 탐색 5·6차, 점검 10차).
 * 훈련 거절(0x12e40) · GP 능력 아이템(0xa4488) · 보상 13~16(0x8c758) 이 쓴다.
 */
const ABILITY_ORDER: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const LIMIT_TABLE = [80, 80, 80, 80, 80, 85, 75, 75]
const LIMIT_SCALE = 10

export function abilityLimitOf(battingTypeIndex: number): BatterAbility {
  const row = Math.min(battingTypeIndex, 1) * ABILITY_ORDER.length
  const limit = (index: number) => LIMIT_TABLE[row + index] * LIMIT_SCALE
  return { hit: limit(0), power: limit(1), defense: limit(2), run: limit(3) }
}
