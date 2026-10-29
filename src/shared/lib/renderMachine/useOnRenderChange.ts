import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

/**
 * **값이 바뀐 그림에서 그 자리에서 곁일을 한다** — 옛 `if (seenRef.current !== value) { seenRef.current = value; … }` 꼴(그리는 중
 * 장면 칸 되돌리기 · 자기 상태 고치기)을 한 곳에 모은 것. 첫 그림은 본 값으로만 적고 부르지 않는다. 같은 값으로 다시 그리면(그림을
 * 버리고 다시 그리는 때 포함) 다시 부르지 않는다.
 *
 * ⚠️ `onChange` 는 그리는 중에 돈다 — ref 고치기 · 이 컴포넌트 상태 고치기(React 가 곧바로 다시 그린다)만 한다. 저장 · 난수 · 소리 같은
 * 바깥 곁일은 effect 로.
 */
export function useOnRenderChange<T>(value: T, onChange: (next: T, previous: T) => void): void {
  useRenderMachine<{ readonly value: T }, T>((seen, next) => {
    if (seen === null) return { value: next }
    if (Object.is(seen.value, next)) return seen
    onChange(next, seen.value)
    return { value: next }
  }, value)
}
