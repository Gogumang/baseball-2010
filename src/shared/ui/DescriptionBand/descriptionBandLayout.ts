/**
 * **설명 띠** 0x55544(skin, 글) — 공용 skin 의 아래 띠다 (직접 떴다):
 * ```
 * Y = H − 0x2d = 275 · 알파 a = 200
 * x = 0 .. [skin+0x8a] − 1 마다 세로줄 0x6a905(x, Y) ~ (x, Y + 0x22), 색 (a << 24) | 0x192e74
 *   x > 80 부터는 줄마다 a −= 3, a ≤ 0 이면 멈춘다                               ; 0x55572~0x555aa
 * [skin+0x88](자라는 중)이면 [+0x8a] ×= 4, 0x9f 를 넘으면 160 · [+0x88] = 0   ; 0x555b6~0x555d2
 * 아니면(다 자람) 글이 있으면 흰 글 0xba269(글, 5, Y + 5)                        ; 0x555d4~0x555f6
 * ```
 * 부르는 곳: 환경설정 첫 화면 0x59e64 · 상세 설정 0x5a310 · 메인 메뉴 하위 목록 0x2524c(0x25860).
 * 다시 펴는 계기([skin+0x88] = 1 · [+0x8a] = 1)는 부르는 쪽마다 다르다 — 환경설정은 공용 페이지 0x593c8 머리 0x59462~0x5948c,
 * 메인 메뉴 하위 목록은 커서를 옮기는 0x25366~0x25370.
 */
export const DESCRIPTION_BAND = {
  y: 320 - 0x2d,
  height: 0x22,
  color: { r: 0x19, g: 0x2e, b: 0x74 },
  alpha: 200,
  /** 이 x 까지는 알파 200 그대로 */
  solidUntil: 80,
  alphaStep: 3,
  maxSpread: 160,
  text: { x: 5, dy: 5 },
} as const

/** 다시 편 뒤 `ticks` 번째 그림의 띠 폭과 자라는 중인지 — 1 · 4 · 16 · 64 를 그리고 160 에 멈춘다 */
export function descriptionBandAt(ticks: number): { readonly spread: number; readonly isGrowing: boolean } {
  let spread = 1
  for (let tick = 0; tick < ticks; tick += 1) {
    if (spread * 4 > 0x9f) return { spread: DESCRIPTION_BAND.maxSpread, isGrowing: false }
    spread *= 4
  }
  return { spread, isGrowing: true }
}

/** 알파가 0 아래로 내려가 줄을 멈추는 x — 80 + ⌈200/3⌉ */
export const DESCRIPTION_BAND_FADE_END = DESCRIPTION_BAND.solidUntil + Math.ceil(DESCRIPTION_BAND.alpha / DESCRIPTION_BAND.alphaStep)
