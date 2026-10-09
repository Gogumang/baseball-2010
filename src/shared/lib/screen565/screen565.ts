/**
 * **16비트(RGB565) 화면 연산** — 스킨 바탕 0x581dc · 0x58371 이 화면을 떠 두기 전에 하는 흐리기 · 3줄 선 · 흰 단계 3 덮기
 * (근거는 `pages/special/lib/skinBackdrops.ts` 머리 1-1 ~ 1-3). 메뉴 바탕과 경기정보 구장 미리보기(0x5fd04 → 0x581dc)가 같이 쓴다.
 */

/** 8비트 → 565 (에셋은 565 를 비트 복제로 늘린 값이라 위 비트만 남기면 원래 값이다) */
export const rgbTo565 = (r: number, g: number, b: number) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)

/** 565 → 8비트 (비트 복제) */
export function rgbOf565(pixel: number): readonly [number, number, number] {
  const r = (pixel >> 11) & 0x1f
  const g = (pixel >> 5) & 0x3f
  const b = pixel & 0x1f
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

/** 0xbdd64 의 이웃 표 — 모드 0 대각 둘 · 1 네 이웃 · 2 여덟 이웃 (밀기 1 · 2 · 3) */
function neighborOffsetsOf(mode: number, width: number): { readonly offsets: readonly number[]; readonly shift: number } {
  if (mode === 0) return { offsets: [1 - width, width - 1], shift: 1 }
  if (mode === 1) return { offsets: [-1, 1, -width, width], shift: 2 }
  return { offsets: [-width - 1, -width, 1 - width, -1, 1, width - 1, width, width + 1], shift: 3 }
}

/** 0xbdd65(모드) → 0xbdc2c — 제자리 이웃 평균 흐리기와 가장자리 채우기. `pixels` 를 고친다 */
export function blurScreen565(pixels: Uint16Array, width: number, height: number, mode: number): void {
  const { offsets, shift } = neighborOffsetsOf(mode, width)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      let r = 0
      let g = 0
      let b = 0
      for (const offset of offsets) {
        const p = pixels[at + offset]
        r += (p & 0xf800) >> 8
        g += (p & 0x7e0) >> 3
        b += (p & 0x1f) << 3
      }
      pixels[at] = rgbTo565(r >> shift, g >> shift, b >> shift)
    }
  }
  pixels.copyWithin(0, width, width * 2)
  pixels.copyWithin((height - 1) * width, (height - 2) * width, (height - 1) * width)
  for (let y = 0; y < height; y += 1) {
    pixels[y * width] = pixels[y * width + 1]
    pixels[y * width + width - 1] = pixels[y * width + width - 2]
  }
}

/** 0x9a628 — 단계 3 덮기: 화면 3/4 + 색 1/4 를 마스크로 더한다 */
export const whitenStep3Of565 = (pixel: number, color: number) =>
  ((pixel & 0xf7de) >> 1) + ((pixel & 0xe79c) >> 2) + ((color & 0xe79c) >> 2)

/** 3줄 선 — 검정 알파 0x10. ⚠️ 섞기는 플랫폼 몫이라 칸마다 v × (255 − 알파) / 255 근사 */
export function darkenLine565(pixel: number, alpha: number): number {
  const keep = (value: number) => Math.round((value * (255 - alpha)) / 255)
  return (keep((pixel >> 11) & 0x1f) << 11) | (keep((pixel >> 5) & 0x3f) << 5) | keep(pixel & 0x1f)
}

/** 다시 짓기 바탕의 꼬리 — 흐리기 모드 1 · 3줄마다 선(알파 0x10) · 흰 단계 3 (0x58222~0x5828e · 0x583fc~0x58476 같은 차례) */
export const SKIN_BACKDROP_FINISH = { blurMode: 1, lineStep: 3, lineAlpha: 0x10 } as const

/** 그린 화면(565)에 흐리기 → 3줄 선 → 흰 단계 3 을 차례로 — 0x581dc · 0x58371 의 다시 짓기 꼬리 */
export function finishSkinBackdrop565(pixels: Uint16Array, width: number, height: number): void {
  blurScreen565(pixels, width, height, SKIN_BACKDROP_FINISH.blurMode)
  for (let y = 0; y < height; y += SKIN_BACKDROP_FINISH.lineStep) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = darkenLine565(pixels[y * width + x], SKIN_BACKDROP_FINISH.lineAlpha)
    }
  }
  const white = rgbTo565(255, 255, 255)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = whitenStep3Of565(pixels[index], white)
}

/** 캔버스 그림을 565 로 떠 `finishSkinBackdrop565` 를 한 뒤 다시 그 자리에 놓는다 */
export function finishSkinBackdropOnCanvas(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height)
  const pixels = new Uint16Array(width * height)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = rgbTo565(image.data[index * 4], image.data[index * 4 + 1], image.data[index * 4 + 2])
  }
  finishSkinBackdrop565(pixels, width, height)
  for (let index = 0; index < pixels.length; index += 1) {
    const [r, g, b] = rgbOf565(pixels[index])
    image.data[index * 4] = r
    image.data[index * 4 + 1] = g
    image.data[index * 4 + 2] = b
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
