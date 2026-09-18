export interface SelectOption {
  readonly value: string
  readonly label: string
  readonly description?: string
  readonly isDisabled?: boolean
}

/**
 * 고를 수 있는 다음 칸. 비활성 옵션은 건너뛰고 끝에서는 반대편으로 돈다.
 * 전부 비활성이면 제자리다.
 */
export function stepEnabledIndex(
  options: readonly SelectOption[],
  from: number,
  step: 1 | -1,
): number {
  const count = options.length
  for (let offset = 1; offset <= count; offset += 1) {
    const index = (((from + step * offset) % count) + count) % count
    if (options[index]?.isDisabled !== true) return index
  }
  return from
}
