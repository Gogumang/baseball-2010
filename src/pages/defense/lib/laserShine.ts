/**
 * **레이저 송구 반짝임 — 그리기 효과 0xc(12) · 인자 = 색** (원본 직접 뜸, 2026-10-14).
 *
 * 부르는 길: 야수 그리기 0x43278 의 0x43406~0x4342c — 이 야수가 공 가진 야수(플레이 +0x130)이고 경기 +0x19ad(반짝임)이 서고
 * +0x1990 == 0 이면 `[sp+0x50] = 12` · `[sp+0x4c] = 0x1400748(255, 0, 0)` 을 0x79b48 의 효과 · 인자로 넘긴다(43480~43490).
 * 0x79b48 은 그것을 그대로 0xbe8d5 → 0xbe810(그리기 목록에 넣기)으로 보내 프레임 그리기의 **효과 번호**가 된다 —
 * 0xbb91d(홈런 글자의 종류 2 · 8) 길이 아니다.
 *
 * 효과 번호마다 픽셀 함수는 시작 코드 0x30b2~0x30c0 에서 등록된다: 효과 0xc = 16비트 0x9af71 · 팔레트 0x98351 / 0x983d1.
 * 셋 다 같은 식이다(0x98394~0x983a8 · 0x9af88~0x9afa8 · 0x98458~0x9846a):
 * ```
 * 그림 픽셀이 투명(16비트판은 [sp+0x28] 투명색과 같으면 · 팔레트판은 칸 수 부호가 투명 칸)이면 건너뜀
 * out = (그림 & 0xf7de) >> 1  +  (색 & 0xf7de) >> 1          ; RGB565 채널마다 반반
 * ```
 * 곧 **화면은 안 보고**, 그림 픽셀과 인자 색을 반씩 섞어 그 자리에 찍는다 — 몸 전체(그림이 있는 모든 칸)가 빨강 쪽으로 반 물든다.
 * 색 (255, 0, 0) → 565 0xf800 → 반은 R5 15. 그러니 R5 = 그림 R5 / 2 + 15 · G6 = 그림 G6 / 2 · B5 = 그림 B5 / 2.
 */
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'

/** 0x1400748(255, 0, 0) — 반짝임 색 (RGB565) */
export const LASER_SHINE_COLOR_565 = rgbTo565(255, 0, 0)

/** 효과 0xc 한 픽셀 — 0x98394~0x983a8 */
export const shinePixel565 = (pixel: number, color: number) => ((pixel & 0xf7de) >> 1) + ((color & 0xf7de) >> 1)

/**
 * RGBA 그림 전체에 효과 0xc 를 입힌다. 알파 0 인 칸(PZX 투명)은 그대로 둔다.
 * ⚠️ 근사: 구운 PNG 의 반투명 칸(알파 1~254 — 그림자 따위)은 원본 픽셀 함수가 따로 다루는지 안 봤다 — 색만 바꾸고 알파는 둔다.
 */
export function shinePixels(rgba: Uint8ClampedArray, color: number = LASER_SHINE_COLOR_565): Uint8ClampedArray {
  const output = new Uint8ClampedArray(rgba)
  for (let at = 0; at < output.length; at += 4) {
    if (output[at + 3] === 0) continue
    const [r, g, b] = rgbOf565(shinePixel565(rgbTo565(output[at], output[at + 1], output[at + 2]), color))
    output[at] = r
    output[at + 1] = g
    output[at + 2] = b
  }
  return output
}

const shined = new Map<string, Promise<string>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

async function paintShine(url: string): Promise<string> {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return url
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  pixels.data.set(shinePixels(pixels.data))
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 효과 0xc(빨강)를 입힌 그림 주소. 같은 그림은 한 번만 칠한다. 실패하면 원래 주소 */
export function shinedSpriteUrl(url: string): Promise<string> {
  const cached = shined.get(url)
  if (cached !== undefined) return cached
  const request = paintShine(url).catch(() => url)
  shined.set(url, request)
  return request
}
