import { rainDrawingOf, type SceneRain } from '@/entities/batting/model/settlementEffect'

/** 비 그리기 — 빗방울 0x8f8ec(선, 0xc7c7c7 · 짙기 +0xe) · 튐 0x8fb08(흰 점, 수명 3 은 가로선 ±2 도) */
export function drawRain(context: CanvasRenderingContext2D, rain: SceneRain): void {
  const { lines, dots, bars } = rainDrawingOf(rain)
  context.save()
  context.lineWidth = 1
  context.strokeStyle = '#c7c7c7'
  for (const line of lines) {
    context.globalAlpha = line.alpha / 255
    context.beginPath()
    context.moveTo(line.x0 + 0.5, line.y0 + 0.5)
    context.lineTo(line.x1 + 0.5, line.y1 + 0.5)
    context.stroke()
  }
  context.globalAlpha = 1
  context.strokeStyle = '#ffffff'
  context.fillStyle = '#ffffff'
  for (const bar of bars) context.fillRect(bar.x - 2, bar.y, 5, 1)
  for (const dot of dots) context.fillRect(dot.x, dot.y, 1, 1)
  context.restore()
}
