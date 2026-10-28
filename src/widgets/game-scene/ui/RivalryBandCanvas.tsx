import { useEffect, useRef } from 'react'
import { linePixels, scanlineSpans } from '@/features/play-game/model/aceCutIn'
import { RIVALRY_LOGO_FRAME, type RivalryColor, type RivalryDraw, rivalryDrawsOf } from '@/widgets/game-scene/lib/rivalryBand'
import { brightenedImageOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { tryOr } from '@/shared/lib/safe/tryOr'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const LOGO_URL = assetUrl(`./sprites/team_logo/${String(RIVALRY_LOGO_FRAME).padStart(3, '0')}.png`)

let logoImage: HTMLImageElement | null = null
let logoLoading = false
/** 로고를 불러 둔다 — 아직이면 null (다음 그림부터 그려진다) */
function logo(): HTMLImageElement | null {
  if (logoImage !== null) return logoImage
  if (!logoLoading && typeof Image !== 'undefined') {
    logoLoading = true
    const image = new Image()
    image.onload = () => {
      logoImage = image
    }
    image.src = LOGO_URL
  }
  return null
}

/** 0xbb91d 종류 8 — 채널마다 +b (그림이 있는 칸만, 255 에서 자름) — 공용 `brightenedImageOf` (565 내림까지 원본대로) */
const brightened = brightenedImageOf

/** 0x6a9f0 · 0x6a904 — 윗바이트 알파가 0 · 255 면 불투명, 그 밖은 플랫폼 섞기(⚠️ 알파/255 로 본다) */
function styleOf(color: RivalryColor): string {
  const opacity = color.alpha === 0 || color.alpha === 0xff ? 1 : color.alpha / 255
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
}

function drawOne(context: CanvasRenderingContext2D, draw: RivalryDraw): void {
  if (draw.kind === 'polygon') {
    // 0x75e31 — 0x75c70 스캔라인 채우기 뒤 0x75dc4 테두리 (채우기 · 테두리 같은 색)
    context.fillStyle = styleOf(draw.color)
    for (const span of scanlineSpans(draw.points)) context.fillRect(span.x0, span.y, span.x1 - span.x0 + 1, 1)
    draw.points.forEach((point, index) => {
      const next = draw.points[(index + 1) % draw.points.length]
      for (const pixel of linePixels(point, next)) context.fillRect(pixel.x, pixel.y, 1, 1)
    })
    return
  }
  if (draw.kind === 'line') {
    context.fillStyle = styleOf(draw.color)
    for (const pixel of linePixels(draw.from, draw.to)) context.fillRect(pixel.x, pixel.y, 1, 1)
    return
  }
  const image = logo()
  if (image === null) return
  // 0xbb91d 종류 2 — 크기 a/10 배, 최근접 표본
  const width = Math.trunc(image.width * draw.scale)
  const height = Math.trunc(image.height * draw.scale)
  context.drawImage(draw.brighten > 0 ? brightened(image, draw.brighten) : image, draw.x, draw.y, width, height)
}

/**
 * **라이벌전 띠 0x3b80c** (`lib/rivalryBand`) — 단계(+0x194c)의 줄기 · 기운 상자 · 선 · "RIVAL BATTLE" 로고를 원본처럼
 * 픽셀 단위로 캔버스에 찍는다. 인트로(`GameIntro`)의 점수판 틀 뒤 맨 위 겹이다.
 */
export function RivalryBandCanvas({ step }: { readonly step: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const context = tryOr(() => canvasRef.current?.getContext('2d') ?? null, null)
    if (context === null) return
    context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    context.imageSmoothingEnabled = false
    for (const draw of rivalryDrawsOf(step)) drawOne(context, draw)
  })
  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      aria-hidden
      data-testid="라이벌전-띠"
      data-step={step}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
    />
  )
}
