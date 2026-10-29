import { useRef } from 'react'

/**
 * **그림 차례 상태 기계** — 그릴 때마다 `advance(앞 상태, 이번 입력)` 을 한 번 돌려 다음 상태를 들고, 그 상태를 돌려준다.
 * 첫 그림의 앞 상태는 `null` 이다.
 *
 * 원본은 장면 갱신(틀)마다 화면 칸을 그 자리에서 고친다 — 이전 화면 · 진입 셈 · 틱마다 이어 걷는 걸음 같은 것들이다. 웹은 그 칸을
 * 그리는 도중에 고쳐야 같은 그림의 뒤 계산 · 자식이 고친 값을 본다(상태로 올리면 한 그림 늦거나, 그리기를 한 번 더 해 그리는 중
 * 곁일 — 깜빡임 셈 따위 — 이 두 번 난다). 그래서 이 훅 하나만 그리는 중 ref 를 읽고 쓰고, 부르는 쪽은 `advance` 를 순수 함수로 둔다.
 *
 * `advance` 는 같은 (앞 상태, 입력)에 같은 값을 내야 한다(난수 · 저장 금지). 바뀔 것이 없으면 앞 상태를 그대로 돌려준다.
 * 상태가 쥔 덩이(자식 화면과 같이 쓰는 커서 칸 따위)는 그 자리에서 고쳐도 된다 — 옛 꼴이 그리는 중에 고치던 그대로다.
 */
export function useRenderMachine<S, I>(advance: (previous: S | null, input: I) => S, input: I): S {
  const state = useRef<S | null>(null)
  // oxlint-disable-next-line react/refs -- 그리는 중 상태 기계(위 머리말): 같은 그림의 뒤 계산 · 자식이 이번 틀의 값을 봐야 한다
  const next = advance(state.current, input)
  // oxlint-disable-next-line react/refs -- 위와 같다 — 다음 그림의 앞 상태로 남긴다
  state.current = next
  return next
}
