/**
 * **문턱 사다리** — 원본 평가 함수는 `cmp · bgt/bge` 사슬로 점수를 가른다. 웹은 [문턱, 값] 을 원본 비교 차례대로 적고 처음 맞는 칸을 쓴다.
 * 값은 모두 정수 셈(아웃 · 삼진 · 실점 · 점수)이라 `> n` 은 `≥ n + 1`, `== n` 은 앞 칸이 걸러 낸 뒤의 `≤ n` 으로 적었다.
 */
export type ScoreSteps = readonly (readonly [limit: number, value: number])[]

/** 값 ≥ 문턱인 첫 칸 — 내림차순 사다리 (`> 10 → 6 · ≥ 9 → 5 …`) */
export function atLeastStepOf(steps: ScoreSteps, value: number, otherwise: number): number {
  return steps.find(([limit]) => value >= limit)?.[1] ?? otherwise
}

/** 값 ≤ 문턱인 첫 칸 — 오름차순 사다리 (`≤ −5 → −2 · ≤ −3 → −1 …`) */
export function atMostStepOf(steps: ScoreSteps, value: number, otherwise: number): number {
  return steps.find(([limit]) => value <= limit)?.[1] ?? otherwise
}
