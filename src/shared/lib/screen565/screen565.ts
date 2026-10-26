/**
 * **16비트(RGB565) 화면 연산** — 스킨 바탕 0x581dc · 0x58371 이 화면을 떠 두기 전에 하는 흐리기 · 3줄 선 · 흰 단계 3 덮기
 * (근거는 `pages/special/lib/skinBackdrops.ts` 머리 1-1 ~ 1-3). 메뉴 바탕과 경기정보 구장 미리보기(0x5fd04 → 0x581dc)가 같이 쓴다.
 */
import { isBugFixed } from '@/shared/config/bugfixes'

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

/**
 * 0xbdd65(모드) → 0xbdc2c — 제자리 이웃 평균 흐리기와 가장자리 채우기. `pixels` 를 고친다.
 * 원본은 제자리라 왼쪽 · 위 이웃이 이미 흐린 값이다(B-91 — 오른쪽 아래로 끌린다). 고친 길은 흐리기 전 화면 사본에서 이웃을 읽는다
 */
export function blurScreen565(pixels: Uint16Array, width: number, height: number, mode: number): void {
  const { offsets, shift } = neighborOffsetsOf(mode, width)
  const source = isBugFixed('B-91') ? pixels.slice() : pixels
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      let r = 0
      let g = 0
      let b = 0
      for (const offset of offsets) {
        const p = source[at + offset]
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

/**
 * **0xc3468(gfx, x, y, w, h, n) — 오른쪽 · 아래 이웃 평균 흐리기** (2026-10-24 직접 떴다 — 큰 타구 0x13 그리기 0x4cb1c 의 4cc62 · 4cdd6).
 * ```
 * c3484  행 너비 = 폭 × 2 바이트 · 시작 = 화면 버퍼 + [gfx+0x40] 줄
 * c34b8  끝 줄 = min(H − [gfx+0x40], h) − n · 끝 칸 = w − n (둘 다 미포함)
 * c34c2  가리개 = 채널마다 아래 n 비트를 지운 565 ((0x1f >> n << n) << 11 | (0x3f >> n << n) << 5 | (0x1f >> n << n))
 * c3512  오른쪽 n 칸 Σ ((p & 가리개) >> n) · c353e 아래 n 줄 Σ ((p & 가리개) >> n) — 각 합은 16 비트로 자른다
 * c3568  제자리에 (오른쪽 합 + 아래 합) & 0xffff
 * ```
 * 왼쪽 위에서 오른쪽 아래로 제자리에 쓰므로 읽는 이웃(오른쪽 · 아래)은 늘 아직 안 고친 값이다. 칸마다 2n 이웃을 2^n 으로 나눠 더하니
 * n = 1 이면 둘의 평균, n = 2 면 넷의 평균이다. 끝 n 칸 · n 줄은 그대로 남는다. `pixels` 를 고친다.
 */
export function blurRightDown565(pixels: Uint16Array, width: number, height: number, x: number, y: number, w: number, h: number, n: number): void {
  const field = (bits: number) => ((bits >> n) << n)
  const mask = (field(0x1f) << 11) | (field(0x3f) << 5) | field(0x1f)
  const rowEnd = Math.min(height, h) - n
  const columnEnd = w - n
  for (let row = y; row < rowEnd; row += 1) {
    for (let column = x; column < columnEnd; column += 1) {
      const at = row * width + column
      let right = 0
      let down = 0
      for (let step = 1; step <= n; step += 1) {
        right = (right + ((pixels[at + step] & mask) >> n)) & 0xffff
        down = (down + ((pixels[at + step * width] & mask) >> n)) & 0xffff
      }
      pixels[at] = (right + down) & 0xffff
    }
  }
}

/**
 * **0xbb43c(cx, cy, 배율 %, px, py) — 화면 확대** (2026-10-24 직접 떴다 — 큰 타구 0x13 그리기 0x4cb1c 의 4cc34):
 * ```
 * bb48c  원본 상자 sw = trunc(W × 100 / 배율) · sh = trunc(H × 100 / 배율)
 * bb4ae  sx = px + cx − (sw >> 1), 음수면 0 · sx + sw ≥ W 면 sx −= sx + sw − W (다시 음수면 0) — sy 도 py + cy 로 같다
 * bb55a  kx = trunc((W << 12) / sw) · ky = trunc((H << 12) / sh) · 덩이 fx = kx >> 12 · fy = ky >> 12 (0x6c64d 정수 제곱근 — 회전이 0 이라 그대로)
 * bb68a  임시 버퍼 bw × bh, bw = ((sw × kx) >> 12) + 1 · bh = ((sh × ky) >> 12) + 1
 * bb6da  원본 칸 (c, r) 마다 차례로: 점 = (sx + c, sy + r) 의 화소, dx = (c × kx) >> 12 · dy = (r × ky) >> 12,
 *        x0 = min(bw − fx − 1, dx), i = 0..fy 마다 줄 min(bh − 1, dy + i) 의 x0 부터 fx + 1 칸을 그 화소로 (0xb9588)
 * bb7b6  줄 min(H, bh) 개를 화면으로 — 줄마다 버퍼 줄의 앞 W 칸
 * ```
 * 곧 덩이를 겹쳐 찍는 최근접 확대다(나중 칸이 덮는다). 돌려주는 값은 화면 칸마다 가져올 원본 칸 번호 — 버퍼가 비는 칸(없다)은 −1.
 */
export function zoomSourceIndexes(width: number, height: number, percent: number, centerX: number, centerY: number): Int32Array {
  const sw = Math.trunc((width * 100) / percent)
  const sh = Math.trunc((height * 100) / percent)
  const startOf = (center: number, span: number, limit: number) => {
    let start = center - (span >> 1)
    if (start < 0) start = 0
    if (start + span >= limit) {
      start -= start + span - limit
      if (start < 0) start = 0
    }
    return start
  }
  const sx = startOf(centerX, sw, width)
  const sy = startOf(centerY, sh, height)
  const kx = Math.trunc((width << 12) / sw)
  const ky = Math.trunc((height << 12) / sh)
  const fx = kx >> 12
  const fy = ky >> 12
  const bw = ((sw * kx) >> 12) + 1
  const bh = ((sh * ky) >> 12) + 1
  const buffer = new Int32Array(bw * bh).fill(-1)
  for (let r = 0; r < sh; r += 1) {
    const dy = (r * ky) >> 12
    for (let c = 0; c < sw; c += 1) {
      const source = (sy + r) * width + sx + c
      const x0 = Math.min(bw - fx - 1, (c * kx) >> 12)
      for (let i = 0; i <= fy; i += 1) {
        const line = Math.min(bh - 1, dy + i) * bw
        buffer.fill(source, line + x0, line + x0 + fx + 1)
      }
    }
  }
  const indexes = new Int32Array(width * height).fill(-1)
  const rows = Math.min(height, bh)
  for (let row = 0; row < rows; row += 1) {
    indexes.set(buffer.subarray(row * bw, row * bw + width), row * width)
  }
  return indexes
}

/** 화면(565)을 확대표(`zoomSourceIndexes`)대로 바꾼다 — −1 칸은 그대로 둔다. `pixels` 를 고친다 */
export function applyZoom565(pixels: Uint16Array, indexes: Int32Array): void {
  const source = pixels.slice()
  for (let at = 0; at < pixels.length; at += 1) {
    const from = indexes[at]
    if (from >= 0) pixels[at] = source[from]
  }
}

/** 캔버스 그림을 565 로 떠 `edit` 로 고친 뒤 다시 그 자리에 놓는다(화면 버퍼를 직접 고치는 원본 함수 자리). 읽기가 안 되는 문맥이면 아무것도 안 한다 */
export function editScreen565OnCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  edit: (pixels: Uint16Array) => void,
): void {
  if (typeof context.getImageData !== 'function') return
  const image = context.getImageData(0, 0, width, height)
  const pixels = new Uint16Array(width * height)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = rgbTo565(image.data[index * 4], image.data[index * 4 + 1], image.data[index * 4 + 2])
  }
  edit(pixels)
  for (let index = 0; index < pixels.length; index += 1) {
    const [r, g, b] = rgbOf565(pixels[index])
    image.data[index * 4] = r
    image.data[index * 4 + 1] = g
    image.data[index * 4 + 2] = b
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
