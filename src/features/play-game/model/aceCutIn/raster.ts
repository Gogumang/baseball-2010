import type { CutInPoint } from '@/features/play-game/model/aceCutIn/types'

interface Span {
  readonly y: number
  readonly x0: number
  readonly x1: number
}

/** 변 (i−1, i) 가 가로줄 y 를 지나는가 — `(yi < y ≤ yj) || (yj < y ≤ yi)` 이고 yi ≠ yj */
function edgeCrosses(pi: CutInPoint, pj: CutInPoint, y: number): boolean {
  const crosses = (pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)
  return crosses && pj.y !== pi.y
}

/** 가로줄 y 가 다각형 변과 만나는 x 들 — x = xi + (y − yi)(xj − xi) / (yj − yi) (0 쪽으로 자름), 오름차순 */
function crossingsAt(points: readonly CutInPoint[], y: number): number[] {
  const crossings: number[] = []
  for (let i = 0; i < points.length; i += 1) {
    const pi = points[i]
    const pj = points[(i + points.length - 1) % points.length]
    if (edgeCrosses(pi, pj, y)) crossings.push(pi.x + Math.trunc(((y - pi.y) * (pj.x - pi.x)) / (pj.y - pi.y)))
  }
  return crossings.sort((a, b) => a - b)
}

/** 만난 x 를 둘씩 [최소 x, 최대 x] 로 잘라 가로선으로 — 왼 끝이 상자 오른쪽을 넘으면 그 줄은 끝 */
function pushRowSpans(spans: Span[], crossings: readonly number[], y: number, minX: number, maxX: number): void {
  for (let k = 0; k < crossings.length; k += 2) {
    const left = crossings[k]
    if (left >= maxX) return
    const right = crossings[k + 1] ?? left
    if (right > minX) spans.push({ y, x0: Math.max(left, minX), x1: Math.min(right, maxX) })
  }
}

/**
 * 0x75c70 의 스캔라인 — 가로선 [x0, x1] (양 끝 포함) 들. 0x75ba5 가 적은 상자(최소·최대 x · y)를 쓴다.
 */
export function scanlineSpans(points: readonly CutInPoint[]): readonly Span[] {
  if (points.length < 3) return []
  const ys = points.map((point) => point.y)
  const xs = points.map((point) => point.x)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spans: Span[] = []
  for (let y = minY; y < maxY; y += 1) pushRowSpans(spans, crossingsAt(points, y), y, minX, maxX)
  return spans
}

/** 선의 점들 — 브레젠험 (양 끝 포함). ⚠️ 근사(남김 — 단말 몫 · 바이너리 밖): 플랫폼 drawLine 0x14006c8 의 본문은 바이너리에 없다 — 가로 · 세로선은 같고 빗선은 브레젠험 */
export function linePixels(from: CutInPoint, to: CutInPoint): readonly CutInPoint[] {
  const pixels: CutInPoint[] = []
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - from.x)
  const dy = -Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let error = dx + dy
  for (let guard = 0; guard < 4096; guard += 1) {
    pixels.push({ x, y })
    if (x === to.x && y === to.y) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += sx
    }
    if (doubled <= dx) {
      error += dx
      y += sy
    }
  }
  return pixels
}
