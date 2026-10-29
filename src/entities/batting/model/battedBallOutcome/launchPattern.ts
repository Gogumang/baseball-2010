import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { LANDING_CHASE_FLAG } from '@/entities/batting/model/battedBallOutcome/displayPattern'

/**
 * **특수 타구 표 `0xcfb3c`** (s16 × 3 × 4 — 원본 각 · 속도 · 높이) — 바이트 그대로:
 * `79 ff d6 02 3a 07 | 79 ff b0 04 b0 04 | d3 ff d6 02 3a 07 | d3 ff b0 04 b0 04`
 * = (−135, 726, 1850) · (−135, 1200, 1200) · (−45, 726, 1850) · (−45, 1200, 1200).
 * 각은 원본 부호(덱이 저장할 때 뒤집은 값)라 웹 패턴 각으로는 135 · 45 — 파울선 바로 위(페어 끝, 0x9d660 양끝 포함)다.
 */
const SPECIAL_LAUNCHES: readonly (readonly [angle: number, speed: number, height: number])[] = [
  [135, 726, 1850],
  [135, 1200, 1200],
  [45, 726, 1850],
  [45, 1200, 1200],
]
/** 0x514f2 — 결과 코드 25 · 26 (`subs #0x19 ; cmp #1 ; bhi`) */
const SPECIAL_LAUNCH_CODES = [25, 26]
/** 0x51502 — rand(0, 1000) ≤ 19 (`cmp #0x13 ; bgt`) */
const SPECIAL_LAUNCH_LIMIT = 19
const SPECIAL_LAUNCH_ROLL = 1000
/**
 * 덱에서 꺼낸 패턴을 **실제로 쏠 패턴**으로 — 꺼내기 바로 뒤 `0x514f2 ~ 0x5152c` (직접 뜬 것):
 * ```
 * 514f2  코드 ∈ {25, 26} 이고 rand(0, 1000) ≤ 19 이면 e = 0xcfb3c[rand(0, 4)] 로 (a, b, c) 를 덮는다
 * 5152e  b(+0xfce) == 0 이면 a = rand(−140, −40) · b = rand(300, 1300) · c = rand(300, 1300), 코드가 6~8 · 12~14 면
 *        (마스크 0x71c0) a = rand(−110, −70) · b = rand(100, 480) · c = rand(200, 500)
 * ```
 * 둘째 갈래는 패턴이 없는 코드(21~23)에서만 서는데 스윙 판정 0xab214 가 그 코드를 내지 않아 웹에는 두지 않는다.
 * 플래그는 덱 패턴 것이 남는다 — 비트 1(+0x127, 514cc)은 이미 섰고, 비트 0(높이 부호)은 덱이 저장할 때 c 에 먹였으므로
 * 특수 표의 c 는 그대로 양수다.
 */
export function launchPatternOf(code: number, drawn: BattedBallPattern, random: RandomPort): BattedBallPattern {
  if (!SPECIAL_LAUNCH_CODES.includes(code)) return drawn
  const specialRoll = random.rand(0, SPECIAL_LAUNCH_ROLL)
  if (specialRoll > SPECIAL_LAUNCH_LIMIT) return drawn
  const launchIndex = random.rand(0, SPECIAL_LAUNCHES.length)
  const [angle, speed, height] = SPECIAL_LAUNCHES[launchIndex]
  return [angle, speed, height, drawn[3] & LANDING_CHASE_FLAG]
}
