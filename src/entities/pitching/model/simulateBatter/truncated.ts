/** 0 으로 자르는 나눗셈 (원본 `asrs` 앞의 음수 보정과 같다) */
export function truncated(value: number): number {
  return value < 0 ? Math.ceil(value) : Math.floor(value)
}
