import { truncated } from '@/entities/pitching/model/simulateBatter/truncated'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 0x340f8 — K = h/4 + 2900 (0xb54) */
const TIMING_BASE = 2900
/** 0x340f8 — 실투면 K = 10000 (0x2710) 이라 첫 굴림이 늘 통과한다 */
const MISTAKE_TIMING_K = 10000
/** 0x340f8 — 두 번째 문턱 K × 19 / 10 */
const SECOND_TIMING_NUMERATOR = 19
const SECOND_TIMING_DENOMINATOR = 10
/** 표 0xcfd84 · 0xcfd88 · 0xcfd8c (s8, 앞 2·2·3 칸만 쓴다) */
const TIMING_OFFSETS_EXACT: readonly number[] = [0, 0]
const TIMING_OFFSETS_LATE: readonly number[] = [0, 1]
const TIMING_OFFSETS_WIDE: readonly number[] = [0, 1, -1]

/** 고른 어긋남 표에서 한 칸 — rand(0, 칸 수) */
const rollOffsetIn = (offsets: readonly number[], random: RandomPort) => offsets[random.rand(0, offsets.length)]

/**
 * CPU 타자의 스윙 프레임 어긋남 d — 원본 0x340f8 (0x34334 가 휘두르기로 정한 뒤 바로 부른다).
 *
 * ```
 * K = h/4 + 2900                     ; h 음수면 (h+3)>>2 = 0 쪽 버림
 * if 실투(+0xf98.byte8 ≠ 0): K = 10000
 * if   rand(0,10000) < K        : d = [0,0][rand(0,2)]       ; 늘 0
 * elif rand(0,10000) < K*19/10  : d = [0,1][rand(0,2)]
 * else                          : d = [0,1,−1][rand(0,3)]
 * F = N − 2 + d
 * ```
 * 난수는 **첫 갈래 2번, 나머지 3번** 돈다 — 첫 갈래의 표가 [0,0] 이라 결과는 늘 0 이지만 굴림은 한다.
 * 히트 영향은 아주 작다 (h=0 이면 d=0 59.2% · +1 30.2% · −1 10.6%).
 */
export function cpuSwingTimingOffsetOf(hit: number, random: RandomPort, isMistakePitch = false): number {
  const k = isMistakePitch ? MISTAKE_TIMING_K : truncated(hit / 4) + TIMING_BASE
  if (random.rand(0, 10000) < k) return rollOffsetIn(TIMING_OFFSETS_EXACT, random)
  const second = truncated((k * SECOND_TIMING_NUMERATOR) / SECOND_TIMING_DENOMINATOR)
  if (random.rand(0, 10000) < second) return rollOffsetIn(TIMING_OFFSETS_LATE, random)
  return rollOffsetIn(TIMING_OFFSETS_WIDE, random)
}
