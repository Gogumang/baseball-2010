import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ballPatternRect565 } from '@/pages/special/lib/skinBackdrops'
import { effectContextOf, translucentOpacityOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { screenGrayRectsNow, subscribeScreenGrayRects } from '@/shared/lib/pixelEffect/screenGrayRects'
import { sprite565At } from '@/shared/lib/pixelEffect/sprite565Cache'
import { loadSpriteImage } from '@/shared/lib/sprite/spriteCache'
import { GPOINT_FRAMES, pad } from '@/pages/special/ui/skinBackdrops/skinAssets'
import { fitsInside, mixTranslucentImage, rowColorsOf, translucentPlaceOf } from '@/pages/special/ui/skinBackdrops/translucentMix'
import { ballPatternListeners, currentBallPattern } from '@/pages/special/ui/skinBackdrops/ballPatternStore'

interface BallPatternTranslucentImageProps {
  readonly src: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** 효과 1 의 인자 L (그림 몫 L/16) */
  readonly level: number
  /**
   * 무늬와 이 그림 사이에 먼저 그린 것의 줄 색(565) — null 이면 그 줄은 무늬가 그대로, undefined 면 다룰 수 없는 줄이라
   * CSS 불투명도 근사로 둔다
   */
  readonly rowOver?: (y: number) => number | null | undefined
  /**
   * 그림 크기(w, h)로 왼쪽 위를 정한다 — 원본처럼 실제 크기로 가운데를 잡는 자리. 안 주면 (x, y). 캔버스 칸은 (x, y, width, height)
   * 이라 그 칸이 그림을 다 덮게 잡는다
   */
  readonly imagePlaceOf?: (width: number, height: number) => { readonly x: number; readonly y: number }
  /** CSS 근사로 둘 때 `<img>` 자리 · 크기 — 안 주면 캔버스 칸 */
  readonly fallbackRect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly className?: string
  readonly alt?: string
  readonly testId?: string
}

/**
 * **공 무늬 바탕 위 반투명 그림** — 효과 1(0x9a449)을 원본 식(`translucentPixel565`, 마스크 내림 · 565)으로 칠한다.
 * DOM 겹이라 아래 화면을 못 읽으므로 아래를 **같은 좌표로 다시 그린다**: 공 무늬(지금 카운터 · gpoint 그림 · 흑백 사각형) 위에
 * 그 사이에 먼저 그린 줄 색(`rowOver` — 카드 계단형 판)을 얹고, 그림의 불투명 칸만 섞어 캔버스에 찍는다(투명 칸은 비워 DOM 이 보인다).
 * 무늬가 없거나 그림을 아직 못 받았거나 캔버스가 없으면(시험 DOM) CSS 불투명도 L/16 근사(`translucentOpacityOf`)로 둔다.
 */
export function BallPatternTranslucentImage({
  src,
  x,
  y,
  width,
  height,
  level,
  rowOver,
  imagePlaceOf,
  fallbackRect,
  className,
  alt = '',
  testId,
}: BallPatternTranslucentImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isComposed, setComposed] = useState(false)
  const latest = useEffectEvent(() => ({ src, x, y, width, height, level, rowOver, imagePlaceOf }))

  useLayoutEffect(() => {
    let isActive = true
    let waiting: string | null = null
    /** 못 받은 그림을 한 번만 부른다 — 받으면 다시 칠한다 */
    const requestMissing = (missing: string) => {
      if (waiting === missing) return
      waiting = missing
      void loadSpriteImage(missing).then((loaded) => {
        if (!isActive || loaded === null) return
        waiting = null
        setComposed(redraw())
      })
    }
    /** 그렸으면 참 — 못 그리면(무늬 없음 · 그림 못 받음 · 다룰 수 없는 줄) 거짓 */
    const draw = (): boolean => {
      const current = latest()
      const pattern = currentBallPattern()
      if (pattern === null) return false
      const tileSrc = `${GPOINT_FRAMES}/${pad(pattern.frame)}.png`
      const image = sprite565At(current.src)
      const tile = sprite565At(tileSrc)
      if (image === null || tile === null) {
        requestMissing(image === null ? current.src : tileSrc)
        return false
      }
      const place = translucentPlaceOf(current.imagePlaceOf, image, current.x, current.y)
      const left = place.x - current.x
      const top = place.y - current.y
      if (!fitsInside(left, top, image, current.width, current.height)) return false
      const rows = rowColorsOf(current.rowOver, place.y, image.height)
      if (rows === null) return false
      const context = effectContextOf(canvasRef.current)
      if (context === null) return false
      const rect = { x: current.x, y: current.y, width: current.width, height: current.height }
      const under = ballPatternRect565(rect, pattern.counter, tile, screenGrayRectsNow())
      const out = context.createImageData(rect.width, rect.height)
      mixTranslucentImage(out.data, image, rows, under, rect.width, left, top, current.level)
      context.putImageData(out, 0, 0)
      return true
    }
    /** 한 번이라도 칠했는가 — 못 그리게 되면 지운다(캔버스를 안 연 시험 DOM 에서는 문맥을 열지 않는다) */
    let hasDrawn = false
    const redraw = () => {
      const drawn = draw()
      if (!drawn && hasDrawn) effectContextOf(canvasRef.current)?.clearRect(0, 0, latest().width, latest().height)
      hasDrawn = drawn
      return drawn
    }
    const onChange = () => {
      if (isActive) setComposed(redraw())
    }
    ballPatternListeners.add(onChange)
    const unsubscribeGray = subscribeScreenGrayRects(onChange)
    onChange()
    return () => {
      isActive = false
      ballPatternListeners.delete(onChange)
      unsubscribeGray()
    }
  }, [src, x, y, width, height, level])

  const place: CSSProperties = { left: x, top: y, width, height }
  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        width={width}
        height={height}
        aria-hidden
        style={{ ...place, visibility: isComposed ? 'visible' : 'hidden' }}
        {...(isComposed && testId !== undefined ? { 'data-testid': testId } : {})}
        data-effect-level={level}
        data-composed={isComposed}
      />
      {!isComposed && (
        <img
          className={className}
          alt={alt}
          src={src}
          data-testid={testId}
          style={{
            ...(fallbackRect === undefined
              ? place
              : { left: fallbackRect.x, top: fallbackRect.y, width: fallbackRect.width, height: fallbackRect.height }),
            opacity: translucentOpacityOf(level),
          }}
        />
      )}
    </>
  )
}
