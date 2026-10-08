import { useEffect, useRef } from 'react'
import { useAnimations, useFrameOrigins, type FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import {
  aceCutInDraws,
  aceCutInPortraitOf,
  linePixels,
  scanlineSpans,
  type AceCutInDraw,
  type CutInColor,
  type CutInPolygon,
} from '@/features/play-game/model/aceCutIn'
import * as styles from '@/features/play-game/ui/SubstitutionSceneOverlay.css'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = `${GAME_UI}/frames`
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 효과 2 의 인자 — 화면 + 그림·230 >> 8 (0x9a2f1) */
const ADDITIVE_WEIGHT = 230 / 256

const DRAWS = aceCutInDraws()

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

const brightCache = new Map<string, HTMLCanvasElement>()
/** 0xbb91d 종류 8 — 채널마다 +b (그림이 있는 칸만, 255 에서 자름) */
function brightened(image: HTMLImageElement, amount: number): CanvasImageSource {
  const key = `${image.src}#${amount}`
  const cached = brightCache.get(key)
  if (cached !== undefined) return cached
  const glow = document.createElement('canvas')
  const result = document.createElement('canvas')
  glow.width = result.width = image.width
  glow.height = result.height = image.height
  const glowContext = glow.getContext('2d')
  const resultContext = result.getContext('2d')
  if (glowContext === null || resultContext === null) return image
  glowContext.drawImage(image, 0, 0)
  glowContext.globalCompositeOperation = 'source-in'
  glowContext.fillStyle = `rgb(${amount}, ${amount}, ${amount})`
  glowContext.fillRect(0, 0, image.width, image.height)
  resultContext.drawImage(image, 0, 0)
  resultContext.globalCompositeOperation = 'lighter'
  resultContext.drawImage(glow, 0, 0)
  brightCache.set(key, result)
  return result
}

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

interface Portrait {
  readonly folder: string
  readonly origins: FrameOrigins | null
  readonly frame: number | null
  readonly dx: number
  readonly dy: number
}

function drawCutIn(context: CanvasRenderingContext2D, draw: AceCutInDraw, uiOrigins: FrameOrigins | null, portrait: Portrait | null) {
  context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  context.imageSmoothingEnabled = false
  context.fillStyle = fillStyleOf(draw.band.color)
  context.fillRect(draw.band.x, draw.band.y, draw.band.width, draw.band.height)
  if (draw.speedLines !== null) {
    const origin = uiOrigins?.[pad(draw.speedLines.frame)]
    const image = origin === undefined ? null : imageAt(`${GAME_UI_FRAMES}/${pad(draw.speedLines.frame)}.png`)
    // 프레임 89 는 그림이 없는 빈 칸이다(뽑힌 PNG 가 없다)
    if (origin !== undefined && image !== null) {
      context.drawImage(image, draw.speedLines.x + origin.x, draw.speedLines.y + origin.y)
    }
  }
  drawPolygon(context, draw.banner)
  context.fillStyle = fillStyleOf(draw.bannerShadows[0]?.color ?? draw.banner.border)
  for (const line of draw.bannerShadows) {
    for (const pixel of linePixels(line.from, line.to)) context.fillRect(pixel.x, pixel.y, 1, 1)
  }
  for (const streak of draw.streaks) {
    const image = imageAt(`${GAME_UI}/${pad(streak.image)}.png`)
    if (image === null) continue
    context.save()
    context.globalCompositeOperation = 'lighter'
    context.globalAlpha = ADDITIVE_WEIGHT
    context.drawImage(image, streak.x, streak.y)
    context.restore()
  }
  if (draw.sweep !== null) drawPolygon(context, draw.sweep)
  if (draw.portrait !== null && portrait !== null && portrait.frame !== null) {
    const origin = portrait.origins?.[pad(portrait.frame)]
    const image = origin === undefined ? null : imageAt(`${portrait.folder}/${pad(portrait.frame)}.png`)
    if (origin !== undefined && image !== null) {
      // 0x93e7d 의 상자 폭 — 단계 8 부터 x = W − 폭 / 2 − 5
      const x = draw.portrait.x === 'centered' ? SCREEN_WIDTH - Math.trunc(origin.width / 2) - 5 : draw.portrait.x
      context.drawImage(image, x + origin.x + portrait.dx, draw.portrait.y + origin.y + portrait.dy)
    }
  }
  if (draw.label !== null) {
    const image = imageAt(`${GAME_UI}/${pad(draw.label.image)}.png`)
    if (image !== null) {
      context.drawImage(draw.label.brighten > 0 ? brightened(image, draw.label.brighten) : image, draw.label.x, draw.label.y)
    }
  }
}

interface AceCutInCanvasProps {
  /** 0x16 의 몇 번째 그림인가 (0 부터) */
  readonly draw: number
  /** 컷인 번호 — 투수 0~4 · 타자 5~9 (표 0xd0108) */
  readonly aceSlot: number
}

/**
 * **마선수 등장 컷인 `0x473f0`** (`features/play-game/model/aceCutIn`) — "CHANGE" 애니 위에 띠 · 배너 · 사선 · 초상을 그린다.
 * 원본처럼 픽셀 단위 채우기(스캔라인) · 선 · 더하기 그림을 캔버스에 찍는다.
 */
export function AceCutInCanvas({ draw, aceSlot }: AceCutInCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const uiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const portraitSource = aceCutInPortraitOf(aceSlot)
  const portraitFolder = portraitSource?.folder ?? `${GAME_UI_FRAMES}`
  const portraitOrigins = useFrameOrigins(portraitFolder)
  const portraitAnimations = useAnimations(portraitFolder)
  const entries = portraitSource === null ? undefined : portraitAnimations?.[portraitSource.animation]
  // 0x93cfd(초상, 1) 로 처음부터 건 뒤 0x93c45(그리기)만 — 칸을 넘기지 않아 첫 칸에 선다
  const step = entries === undefined ? null : animationStepAt(entries, 0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d') ?? null
    const current = DRAWS[Math.min(Math.max(0, draw), DRAWS.length - 1)]
    if (context === null || current === undefined) return
    drawCutIn(context, current, uiOrigins, {
      folder: portraitFolder,
      origins: portraitOrigins,
      frame: step?.frame ?? null,
      dx: step?.dx ?? 0,
      dy: step?.dy ?? 0,
    })
  })

  return (
    <canvas
      ref={canvasRef}
      className={styles.stage}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      data-testid="마선수컷인"
      data-draw={draw}
    />
  )
}
