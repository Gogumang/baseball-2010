/**
 * **그리는 도중 ref 에 최신 값을 적는다** — 콜백 신원을 흔들지 않고 틱 고리 · 키 처리기 · effect 가 지난 그림의 값을 읽게 하는
 * "최신 값 ref" 를 한 곳에 모은 것. 부르는 자리는 옛 `xRef.current = x` 줄 그대로다.
 *
 * ⚠️ 일부러 effect 로 미루지 않는다: 자식의 layout effect(부모 effect 보다 먼저 돈다)나 같은 그림 안의 뒤 계산이 이 그림의 값을
 * 읽어야 원본 틱 시계에 맞춘 차례가 그대로다. React 가 그림을 버리면(동시 렌더) 버린 그림의 값이 남을 수 있는데, 이 앱은 그런
 * 갱신(transition · Suspense 재시도)으로 이 ref 를 가진 화면을 그리지 않는다 — 옛 꼴과 같은 한계다.
 */
export function useMirrorRef<T>(ref: { current: T }, value: T): void {
  ref.current = value
}
