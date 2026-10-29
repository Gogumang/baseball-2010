/**
 * 시험 준비 파일(vitest `setupFiles`) — 시험 DOM 에는 그리는 캔버스가 없다. 화면 코드는 `getContext` 가 `null` 이면
 * 캔버스 없이 가는 갈래(구운 그림 · CSS 근사)로 간다 — 시험이 늘 그 갈래를 보게 `null` 로 못 박는다.
 * (옛 jsdom 은 `null` 을 내며 부를 때마다 "Not implemented" 오류 더미를 콘솔에 쏟아 한 번 돌 때 13MB 가 찍혔다, r364)
 * node 환경(DOM 없음)에서는 아무것도 안 한다.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function quietGetContext() {
    return null
  } as typeof HTMLCanvasElement.prototype.getContext
}
