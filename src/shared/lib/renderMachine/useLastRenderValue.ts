import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

interface Carry<T> {
  readonly current: T
  readonly previous: T
}

function advanceCarry<T>(carry: Carry<T> | null, input: { readonly value: T; readonly initial: T }): Carry<T> {
  return { current: input.value, previous: carry === null ? input.initial : carry.current }
}

/**
 * **지난 그림의 값** — 이 그림의 값을 적어 두고, 바로 앞 그림이 적은 값을 돌려준다(첫 그림은 `initial`). 한 그림 늦게 읽는
 * 옛 꼴(그림 끝에서 ref 에 적고 다음 그림 앞에서 읽던 것)과 같은 차례다 — 같은 그림에서 먼저 읽힐 값을 뒤에서 정하는 자리에 쓴다.
 */
export function useLastRenderValue<T>(value: T, initial: T): T {
  return useRenderMachine<Carry<T>, { readonly value: T; readonly initial: T }>(advanceCarry, { value, initial }).previous
}
