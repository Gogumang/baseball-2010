/**
 * **원본 그림 늘이기 · 줄이기** `0x662dc` → `0x65f64` (r128 직접 뜸, unicorn 으로 돌려 바이트까지 맞췄다).
 *
 * 팀 로고 0x663c4 가 15 팀마다 `0x662dc(skin, team_logo 그림[팀], skin+0x4c8 + 팀·16, 0, 0, 0x23, 0x22)` 로 부른다 —
 * 그 버퍼(폭 · 높이 · 픽셀)를 0x66431 이 제 크기로 찍는다(0 번 색 건너뜀). 부르는 곳: 팀 격자 0x7a690(7b31a · 7b33a) ·
 * 경기 뒤 결과판 0xb400(b610 · b648) · 대진표 0x853ac(854ac).
 *
 * 0x662dc(this, 그림, 버퍼, x, y, 폭, 높이):
 * ```
 * 662f4 / 66300  W = 그림->[0x1c]() · H = 그림->[0x20]()
 * 6630e / 6631a  a = (폭 << 12) / W · d = (높이 << 12) / H        ; 0xca7b5 부호 있는 나눗셈 — 가로 세로 **따로**
 * 66322~6633c    행렬 [a, 0, x << 12, 0, d, y << 12] · 0x65f64(this, 그림, 버퍼, &행렬, x, y, 0, 0, W, H)
 * ```
 * 0x65f64 — **원본 픽셀을 하나씩 앞으로 찍는** 아핀(4.12 고정소수) 복사:
 * ```
 * 65faa~66012    그림 +0x18 의 RLE(u16: 0xffff 끝 · 0xfffe 건너뜀 · 비트15 끔 = 0 n 개 · 켬 = 낱값 n 개)를 W·H 버퍼로 푼다
 * 66014~66026    tx · ty 의 소수부를 버린다 (asr 12 · lsl 12)
 * 66028~66060    fx = 0x6c64c((a>>12)² + (b>>12)²) · fy = 0x6c64c((c>>12)² + (d>>12)²)
 *                0x6c64c(v) = 뉴턴 제곱근(0x6c608: x = 0xffff 부터 x −= (x² − v) /u (2x), 그대로면 멈춤) − 1
 *                (위에서 내려와 걸음이 0 이면 멈추므로 v = 1 은 x = 2 에서 서 1 — v = 0 만 0. unicorn 값으로 시험)
 * 66062~66126    네 귀 (0,0) (W,0) (0,H) (W,H) 를 (· + t) >> 12 로 옮겨 최소(처음 320) · 최대(처음 0)
 * 66128~6615e    버퍼 폭 = 최대x − 최소x + 1 · 높이 = 최대y − 최소y + 1 · 픽셀 = 할당(폭·높이)
 * 6616e~66234    원본 행 · 열 차례로: X = ((열·a + 행·b + tx) >> 12) − 최소x · Y = (열·c + 행·d + ty) >> 12 − 최소y
 *                k = 0..fy: memset(버퍼 + 폭·min(높이 − 1, Y + k) + min(폭 − fx − 1, X), 픽셀, fx + 1)   ; 0 번 색도 찍는다
 * 66244~662b4    구멍 메우기 — 안쪽 칸(1..높이−2 × 1..폭−2)을 행 차례로, 그 칸이 0 이면
 *                  왼 ≠ 0 && 오른 ≠ 0 → 왼 값 / 이어서 아래 ≠ 0 && **위 오른쪽**(i − 폭 + 1) ≠ 0 → **아래 왼쪽**(i + 폭 − 1) 값
 *                (그 자리에서 고친 값을 다음 칸이 읽는다. 위 오른쪽 · 아래 왼쪽은 원본 그대로 옮긴다)
 * ```
 * 로고(77×76 따위)는 a >> 12 = 0 이라 fx = fy = 0 — 원본 한 픽셀이 한 칸에 찍히고, 같은 칸에 여럿이 오면 **나중(오른쪽 · 아래)** 것이
 * 남는다. 배율이 1 보다 작아 모든 칸이 덮이므로 구멍 메우기는 0 번 색 칸만 건드린다.
 *
 * 웹은 RLE 를 푼 픽셀(투명 = 0)에서 시작한다. 픽셀 값은 무엇이든(색 번호든 RGBA 묶음이든) 그대로 옮기기만 하므로 같다.
 * ⚠️ 미확인(남김 — 단말 몫 · 바이너리 밖): 할당 0x1400498 이 0 으로 채우는지 — 배율 ≥ 1 이라 덮이지 않는 칸이 생길 때만 갈린다(로고는 해당 없음). 웹은 0 으로 둔다.
 *   r181: 0x1400498 은 .data 의 늦은 연결 칸(`str lr,[sp,#-4]! ; bl …` + 단말 함수 번호 0x1fb · 0x6a)이라 본문이 바이너리 밖이다.
 *   인자 하나(크기)인 malloc 꼴이고, 다른 호출지(0x69b58 69b72 · 돌발 0x8e1b0 8e1ec)는 받자마자 memset 0x1400428(…, 0, 크기)을
 *   부르는데 여기(66152)는 안 부른다 — 처음 값은 단말 힙 몫이라 정할 수 없다.
 */

/** 줄인 그림 — 폭 · 높이 · 픽셀(행 우선) */
export interface ScaledPixels {
  readonly width: number
  readonly height: number
  readonly pixels: Uint32Array
}

/** 0x65f64 의 4.12 행렬 [a, b, tx, c, d, ty] — X = a·열 + b·행 + tx · Y = c·열 + d·행 + ty */
export type FixedAffine = readonly [number, number, number, number, number, number]

const FIXED_SHIFT = 12
/** 0x66040 · 0x6602a — 최소 좌표의 처음 값 0x140 */
const MINIMUM_START = 0x140

/** 0x6c608(제곱, 미분, v, 0xffff) — 정수 뉴턴 제곱근. 나눗셈은 0xca739 부호 없는 나눗셈 */
function newtonRootOf(value: number): number {
  let x = 0xffff
  let previous = x - 1
  for (;;) {
    const square = Math.imul(x, x) >>> 0
    if (x === previous) return x
    const step = Math.floor(((square - value) >>> 0) / ((x << 1) >>> 0))
    previous = x
    x = (x - step) | 0
  }
}

/** 0x6c64c — 뉴턴 제곱근 − 1 (찍는 덩어리 폭 − 1) */
export function splatExtentOf(value: number): number {
  return newtonRootOf(value >>> 0) - 1
}

/**
 * **0x65f64** — 원본 픽셀(`source`, 폭 `sourceWidth`)의 (srcX, srcY) 부터 regionWidth × regionHeight 를 행렬로 옮긴 새 버퍼.
 * 픽셀 0 은 원본 0 번 색(투명)이다.
 */
export function affineBlitPixels(
  source: Uint32Array,
  sourceWidth: number,
  sourceHeight: number,
  matrix: FixedAffine,
  region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): ScaledPixels | null {
  // 65f84~65f9c — 영역이 그림을 넘으면 아무것도 안 한다
  if (region.x + region.width > sourceWidth || region.y + region.height > sourceHeight) return null
  const [a, b, rawTx, c, d, rawTy] = matrix
  // 66014~66026 — 옮김의 소수부를 버린다
  const tx = (rawTx >> FIXED_SHIFT) << FIXED_SHIFT
  const ty = (rawTy >> FIXED_SHIFT) << FIXED_SHIFT
  const fx = splatExtentOf(Math.imul(a >> FIXED_SHIFT, a >> FIXED_SHIFT) + Math.imul(b >> FIXED_SHIFT, b >> FIXED_SHIFT))
  const fy = splatExtentOf(Math.imul(c >> FIXED_SHIFT, c >> FIXED_SHIFT) + Math.imul(d >> FIXED_SHIFT, d >> FIXED_SHIFT))

  // 66062~66126 — 네 귀
  let maxX = 0
  let maxY = 0
  let minX = MINIMUM_START
  let minY = MINIMUM_START
  const visit = (x: number, y: number) => {
    if (x > maxX) maxX = x
    if (x < minX) minX = x
    if (y > maxY) maxY = y
    if (y < minY) minY = y
  }
  const W = region.width
  const H = region.height
  const wa = Math.imul(W, a)
  const wc = Math.imul(W, c)
  const hb = Math.imul(H, b)
  const hd = Math.imul(H, d)
  visit(tx >> FIXED_SHIFT, ty >> FIXED_SHIFT)
  visit((wa + tx) >> FIXED_SHIFT, (wc + ty) >> FIXED_SHIFT)
  visit((hb + tx) >> FIXED_SHIFT, (hd + ty) >> FIXED_SHIFT)
  visit((wa + hb + tx) >> FIXED_SHIFT, (hd + wc + ty) >> FIXED_SHIFT)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  // ⚠️ 미확인(남김 — 단말 몫 · 바이너리 밖): 0x1400498 할당의 처음 값 — 0 으로 둔다(위 머리말)
  const pixels = new Uint32Array(Math.max(0, width * height))

  // 6616e~66234 — 원본 픽셀마다 (fx + 1) × (fy + 1) 덩어리를 찍는다
  const lastColumn = width - fx - 1
  for (let row = 0; row < H; row += 1) {
    const rowB = Math.imul(row, b)
    const rowD = Math.imul(row, d)
    const sourceRow = (region.y + row) * sourceWidth + region.x
    for (let column = 0; column < W; column += 1) {
      const pixel = source[sourceRow + column] ?? 0
      const x = (((Math.imul(column, a) + rowB) | 0) + tx >> FIXED_SHIFT) - minX
      const y = (((Math.imul(column, c) + rowD) | 0) + ty >> FIXED_SHIFT) - minY
      const left = Math.min(lastColumn, x)
      for (let k = 0; k <= fy; k += 1) {
        const at = width * Math.min(height - 1, y + k) + left
        pixels.fill(pixel, Math.max(0, at), Math.max(0, at + fx + 1))
      }
    }
  }

  // 66244~662b4 — 구멍 메우기. 폭 < 3 이면 원본은 열 끝(폭 − 1)을 지나쳐 버리므로 웹은 돌지 않는다
  if (height - 1 > 1 && width >= 3) {
    for (let row = 1; row <= height - 2; row += 1) {
      for (let column = 1; column <= width - 2; column += 1) {
        const at = row * width + column
        if (pixels[at] !== 0) continue
        const left = pixels[at - 1] ?? 0
        if (left !== 0 && pixels[at + 1] !== 0) pixels[at] = left
        if (pixels[at + width] !== 0 && pixels[at - width + 1] !== 0) pixels[at] = pixels[at + width - 1] ?? 0
      }
    }
  }
  return { width, height, pixels }
}

/**
 * **0x662dc(…, x, y, 폭, 높이)** — 그림 한 장을 폭 × 높이 로 늘이거나 줄인다(가로 세로 배율 따로). 결과 크기는 배율이 그림 크기로
 * 나눠떨어지면 한 칸 더 크다(예: 70 → 35 는 폭 36).
 */
export function scalePixelsLikeOriginal(
  source: Uint32Array,
  sourceWidth: number,
  sourceHeight: number,
  boxWidth: number,
  boxHeight: number,
): ScaledPixels | null {
  if (sourceWidth <= 0 || sourceHeight <= 0) return null
  const a = Math.trunc((boxWidth << FIXED_SHIFT) / sourceWidth)
  const d = Math.trunc((boxHeight << FIXED_SHIFT) / sourceHeight)
  return affineBlitPixels(source, sourceWidth, sourceHeight, [a, 0, 0, 0, d, 0], {
    x: 0, y: 0, width: sourceWidth, height: sourceHeight,
  })
}

/** 팀 로고 버퍼 크기 — 0x663c4 663e2~663e8 `0x23` · `0x22` */
export const TEAM_LOGO_BOX = { width: 0x23, height: 0x22 } as const

/**
 * RGBA 바이트 → 픽셀 값. 알파 0 은 원본 0 번 색(투명)이라 0 으로 모은다 — 0x65f64 · 0x66431 이 0 만 특별히 본다.
 * 구운 PNG 는 불투명 색이 알파 255 라 0 과 겹치지 않는다.
 */
export function packedPixelsOf(rgba: Uint8ClampedArray): Uint32Array {
  const packed = new Uint32Array(rgba.length >> 2)
  for (let index = 0; index < packed.length; index += 1) {
    const at = index << 2
    const alpha = rgba[at + 3] ?? 0
    packed[index] = alpha === 0
      ? 0
      : (((alpha << 24) | ((rgba[at + 2] ?? 0) << 16) | ((rgba[at + 1] ?? 0) << 8) | (rgba[at] ?? 0)) >>> 0)
  }
  return packed
}

/** 픽셀 값 → RGBA 바이트 (`packedPixelsOf` 의 거꾸로) */
export function rgbaOfPacked(packed: Uint32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(packed.length << 2)
  for (let index = 0; index < packed.length; index += 1) {
    const value = packed[index] ?? 0
    const at = index << 2
    rgba[at] = value & 0xff
    rgba[at + 1] = (value >>> 8) & 0xff
    rgba[at + 2] = (value >>> 16) & 0xff
    rgba[at + 3] = (value >>> 24) & 0xff
  }
  return rgba
}
