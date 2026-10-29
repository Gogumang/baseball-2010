/** 값을 [최소, 최대] 로 자른다 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** `v −= trunc(v·percent/100)` — 0xb570c 의 질병 · 부상 · 사기 감소 꼴 (나눗셈은 0 쪽 버림) */
export function reduceByPercent(value: number, percent: number): number {
  return value - Math.trunc((value * percent) / 100)
}
