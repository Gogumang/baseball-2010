import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/** 방향을 붙이는 결과 코드 — 파울·땅볼·빗맞음·라이너·강타·홈런성 묶음의 첫 칸 */
const DIRECTED_CODES: ReadonlySet<number> = new Set([0, 3, 9, 15, 18, 21, 24])
const EARLY_LIMIT = -50
const LATE_LIMIT = 50
/** cls 0 가운데 · 1 · 2 별 (lo, hi) */
const DIRECTION_BOUNDS: readonly (readonly [number, number])[] = [
  [10, 80],
  [70, 80],
  [10, 20],
]
const DIRECTION_ROLL_RANGE = 90

export interface HitDirectionInput {
  readonly code: number
  readonly frame: number
  readonly frameCount: number
  /** 0 = 우타, 1 = 좌타 (스킬 13 좌완UP 조건에서 확인) */
  readonly batterSide: number
}

/**
 * 타구 방향 0·1·2 (binary.mod 0x5141c) — 결과 코드에 더한다.
 * 1 이면 패턴 수평각이 92~135, 2 면 45~103 쪽이다.
 */
export function hitDirectionOf(input: HitDirectionInput, random: RandomPort): number {
  if (!DIRECTED_CODES.has(input.code)) return 0
  // 곡선 점이 하나뿐이면 원본 식이 0 으로 나누게 된다 — 가운데(cls 0)로 본다
  const lateness =
    input.frameCount <= 1 ? 0 : Math.trunc(((input.frame - input.frameCount) * 1000 + 2000) / (input.frameCount - 1))
  let timingClass = lateness < EARLY_LIMIT ? 1 : lateness > LATE_LIMIT ? 2 : 0
  if (timingClass !== 0 && input.batterSide === 1) timingClass = 3 - timingClass
  const [low, high] = DIRECTION_BOUNDS[timingClass]
  const roll = randomIntegerBelow(random, 0, DIRECTION_ROLL_RANGE)
  if (roll > high) return 2
  if (roll < low) return 1
  return 0
}
