/** 8비트 → 565 (에셋은 565 를 비트 복제로 늘린 값이라 위 비트만 남기면 원래 값이다) */
export const rgbTo565 = (r: number, g: number, b: number) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)

/** 565 → 8비트 (비트 복제) */
export function rgbOf565(pixel: number): readonly [number, number, number] {
  const r = (pixel >> 11) & 0x1f
  const g = (pixel >> 5) & 0x3f
  const b = pixel & 0x1f
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

/** 0x9a628 — 단계 3 덮기: 화면 3/4 + 색 1/4 를 마스크로 더한다 */
export const whitenStep3Of565 = (pixel: number, color: number) => ((pixel & 0xf7de) >> 1) + ((pixel & 0xe79c) >> 2) + ((color & 0xe79c) >> 2)
