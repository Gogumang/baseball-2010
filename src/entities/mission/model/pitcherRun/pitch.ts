import type { PitcherRun } from '@/entities/mission/model/pitcherRun/types'

/**
 * 공 하나를 던졌다. 아직 타석이 끝나지 않은 경우에도 투구 수는 줄어든다.
 *
 * **MAX게이지(R+0x158)는 그 공에서 곧바로 센다** — 공 도착 0x3dfac 의 스트라이크(3e13e) · 삼진(3e168) 갈래가 등급 5 면 코드 0x21 로
 * 올리고, 같은 공의 판정 A 0xae24c 가 끝에서(ae382) 미션 판정 0xaaa6c 를 부른다 — 타석이 안 끝난 공(r4 = 0xf)도 판정한다.
 * 그래서 목표가 그 공에서 다 차면 타석 도중이라도 성공이고(`checkPitchExhausted`), HUD 줄(0x36358 의 P+0x34)도 공마다 오른다.
 * 예전 웹은 타석이 끝날 때 한꺼번에 더해 성공 · HUD 가 늦었다. `perfectGauges` 는 이번 타석의 수만 따로 든다.
 */
export function recordPitch(run: PitcherRun, wasPerfectGauge: boolean): PitcherRun {
  if (run.status !== '진행중') return run

  const remaining = run.remainingPitches === null ? null : run.remainingPitches - 1
  const progress = wasPerfectGauge
    ? { ...run.progress, counts: { ...run.progress.counts, MAX게이지: (run.progress.counts['MAX게이지'] ?? 0) + 1 } }
    : run.progress
  return {
    ...run,
    progress,
    remainingPitches: remaining,
    perfectGauges: run.perfectGauges + (wasPerfectGauge ? 1 : 0),
  }
}
