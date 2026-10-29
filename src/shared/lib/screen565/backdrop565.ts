import { blurScreen565 } from '@/shared/lib/screen565/blur565'
import { rgbTo565, whitenStep3Of565 } from '@/shared/lib/screen565/color565'

/** 3줄 선 — 검정 알파 0x10. ⚠️ 섞기는 플랫폼 몫이라 칸마다 v × (255 − 알파) / 255 근사 */
export function darkenLine565(pixel: number, alpha: number): number {
  const keep = (value: number) => Math.round((value * (255 - alpha)) / 255)
  return (keep((pixel >> 11) & 0x1f) << 11) | (keep((pixel >> 5) & 0x3f) << 5) | keep(pixel & 0x1f)
}

/** 다시 짓기 바탕의 꼬리 — 흐리기 모드 1 · 3줄마다 선(알파 0x10) · 흰 단계 3 (0x58222~0x5828e · 0x583fc~0x58476 같은 차례) */
export const SKIN_BACKDROP_FINISH = { blurMode: 1, lineStep: 3, lineAlpha: 0x10 } as const

/** 한 줄 전체에 3줄 선을 긋는다 */
function darkenRow565(pixels: Uint16Array, row: number, width: number): void {
  for (let x = 0; x < width; x += 1) pixels[row * width + x] = darkenLine565(pixels[row * width + x], SKIN_BACKDROP_FINISH.lineAlpha)
}

/** 그린 화면(565)에 흐리기 → 3줄 선 → 흰 단계 3 을 차례로 — 0x581dc · 0x58371 의 다시 짓기 꼬리 */
export function finishSkinBackdrop565(pixels: Uint16Array, width: number, height: number): void {
  blurScreen565(pixels, width, height, SKIN_BACKDROP_FINISH.blurMode)
  for (let y = 0; y < height; y += SKIN_BACKDROP_FINISH.lineStep) darkenRow565(pixels, y, width)
  const white = rgbTo565(255, 255, 255)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = whitenStep3Of565(pixels[index], white)
}
