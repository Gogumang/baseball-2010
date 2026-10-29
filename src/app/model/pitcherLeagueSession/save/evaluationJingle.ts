/**
 * 116 평가 징글 — 진입 끝 12c96~12cc6 `0x6e499(소리, …)`: S+0x4a < 0 → 38 · ≤ 1 → 37 · > 1 → 36 (모드 3·4 공용 — 타자편과 같다).
 */
export function pitcherEvaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > 1 ? 36 : 37
}
