import type { PlayView, RunnerState } from '@/entities/fielding/model/fieldingState'

/**
 * 플레이 vt 0x80 = 0xb1b54 — "내가 마지막으로 닿은 루가 바로 앞 주자가 달려가는 루" = 포스로 밀려 가는 주자 (S7 3-0).
 * ```
 * b1b56: i == 0 → 1                        ; 타자주자는 늘 1
 * b1b5a: P+0x112 == 0 → 0                  ; 공을 한 번도 안 쥐었다
 * b1b66: R = [P+0x1c][i] ; Q = [P+0x1c][i−1]
 * b1b72: R+0x78+0x14 (= +0x8c 닿은 루) == Q+0x7c (달려가는 루) → 1
 * ```
 * (예전 웹은 `R.+0x7c == Q.+0x8c` 로 거꾸로 읽었다 — +0x7c/+0x8c 이름을 바로잡은 54c4e87 뒤에 남은 자리)
 */
export function isForcedRunner(play: PlayView, runners: readonly RunnerState[], index: number): boolean {
  if (index === 0) return true // 타자주자는 늘 1
  if (!play.everHeld) return false
  const runner = runners[index]
  const previous = runners[index - 1]
  if (runner === undefined || previous === undefined) return false
  return runner.startBase === previous.targetBase
}
