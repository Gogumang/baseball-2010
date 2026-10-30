import { finishSkinBackdrop565 } from '@/shared/lib/screen565/backdrop565'
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/color565'

/** 캔버스 RGBA 를 565 로 뜬다 */
function pixels565Of(data: Uint8ClampedArray, count: number): Uint16Array {
  const pixels = new Uint16Array(count)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = rgbTo565(data[index * 4], data[index * 4 + 1], data[index * 4 + 2])
  }
  return pixels
}

/** 565 를 캔버스 RGBA 로 되돌린다 (알파 255) */
function writePixels565(data: Uint8ClampedArray, pixels: Uint16Array): void {
  for (let index = 0; index < pixels.length; index += 1) {
    const [r, g, b] = rgbOf565(pixels[index])
    data[index * 4] = r
    data[index * 4 + 1] = g
    data[index * 4 + 2] = b
    data[index * 4 + 3] = 255
  }
}

/** 캔버스 그림을 565 로 떠 `edit` 로 고친 뒤 다시 그 자리에 놓는다 */
function edit565InPlace(context: CanvasRenderingContext2D, width: number, height: number, edit: (pixels: Uint16Array) => void): void {
  const image = context.getImageData(0, 0, width, height)
  const pixels = pixels565Of(image.data, width * height)
  edit(pixels)
  writePixels565(image.data, pixels)
  context.putImageData(image, 0, 0)
}

/** 캔버스 그림을 565 로 떠 `finishSkinBackdrop565` 를 한 뒤 다시 그 자리에 놓는다 */
export function finishSkinBackdropOnCanvas(context: CanvasRenderingContext2D, width: number, height: number): void {
  edit565InPlace(context, width, height, (pixels) => finishSkinBackdrop565(pixels, width, height))
}

/** 캔버스 그림을 565 로 떠 `edit` 로 고친 뒤 다시 그 자리에 놓는다(화면 버퍼를 직접 고치는 원본 함수 자리). 읽기가 안 되는 문맥이면 아무것도 안 한다 */
export function editScreen565OnCanvas(context: CanvasRenderingContext2D, width: number, height: number, edit: (pixels: Uint16Array) => void): void {
  if (typeof context.getImageData !== 'function') return
  edit565InPlace(context, width, height, edit)
}
