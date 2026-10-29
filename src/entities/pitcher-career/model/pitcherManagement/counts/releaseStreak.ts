import { toInt8 } from '@/entities/pitcher-career/model/pitcherManagement/counts/int8'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 해제 카운터를 올리는 (스킬 비트, 훈련 칸) 짝 — 0x18a80~0x18b58 의 모드 3 갈래 (0xa3a75 = **보유** 비트) */
const RELEASE_STREAK_PAIRS: readonly (readonly [skill: number, slot: number])[] = [
  [18, 3], // 비겁자 · 체력
  [19, 2], // 깃털 · 변화
  [20, 0], // 더티볼 · 제구
]
const RELEASE_STREAK_SLOTS = 5

const emptyStreaks = () => new Array<number>(RELEASE_STREAK_SLOTS).fill(0)

/** 이 칸 훈련이 가진 스킬의 짝과 맞는가 */
const matchesReleasePair = (career: PitcherCareer, slot: number) =>
  RELEASE_STREAK_PAIRS.some(([skill, pairSlot]) => pairSlot === slot && career.skillIds.includes(skill))

/**
 * 훈련 뒤 해제 카운터 `+0x70 + 칸` (0x18b5a · 0x18b70) — 맞는 짝이면 그 칸 +1, 아니면 다섯 칸 모두 0.
 * 마구(0x17fd8 갈래 — 0x18350 `b 0x18a5c`) · 구질 훈련(0x1836a 갈래 — 0x186c2)도 끝에 0x18a5c 를 지나 칸 4 로 여기를 돈다 —
 * 칸 4 는 어느 짝에도 없어 다섯 칸이 0 이 된다(직접 떴다).
 */
export function countReleaseTrainingStreak(career: PitcherCareer, slot: number): PitcherCareer {
  if (!matchesReleasePair(career, slot)) return { ...career, releaseTrainingStreaks: emptyStreaks() }
  const counts = career.releaseTrainingStreaks ?? emptyStreaks()
  return { ...career, releaseTrainingStreaks: counts.map((count, index) => (index === slot ? toInt8(count + 1) : count)) }
}
