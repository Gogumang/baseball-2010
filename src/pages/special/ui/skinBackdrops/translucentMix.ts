/** 공 무늬 위 반투명 그림의 칸 계산 — 자리 · 줄 색 · 효과 1 섞기 (0x9a449, `translucentPixel565`) */
import { rgbOf565 } from '@/pages/special/lib/skinBackdrops'
import { translucentPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import type { Sprite565 } from '@/shared/lib/pixelEffect/screenCompose'

/** 그림이 캔버스 칸 안에 다 드는가 */
export function fitsInside(left: number, top: number, image: Sprite565, width: number, height: number): boolean {
  return left >= 0 && top >= 0 && left + image.width <= width && top + image.height <= height
}

/** 그림 줄마다 그 사이에 먼저 그린 줄 색 — 다룰 수 없는 줄(undefined)이 하나라도 있으면 null */
export function rowColorsOf(
  rowOver: ((y: number) => number | null | undefined) | undefined,
  placeY: number,
  height: number,
): (number | null)[] | null {
  const rows: (number | null)[] = []
  for (let row = 0; row < height; row += 1) {
    const over = rowOver === undefined ? null : rowOver(placeY + row)
    if (over === undefined) return null
    rows.push(over)
  }
  return rows
}

/** 효과 1 — 그림의 불투명 칸만 아래(줄 색이 있으면 그 색, 없으면 무늬)와 섞어 RGBA 로 적는다 (`translucentPixel565`) */
export function mixTranslucentImage(
  data: Uint8ClampedArray,
  image: Sprite565,
  rows: readonly (number | null)[],
  under: ArrayLike<number>,
  rectWidth: number,
  left: number,
  top: number,
  level: number,
): void {
  for (let row = 0; row < image.height; row += 1) mixRow(data, image, row, rows[row], under, (top + row) * rectWidth + left, level)
}

/** 그림 한 줄 — 불투명 칸만 적는다 (`start` = 캔버스에서 그 줄 첫 칸) */
function mixRow(
  data: Uint8ClampedArray,
  image: Sprite565,
  row: number,
  over: number | null | undefined,
  under: ArrayLike<number>,
  start: number,
  level: number,
): void {
  for (let column = 0; column < image.width; column += 1) {
    const from = row * image.width + column
    if (image.opaque[from] === 0) continue
    const at = start + column
    const [r, g, b] = rgbOf565(translucentPixel565(level, image.pixels[from], over ?? under[at]))
    data[at * 4] = r
    data[at * 4 + 1] = g
    data[at * 4 + 2] = b
    data[at * 4 + 3] = 255
  }
}

/** 그림 왼쪽 위 — `imagePlaceOf` 가 있으면 실제 크기로 잡은 자리, 없으면 (x, y) */
export function translucentPlaceOf(
  placeOf: ((width: number, height: number) => { readonly x: number; readonly y: number }) | undefined,
  image: Sprite565,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  return placeOf?.(image.width, image.height) ?? { x, y }
}
