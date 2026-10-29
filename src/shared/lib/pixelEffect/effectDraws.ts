import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/effectNumbers'
import { isEffectDrawn } from '@/shared/lib/pixelEffect/effectPixel565'
import { composeRgba, type RgbaSurface } from '@/shared/lib/pixelEffect/composeRgba'

/** 효과 그리기 한 번 — 그림 RGBA · 화면 좌표(정수로 내린다) */
export interface EffectDraw {
  readonly sprite: RgbaSurface
  readonly x: number
  readonly y: number
  readonly effect: number
  readonly argument: number
}

interface PixelRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** 모아 둔 그리기 — 그리기와 화면 안으로 자른 칸 */
interface PendingDraw {
  readonly draw: EffectDraw
  readonly rect: PixelRect
}

/** 화면(width × height) 안으로 자른 그리기 칸 — 안 보이면 null */
function clippedRectOf(draw: EffectDraw, width: number, height: number): PixelRect | null {
  const x = Math.floor(draw.x)
  const y = Math.floor(draw.y)
  const rect = {
    left: Math.max(0, x),
    top: Math.max(0, y),
    right: Math.min(width, x + draw.sprite.width),
    bottom: Math.min(height, y + draw.sprite.height),
  }
  return rect.right <= rect.left || rect.bottom <= rect.top ? null : rect
}

const overlaps = (a: PixelRect, b: PixelRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** 칸 묶음의 테두리 */
function boundsOf(rects: readonly PixelRect[]): PixelRect {
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  }
}

/** 버퍼 한 줄의 칸 count 개가 모두 불투명(알파 255)인가 — at 은 첫 칸의 알파 자리 */
function isRowOpaque(data: Uint8ClampedArray, at: number, count: number): boolean {
  for (let column = 0; column < count; column += 1) if (data[at + column * 4] !== 255) return false
  return true
}

/** 버퍼 칸 안이 모두 불투명(알파 255)인가 */
function isOpaque(surface: RgbaSurface, rect: PixelRect, origin: PixelRect): boolean {
  for (let row = rect.top; row < rect.bottom; row += 1) {
    const at = ((row - origin.top) * surface.width + (rect.left - origin.left)) * 4 + 3
    if (!isRowOpaque(surface.data, at, rect.right - rect.left)) return false
  }
  return true
}

/** `drawImageWithEffect` 가 쓰는 캔버스 쪽 — 시험에서 가짜로 바꿔 끼운다 */
export type EffectCanvasContext = Pick<CanvasRenderingContext2D, 'getImageData' | 'putImageData'> & {
  readonly canvas: { readonly width: number; readonly height: number }
}

/**
 * 그림 RGBA 를 캔버스에 효과로 그린다(변환 없는 캔버스) — 그 자리 화면을 읽어(`getImageData`) `composeRgba` 로 섞고 다시 놓는다.
 * 좌표는 정수로 내린다(원본 화면 좌표는 정수다).
 */
export function drawRgbaWithEffect(context: EffectCanvasContext, draw: EffectDraw): void {
  if (!isEffectDrawn(draw.effect, draw.argument)) return
  const rect = clippedRectOf(draw, context.canvas.width, context.canvas.height)
  if (rect === null) return
  const region = context.getImageData(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
  composeRgba(
    { data: region.data, width: region.width, height: region.height },
    draw.sprite,
    Math.floor(draw.x) - rect.left,
    Math.floor(draw.y) - rect.top,
    draw.effect,
    draw.argument,
  )
  context.putImageData(region, rect.left, rect.top)
}

/**
 * 효과 그리기 여럿을 차례대로 — `drawRgbaWithEffect` 를 하나씩 부른 것과 **같은 픽셀**을 내되 화면 읽기 · 쓰기를 모은다.
 *
 * - 모두의 테두리를 한 번 읽는다. 그 칸이 다 불투명하면 버퍼 위에서 차례대로 섞고 한 번 놓는다
 *   (불투명 칸은 읽기 · 놓기 왕복이 값을 안 바꾸고, 불투명 화면에 섞은 결과도 불투명이다 — 하나씩 그린 것과 같다).
 * - 투명 · 반투명 칸이 있으면(겹치기 층) 왕복이 반투명 값을 반올림할 수 있다 — 그래서 **서로 안 겹치는** 이어진 그리기끼리만
 *   한 번 읽은 버퍼에서 섞고, 저마다 제 칸만(dirty 사각형) 놓는다. 겹치면 그 앞에서 끊고 다시 읽는다.
 * - 효과 4(흔들기)는 버퍼 줄 끝을 넘어 읽어 읽은 칸 크기에 따라 결과가 달라진다 — 그 앞뒤로 끊어 하나씩 그린다.
 */
export function drawRgbasWithEffect(context: EffectCanvasContext, draws: readonly EffectDraw[]): void {
  const { width, height } = context.canvas
  const pending: PendingDraw[] = []
  for (const draw of draws) {
    if (!isEffectDrawn(draw.effect, draw.argument)) continue
    if (draw.effect === DRAW_EFFECT.JITTER) {
      flushEffectDraws(context, pending.splice(0))
      drawRgbaWithEffect(context, draw)
      continue
    }
    const rect = clippedRectOf(draw, width, height)
    if (rect !== null) pending.push({ draw, rect })
  }
  flushEffectDraws(context, pending)
}

/** start 부터 서로 안 겹치는 이어진 그리기의 끝(미포함) — 앞 것들 누구와도 안 겹치는 동안 늘린다 */
function disjointRunEnd(pending: readonly PendingDraw[], start: number): number {
  let end = start
  while (end < pending.length && pending.slice(start, end).every((item) => !overlaps(item.rect, pending[end].rect))) end += 1
  return end
}

/**
 * start 부터 한 번 읽은 테두리 버퍼로 섞고 놓는다 — 다 불투명하면 남은 것 모두를 한 번에, 아니면 안 겹치는 이어진 것만 저마다 제 칸으로.
 * 다음에 읽을 첫 그리기 번호를 돌려준다.
 */
function flushRun(context: EffectCanvasContext, pending: readonly PendingDraw[], start: number): number {
  const bounds = boundsOf(pending.slice(start).map((item) => item.rect))
  const region = context.getImageData(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top)
  const surface = { data: region.data, width: region.width, height: region.height }
  const composeAt = (draw: EffectDraw) =>
    composeRgba(surface, draw.sprite, Math.floor(draw.x) - bounds.left, Math.floor(draw.y) - bounds.top, draw.effect, draw.argument)
  if (isOpaque(surface, bounds, bounds)) {
    for (let index = start; index < pending.length; index += 1) composeAt(pending[index].draw)
    context.putImageData(region, bounds.left, bounds.top)
    return pending.length
  }
  // 서로 안 겹치는 이어진 그리기 — 이 버퍼(읽은 그대로의 화면)에서 섞고 제 칸만 놓는다
  const end = disjointRunEnd(pending, start)
  for (let index = start; index < end; index += 1) {
    const { draw, rect } = pending[index]
    composeAt(draw)
    context.putImageData(
      region,
      bounds.left,
      bounds.top,
      rect.left - bounds.left,
      rect.top - bounds.top,
      rect.right - rect.left,
      rect.bottom - rect.top,
    )
  }
  return end
}

function flushEffectDraws(context: EffectCanvasContext, pending: readonly PendingDraw[]): void {
  let start = 0
  while (start < pending.length) start = flushRun(context, pending, start)
}
