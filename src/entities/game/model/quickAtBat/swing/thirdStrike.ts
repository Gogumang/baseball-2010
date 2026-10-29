import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **헛스윙 세 번째 스트라이크 겨루기** (0xc11f0 c1748~c17d8, 디스어셈 대조 — 확정).
 * ```
 * c174e  st[4]++ ; st[4] <= 2 면 끝
 * c1764  p = rand(0, 0xb570c(수비, 1 구속, 투수, 1, 90, 1))     ; 체력 인자 90 — 피로 없음
 * c1784  b = rand(0, 0xb570c(공격, 0 히트, 타자, 1, 90, 1))
 * c17a8  p > b  → 아웃 +1 · 삼진 기록 0xa7c4d · 0xa8025 · 다음 타자 · sim+0xc4 = 5
 *        그 밖 → 아웃 +1 · **아웃 기록 0xa7d0d**(삼진 아님) · 0xa8025 · 다음 타자 · sim+0xc4 = 5
 * ```
 * 진 쪽은 삼진이 아니라 그냥 아웃이다 — 삼진 기록(16·17)도 연속 삼진도 없고 진루타 굴림(c15b8)도 안 탄다(주자 그대로).
 * 중계 글은 어느 쪽이든 5 "삼진 아웃" 이다(c17d8). 두 능력은 스윙 앞 겨루기(c12f8)와 같은 인자다 — `velocity`·`hit`.
 * 루킹 삼진(0xc1818 판정 길)과 점프표 나머지 코드(c170c)의 세 번째 스트라이크는 겨루지 않는다.
 */
export function thirdStrikeContestOf(batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher, random: RandomPort): boolean {
  const pitcherRoll = random.rand(0, pitcher.velocity)
  const batterRoll = random.rand(0, batter.hit)
  return pitcherRoll > batterRoll
}
