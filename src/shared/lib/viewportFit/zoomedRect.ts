/**
 * **CSS `zoom` 판 안 요소의 화면 좌표 사각형** — 웹판 전용 (r242).
 *
 * 화면 판(`RawScreen`)은 `zoom: var(--zoom)` 으로 통째로 키운다(`useViewportFit`). 그런데 엔진마다 zoom 안 요소의
 * `getBoundingClientRect` 가 다르다 (playwright 로 직접 쟀다, 아이폰 13 세로 · 배율 1.625):
 * - 크로미움 128+ : 화면 좌표 — 캔버스 폭 390, `offsetWidth` 240
 * - 웹킷(아이폰 Safari) : **zoom 을 뺀 좌표** — 캔버스 폭 240 = `offsetWidth`
 *
 * 두 엔진 모두 pointer 사건의 `clientX` 는 화면 좌표(0~390)다. 그래서 웹킷에서 `(clientX − left) / width` 로 판 안 위치를 재면
 * 배율만큼 오른쪽으로 밀려, 화면 가운데를 눌러도 오른쪽 끝을 누른 것이 됐다. 이 함수는 사각형이 zoom 을 뺀 값이면(폭 = `offsetWidth`)
 * 조상 zoom 곱을 곱해 화면 좌표로 옮긴다. 배율이 1 이거나 이미 화면 좌표면 그대로다.
 */
export interface ScreenRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** 사각형 `rect` · 요소의 배치 폭 `layoutWidth`(`offsetWidth`) · 조상 zoom 곱 `zoom` → 화면 좌표 사각형 */
export function screenRectFrom(rect: ScreenRect, layoutWidth: number, zoom: number): ScreenRect {
  const isUnzoomed = zoom !== 1 && layoutWidth > 0 && Math.abs(rect.width - layoutWidth) < 0.5
  if (!isUnzoomed) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  return { left: rect.left * zoom, top: rect.top * zoom, width: rect.width * zoom, height: rect.height * zoom }
}

/** 요소와 조상들의 CSS `zoom` 곱 — 지원 안 하는 환경(jsdom)은 1 */
export function zoomProductOf(element: Element): number {
  let product = 1
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    const zoom = Number.parseFloat(getComputedStyle(node).zoom)
    if (Number.isFinite(zoom) && zoom > 0) product *= zoom
  }
  return product
}

/** 요소의 화면 좌표 사각형 — pointer 사건 `clientX` · `clientY` 와 같은 바탕 */
export function screenRectOf(element: HTMLElement): ScreenRect {
  return screenRectFrom(element.getBoundingClientRect(), element.offsetWidth, zoomProductOf(element))
}
