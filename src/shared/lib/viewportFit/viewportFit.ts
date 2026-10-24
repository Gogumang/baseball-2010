/**
 * **웹 껍데기 배치** — 원작 240×320 화면을 창(폰 화면)에 얼마나 키워 어디에 둘지 정한다.
 * 원본 화면 안 좌표·그림은 건드리지 않는다: 화면은 `zoom: var(--zoom)` 으로 통째로 키워질 뿐이다.
 *
 * - `plain`  — 터치 버튼 없음. 화면만 가운데.
 * - `below`  — 세로 폰: 화면을 폭 가득 위에, 터치 버튼(상황 버튼 줄 · 뒤로 · 확인) 아래.
 * - `sides`  — 가로 폰: 화면을 높이 가득 가운데에, 왼쪽은 상황 버튼 · 뒤로, 오른쪽은 확인.
 *
 * 숫자 키패드는 걷었다(r173) — 버튼 자리는 두 줄만 남겨 화면을 되도록 크게 한다.
 *
 * 데스크톱(버튼 없음 · 마우스)은 예전 규칙 그대로 **정수배 1·2·3** 이다(창이 500×660 이상이면 2배, 740×980 이상이면 3배).
 * 폰은 꽉 차게 키운다 — 정수배가 최대 배율의 90% 이상이면 정수배, 아니면 1/80 단위로 내린 최대 배율
 * (240·320 에 곱해 늘 정수 px 이 되게 — 화면 판과 덮개 기둥이 같은 자리에 떨어진다).
 */

export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320

/** 세로 배치에서 터치 버튼에 남겨 둘 최소 높이 — 상황 버튼 줄 48 + 확인 줄 64 + 틈 + 여백 (`TouchControls.css`) */
export const CONTROLS_MIN_HEIGHT = 48 + 64 + 8 + 2 * 8
/** 가로 배치에서 버튼 한쪽에 남겨 둘 최소 폭 — 버튼 72 + 여백 */
export const CONTROLS_MIN_SIDE_WIDTH = 72 + 2 * 8

/** 배율 단위 — 240/80 = 3, 320/80 = 4 라 확대한 화면 폭·높이가 늘 정수 px 이다 */
const ZOOM_STEP = 80
/** 정수배가 최대 배율의 이만큼 이상이면 정수배를 고른다 (도트가 고르다) */
const WHOLE_ZOOM_SHARE = 0.9
/** 아주 작은 창에서도 이보다 작게는 줄이지 않는다 */
const MIN_ZOOM = 0.5

export type ShellLayout = 'plain' | 'below' | 'sides'

export interface ViewportInput {
  /** 쓸 수 있는 폭·높이 (safe-area 를 뺀 CSS px) */
  readonly width: number
  readonly height: number
  /** 터치가 주 입력인가 (`pointer: coarse`) — 아니면 데스크톱 규칙 */
  readonly isTouch: boolean
  /** 터치 버튼(확인 · 뒤로 · 상황 버튼)을 보이는가 */
  readonly showControls: boolean
}

export interface ViewportFit {
  readonly layout: ShellLayout
  readonly zoom: number
  /** 화면 판을 담는 칸(`#root`)의 폭·높이 px */
  readonly gameWidth: number
  readonly gameHeight: number
}

/** 예전 데스크톱 규칙 (전역 CSS 미디어 쿼리였다) — 정수배만 */
export function desktopZoomOf(width: number, height: number): number {
  if (width >= 740 && height >= 980) return 3
  if (width >= 500 && height >= 660) return 2
  return 1
}

/** 주어진 칸에 240×320 을 비율 그대로 넣는 가장 큰 배율 (정수배 우선) */
export function fittedZoomOf(width: number, height: number): number {
  const fit = Math.min(width / SCREEN_WIDTH, height / SCREEN_HEIGHT)
  if (!Number.isFinite(fit) || fit <= MIN_ZOOM) return MIN_ZOOM
  const whole = Math.floor(fit)
  if (whole >= 1 && whole / fit >= WHOLE_ZOOM_SHARE) return whole
  return Math.max(MIN_ZOOM, Math.floor(fit * ZOOM_STEP) / ZOOM_STEP)
}

export function viewportFitOf({ width, height, isTouch, showControls }: ViewportInput): ViewportFit {
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  if (!showControls) {
    const zoom = isTouch ? fittedZoomOf(w, h) : desktopZoomOf(w, h)
    return { layout: 'plain', zoom, gameWidth: w, gameHeight: h }
  }
  // 세로(아래 버튼)와 가로(옆 버튼) 중 화면이 더 커지는 쪽 — 회전하면 저절로 바뀐다
  const belowZoom = fittedZoomOf(w, h - CONTROLS_MIN_HEIGHT)
  const sidesZoom = fittedZoomOf(w - 2 * CONTROLS_MIN_SIDE_WIDTH, h)
  if (sidesZoom > belowZoom) {
    return { layout: 'sides', zoom: sidesZoom, gameWidth: Math.round(SCREEN_WIDTH * sidesZoom), gameHeight: h }
  }
  return { layout: 'below', zoom: belowZoom, gameWidth: w, gameHeight: Math.round(SCREEN_HEIGHT * belowZoom) }
}

/**
 * 터치 버튼을 보일지 — `?keypad=1` · `?keypad=0` 이 있으면 그것(예전 이름 그대로), 없으면 터치 기기(`pointer: coarse`)일 때.
 */
export function touchControlsWantedOf(search: string, isTouch: boolean): boolean {
  const forced = new URLSearchParams(search).get('keypad')
  if (forced === '1' || forced === 'on') return true
  if (forced === '0' || forced === 'off') return false
  return isTouch
}
