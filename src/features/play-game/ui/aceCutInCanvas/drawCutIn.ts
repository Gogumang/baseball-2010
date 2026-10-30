import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { linePixels, scanlineSpans, type AceCutInDraw, type CutInColor, type CutInPolygon } from '@/features/play-game/model/aceCutIn'
import { DRAW_EFFECT, brightenedImageOf, drawImageWithEffect } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawFrameLayers, frameLayersUrl, placedFrameLayersOf, type FrameLayerListing } from '@/shared/lib/sprite/frameLayers'
import { spriteJsonNow } from '@/shared/lib/sprite/spriteCache'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI = assetUrl('./sprites/game_ui')
export const GAME_UI_FRAMES = `${GAME_UI}/frames`
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320
/** 효과 2 의 인자 — 화면 + 그림·230 >> 8 (0x9a2f1, 공용 `additivePixel565`) */
const ADDITIVE_WEIGHT = 230

const images = new Map<string, HTMLImageElement | null>()
/** 그림을 불러 둔다 — 아직이면 null(다음 그림부터 그려진다) */
function imageAt(url: string): HTMLImageElement | null {
  const cached = images.get(url)
  if (cached !== undefined) return cached
  images.set(url, null)
  const image = new Image()
  image.onload = () => images.set(url, image)
  image.src = url
  return null
}
const pad = (index: number) => String(index).padStart(3, '0')

/** 0xbb91d 종류 8 — 채널마다 +b (그림이 있는 칸만, 255 에서 자름) — 공용 `brightenedImageOf` (565 내림까지 원본대로) */
const brightened = brightenedImageOf

/** 0x6a905 · 0x6a9f1 — 윗바이트 알파가 0 · 255 면 불투명 */
function fillStyleOf(color: CutInColor): string {
  const opacity = color.alpha === 0 || color.alpha === 0xff ? 1 : color.alpha / 255
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
}

/** 0x75c70 채우기(가로선) 뒤 0x75dc4 테두리(닫힌 선) */
function drawPolygon(context: CanvasRenderingContext2D, polygon: CutInPolygon): void {
  context.fillStyle = fillStyleOf(polygon.fill)
  for (const span of scanlineSpans(polygon.points)) context.fillRect(span.x0, span.y, span.x1 - span.x0 + 1, 1)
  context.fillStyle = fillStyleOf(polygon.border)
  polygon.points.forEach((point, index) => {
    const next = polygon.points[(index + 1) % polygon.points.length]
    for (const pixel of linePixels(point, next)) context.fillRect(pixel.x, pixel.y, 1, 1)
  })
}

export interface Portrait {
  readonly folder: string
  readonly origins: FrameOrigins | null
  readonly frame: number | null
  readonly dx: number
  readonly dy: number
}

/**
 * 474f0 0xba759(game_ui, 0x55 + 단계 mod 5, 종류 1, cx, cy − 39, 효과 0, …) — 칸 85~88 의 파트는 모두 0x67(b = 240 · 230)이라
 * 프레임 0xc9f98 이 화면에 더한다(ca198 · `frameLayers`). 겹이 아직이면 구운 근사(알파 b/255)
 */
function drawSpeedLines(
  context: CanvasRenderingContext2D,
  speedLines: NonNullable<AceCutInDraw['speedLines']>,
  uiOrigins: FrameOrigins | null,
): void {
  const layers = placedFrameLayersOf(GAME_UI_FRAMES, speedLines.frame, spriteJsonNow<FrameLayerListing>(frameLayersUrl(GAME_UI_FRAMES)), imageAt)
  const origin = uiOrigins?.[pad(speedLines.frame)]
  const image = layers !== null || origin === undefined ? null : imageAt(`${GAME_UI_FRAMES}/${pad(speedLines.frame)}.png`)
  if (layers !== null) {
    drawFrameLayers(context, layers, speedLines.x, speedLines.y)
    return
  }
  // 프레임 89 는 그림이 없는 빈 칸이다(뽑힌 PNG 가 없다)
  if (origin !== undefined && image !== null) context.drawImage(image, speedLines.x + origin.x, speedLines.y + origin.y)
}

/** 배너 그림자 선 — 첫 선의 색(없으면 배너 테두리)으로 */
function drawBannerShadows(context: CanvasRenderingContext2D, draw: AceCutInDraw): void {
  context.fillStyle = fillStyleOf(draw.bannerShadows[0]?.color ?? draw.banner.border)
  for (const line of draw.bannerShadows) {
    for (const pixel of linePixels(line.from, line.to)) context.fillRect(pixel.x, pixel.y, 1, 1)
  }
}

/** 띠(불투명) 위라 화면 칸을 읽어 원본 식(565 채널 덧셈 · 내림 · 끝에서 자름)으로 섞는다 */
function drawStreaks(context: CanvasRenderingContext2D, draw: AceCutInDraw): void {
  for (const streak of draw.streaks) {
    const image = imageAt(`${GAME_UI}/${pad(streak.image)}.png`)
    if (image !== null) drawImageWithEffect(context, image, streak.x, streak.y, DRAW_EFFECT.ADDITIVE, ADDITIVE_WEIGHT)
  }
}

function drawPortrait(context: CanvasRenderingContext2D, placement: NonNullable<AceCutInDraw['portrait']>, portrait: Portrait, frame: number): void {
  const origin = portrait.origins?.[pad(frame)]
  const image = origin === undefined ? null : imageAt(`${portrait.folder}/${pad(frame)}.png`)
  if (origin === undefined || image === null) return
  // 0x93e7d 의 상자 폭 — 단계 8 부터 x = W − 폭 / 2 − 5
  const x = placement.x === 'centered' ? SCREEN_WIDTH - Math.trunc(origin.width / 2) - 5 : placement.x
  context.drawImage(image, x + origin.x + portrait.dx, placement.y + origin.y + portrait.dy)
}

function drawLabel(context: CanvasRenderingContext2D, label: NonNullable<AceCutInDraw['label']>): void {
  const image = imageAt(`${GAME_UI}/${pad(label.image)}.png`)
  if (image !== null) context.drawImage(label.brighten > 0 ? brightened(image, label.brighten) : image, label.x, label.y)
}

export function drawCutIn(context: CanvasRenderingContext2D, draw: AceCutInDraw, uiOrigins: FrameOrigins | null, portrait: Portrait | null): void {
  context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  context.imageSmoothingEnabled = false
  context.fillStyle = fillStyleOf(draw.band.color)
  context.fillRect(draw.band.x, draw.band.y, draw.band.width, draw.band.height)
  if (draw.speedLines !== null) drawSpeedLines(context, draw.speedLines, uiOrigins)
  drawPolygon(context, draw.banner)
  drawBannerShadows(context, draw)
  drawStreaks(context, draw)
  if (draw.sweep !== null) drawPolygon(context, draw.sweep)
  if (draw.portrait !== null && portrait !== null && portrait.frame !== null) drawPortrait(context, draw.portrait, portrait, portrait.frame)
  if (draw.label !== null) drawLabel(context, draw.label)
}
