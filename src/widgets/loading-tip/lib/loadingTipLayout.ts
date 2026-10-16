/**
 * **로딩 판 그리기 0x53e04** (2026-10-16 직접 떴다, r120 — 53e04~5408c). this = [0x1552cfc] 진행 칸 객체
 * (+4 = ui/loadingbar.pzx · +0x2a8 = StrTIP 표 · +0xb8 = ui/num.pzx — 0x53dbc 가 53de8 에서 받아 둔다 · +0x10 지금 · +0x14 끝).
 * ```
 * 53e5a  0x6a9f1(gfx, 0, 0, W, H, RGB(0x11, 0x20, 0x7f))                     ; 바탕 전체
 * 53e82  상자 = 0xba815(loadingbar, 프레임 0, 종류 1) → (dx, dy, w, h) = (0, 0, 170, 147)
 *        X = (W − w) >> 1 · Y = (H − h) >> 1                                  ; 53ea8 · 53ebe (asr)
 * 53edc  0xba759(loadingbar, 0, 종류 1 프레임, X, Y, …, 진행 1)                ; 상자
 * 53f0a  0xba51c(X + 0x28, Y + 6, 30, 20, 자간 1, 값 n + 1, 기준 0x5a, num, 정렬 1)  ; 팁 번호 (n = +0x315)
 * 53f2c  0xba269(StrTIP[1 + n], X + 0xa, Y + 0x1e, 폭 w − 0x14, 색 −1, 0)      ; 팁 글
 * 53f30  막대 = (BX, BY, 150, 10) — BX = X + ((w − 150) >> 1) · BY = Y + h − 0x23
 * 53f98  0x6a9f1(gfx, BX, BY, 150, 10, RGB(0x0a, 0x19, 0x50))                  ; 막대 바탕
 * 53f9c  채움 F = 150 − (끝 − 지금) · (150 / 끝)   (끝 ≠ 0 일 때 0xca7b5 몫)
 * 53fde  0x6a9f1(BX + 1, BY + 1, F, 1, RGB(0xfc, 0xc7, 0x39))
 * 54002  0x6a9f1(BX + 1, BY + 2, F, 4, RGB(0xfc, 0xe5, 0x37))
 * 54026  0x6a9f1(BX + 1, BY + 6, F, 2, RGB(0xff, 0xc5, 0x3d))
 * 5404c  0x6a9f1(BX + 1, BY + 8, F, 1, RGB(0xfd, 0x83, 0x52))
 * 5407e  0xba759(loadingbar, 애니 0, 종류 2, BX + F + 1, BY + 10, …, 진행 1)  ; 달리는 선수 (5405c 의 프레임 1 상자는 안 쓴다)
 * 54088  0x6a5e9(gfx)                                                          ; 화면에 낸다
 * ```
 * 다 찬 막대(F = 150)는 BX + 1 에서 시작해 바탕(150)보다 1px 오른쪽으로 나간다 — 원본 그대로.
 */
export const LOADING_SCREEN = { width: 240, height: 320 } as const
/** 0x1400748(0x11, 0x20, 0x7f) */
export const LOADING_BACKGROUND_RGB = [0x11, 0x20, 0x7f] as const
/** loadingbar 프레임 0 의 상자 (0xba815 종류 1 — 원점 (0, 0)) */
const BOX_SIZE = { width: 170, height: 147 } as const

export const LOADING_BOX = {
  x: (LOADING_SCREEN.width - BOX_SIZE.width) >> 1,
  y: (LOADING_SCREEN.height - BOX_SIZE.height) >> 1,
  width: BOX_SIZE.width,
  height: BOX_SIZE.height,
} as const

/** 팁 글 0xba269 — 상자 안 (10, 30), 폭 w − 20 */
export const LOADING_TIP_TEXT = { x: 0xa, y: 0x1e, width: BOX_SIZE.width - 0x14 } as const

/** 팁 번호 0xba51c — 상자 안 (40, 6), 기준 0x5a(num 그림 90 + 숫자), 자간 1 */
const TIP_NUMBER = { x: 0x28, y: 6, gap: 1, base: 0x5a } as const
/** num 90~99 의 폭 — '1' 만 4, 나머지 8 (높이는 모두 8 이라 아래 맞춤 = 위 맞춤) */
const NARROW_DIGIT_WIDTH = 4
const DIGIT_WIDTH = 8

export interface PlacedNumberGlyph {
  /** ui/num.pzx 그림 번호 */
  readonly image: number
  /** 상자 안 x · y */
  readonly x: number
  readonly y: number
}

/** 팁 번호 n + 1 의 글자 — 정렬 1 은 0xba51c 가 보는 비트(0x2 · 0x4 · 0x20 · 0x40)가 없어 (x, y) 에서 왼쪽부터 늘어놓는다 */
export function tipNumberGlyphsOf(tipNumber: number): readonly PlacedNumberGlyph[] {
  let x = TIP_NUMBER.x
  return [...String(Math.max(0, Math.trunc(tipNumber)))].map((character) => {
    const digit = Number(character)
    const glyph = { image: TIP_NUMBER.base + digit, x, y: TIP_NUMBER.y }
    x += (digit === 1 ? NARROW_DIGIT_WIDTH : DIGIT_WIDTH) + TIP_NUMBER.gap
    return glyph
  })
}

const BAR_WIDTH = 150
const BAR_HEIGHT = 10
/** 막대 (상자 안) — x = (w − 150) >> 1 · y = h − 0x23 */
export const LOADING_BAR = {
  x: (BOX_SIZE.width - BAR_WIDTH) >> 1,
  y: BOX_SIZE.height - 0x23,
  width: BAR_WIDTH,
  height: BAR_HEIGHT,
  rgb: [0x0a, 0x19, 0x50] as const,
} as const

/** 채움 띠 넷 — (막대 안 y, 높이, 색) */
export const LOADING_FILL_STRIPES: readonly { readonly y: number; readonly height: number; readonly rgb: readonly [number, number, number] }[] = [
  { y: 1, height: 1, rgb: [0xfc, 0xc7, 0x39] },
  { y: 2, height: 4, rgb: [0xfc, 0xe5, 0x37] },
  { y: 6, height: 2, rgb: [0xff, 0xc5, 0x3d] },
  { y: 8, height: 1, rgb: [0xfd, 0x83, 0x52] },
]

/** 채움 폭 F = 150 − (끝 − 지금) · (150 / 끝) — 정수 나눗셈 0xca7b5 · 끝 = 0 이면 150 을 그대로 곱한다 */
export function loadingFillWidthOf(current: number, end: number): number {
  const step = end !== 0 ? Math.trunc(BAR_WIDTH / end) : BAR_WIDTH
  return BAR_WIDTH - (end - current) * step
}

/** 달리는 선수(애니 0)의 기준점 — 막대 안 (F + 1, 10). 프레임 원점(−7, −20)이 더해져 막대 위에 선다 */
export function loadingRunnerAnchorOf(fillWidth: number): { readonly x: number; readonly y: number } {
  return { x: LOADING_BAR.x + fillWidth + 1, y: LOADING_BAR.y + BAR_HEIGHT }
}
