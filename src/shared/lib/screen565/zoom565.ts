/** bb4ae — 원본 상자의 시작: 가운데 − 폭/2 를 0 ~ (한계 − 폭) 안으로 (넘치면 당기고 다시 음수면 0) */
function zoomStartOf(center: number, span: number, limit: number): number {
  let start = center - (span >> 1)
  if (start < 0) start = 0
  if (start + span >= limit) {
    start -= start + span - limit
    if (start < 0) start = 0
  }
  return start
}

/** 확대 덩이 한 줄 — 원본 칸 (sx + c, 그 줄) 마다 fy + 1 줄에 fx + 1 칸씩 찍는다 (0xb9588, 나중 칸이 덮는다) */
interface ZoomBuffer {
  readonly cells: Int32Array
  readonly width: number
  readonly height: number
  readonly kx: number
  readonly fx: number
  readonly fy: number
}

function stampZoomRow(buffer: ZoomBuffer, sourceRow: number, sw: number, dy: number): void {
  const { cells, width: bw, height: bh, kx, fx, fy } = buffer
  for (let c = 0; c < sw; c += 1) {
    const x0 = Math.min(bw - fx - 1, (c * kx) >> 12)
    for (let i = 0; i <= fy; i += 1) {
      const line = Math.min(bh - 1, dy + i) * bw
      cells.fill(sourceRow + c, line + x0, line + x0 + fx + 1)
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
  const sx = zoomStartOf(centerX, sw, width)
  const sy = zoomStartOf(centerY, sh, height)
  const kx = Math.trunc((width << 12) / sw)
  const ky = Math.trunc((height << 12) / sh)
  const bw = ((sw * kx) >> 12) + 1
  const bh = ((sh * ky) >> 12) + 1
  const buffer: ZoomBuffer = { cells: new Int32Array(bw * bh).fill(-1), width: bw, height: bh, kx, fx: kx >> 12, fy: ky >> 12 }
  for (let r = 0; r < sh; r += 1) stampZoomRow(buffer, (sy + r) * width + sx, sw, (r * ky) >> 12)
  const indexes = new Int32Array(width * height).fill(-1)
  const rows = Math.min(height, bh)
  for (let row = 0; row < rows; row += 1) {
    indexes.set(buffer.cells.subarray(row * bw, row * bw + width), row * width)
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
