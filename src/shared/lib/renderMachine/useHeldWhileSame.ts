import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

interface Held<T> {
  readonly value: T
  readonly keys: readonly unknown[]
}

function advanceHeld<T>(previous: Held<T> | null, next: Held<T>): Held<T> {
  const isSame =
    previous !== null && previous.keys.length === next.keys.length && previous.keys.every((key, index) => Object.is(key, next.keys[index]))
  return isSame ? previous : next
}

/**
 * **열쇠가 바뀐 그림의 값을 든다** — 열쇠가 그대로면 앞서 든 값을 그대로 돌려준다. 그리는 중에 새로 만드는 함수 묶음을, 그것을 부르는
 * useCallback 과 같은 열쇠로 붙잡는다: 콜백이 열쇠가 바뀐 그림의 함수를 부르던 옛 꼴(의존성에서 뺀 함수)과 같은 판의 함수를 부른다.
 * `useMemo` 와 달리 버려지지 않는다(차례가 값에 매인다).
 */
export function useHeldWhileSame<T>(value: T, keys: readonly unknown[]): T {
  return useRenderMachine<Held<T>, Held<T>>(advanceHeld, { value, keys }).value
}
