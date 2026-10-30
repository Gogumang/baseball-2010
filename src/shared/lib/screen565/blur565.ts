import { isBugFixed } from '@/shared/config/bugfixes'
import { rgbTo565 } from '@/shared/lib/screen565/color565'

/** 0xbdd64 의 이웃 표 — 모드 0 대각 둘 · 1 네 이웃 · 2 여덟 이웃 (밀기 1 · 2 · 3) */
function neighborOffsetsOf(mode: number, width: number): { readonly offsets: readonly number[]; readonly shift: number } {
  if (mode === 0) return { offsets: [1 - width, width - 1], shift: 1 }
  if (mode === 1) return { offsets: [-1, 1, -width, width], shift: 2 }
  return { offsets: [-width - 1, -width, 1 - width, -1, 1, width - 1, width, width + 1], shift: 3 }
}

/** 한 칸의 이웃 평균 — 채널마다 이웃 합을 밀기만큼 나눈다 */
function neighborAverage565(source: Uint16Array, at: number, offsets: readonly number[], shift: number): number {
  let r = 0
  let g = 0
  let b = 0
  for (const offset of offsets) {
    const p = source[at + offset]
    r += (p & 0xf800) >> 8
    g += (p & 0x7e0) >> 3
    b += (p & 0x1f) << 3
  }
  return rgbTo565(r >> shift, g >> shift, b >> shift)
}

/** 가장자리 채우기 — 첫 줄 ← 둘째 줄, 끝 줄 ← 끝 앞 줄, 줄마다 첫 칸 ← 둘째 칸 · 끝 칸 ← 끝 앞 칸 */
function fillEdges565(pixels: Uint16Array, width: number, height: number): void {
  pixels.copyWithin(0, width, width * 2)
  pixels.copyWithin((height - 1) * width, (height - 2) * width, (height - 1) * width)
  for (let y = 0; y < height; y += 1) {
    pixels[y * width] = pixels[y * width + 1]
    pixels[y * width + width - 1] = pixels[y * width + width - 2]
  }
}

/**
 * 0xbdd65(모드) → 0xbdc2c — 제자리 이웃 평균 흐리기와 가장자리 채우기. `pixels` 를 고친다.
 * 원본은 제자리라 왼쪽 · 위 이웃이 이미 흐린 값이다(B-91 — 오른쪽 아래로 끌린다). 고친 길은 흐리기 전 화면 사본에서 이웃을 읽는다
 */
export function blurScreen565(pixels: Uint16Array, width: number, height: number, mode: number): void {
  const { offsets, shift } = neighborOffsetsOf(mode, width)
  const source = isBugFixed('B-91') ? pixels.slice() : pixels
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) pixels[y * width + x] = neighborAverage565(source, y * width + x, offsets, shift)
  }
  fillEdges565(pixels, width, height)
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
  const field = (bits: number) => (bits >> n) << n
  const mask = (field(0x1f) << 11) | (field(0x3f) << 5) | field(0x1f)
  const rowEnd = Math.min(height, h) - n
  const columnEnd = w - n
  for (let row = y; row < rowEnd; row += 1) {
    for (let column = x; column < columnEnd; column += 1) pixels[row * width + column] = rightDownSum565(pixels, row * width + column, width, mask, n)
  }
}

/** c3512 · c353e — 오른쪽 n 칸 합 + 아래 n 줄 합 (각 합 · 결과 모두 16 비트로 자른다) */
function rightDownSum565(pixels: Uint16Array, at: number, width: number, mask: number, n: number): number {
  let right = 0
  let down = 0
  for (let step = 1; step <= n; step += 1) {
    right = (right + ((pixels[at + step] & mask) >> n)) & 0xffff
    down = (down + ((pixels[at + step * width] & mask) >> n)) & 0xffff
  }
  return (right + down) & 0xffff
}
