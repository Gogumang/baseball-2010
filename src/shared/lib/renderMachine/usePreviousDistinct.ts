import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

interface Trail<T> {
  readonly value: T
  readonly previous: T | null
}

function advanceTrail<T>(trail: Trail<T> | null, value: T): Trail<T> {
  if (trail === null) return { value, previous: null }
  return trail.value === value ? trail : { value, previous: trail.value }
}

/**
 * **바로 앞의 다른 값** — 값이 바뀐 그림부터 그 앞 값을 돌려준다(처음엔 `null`). 원본 장면의 "이전 상태" 칸([장면+0x28] 따위)처럼
 * 화면이 바뀔 때 그 자리에서 적고, 같은 값으로 다시 그려도 그대로 둔다. 그리는 중 고침이라 같은 그림의 뒤 계산이 새 값을 본다.
 */
export function usePreviousDistinct<T>(value: T): T | null {
  return useRenderMachine<Trail<T>, T>(advanceTrail, value).previous
}
