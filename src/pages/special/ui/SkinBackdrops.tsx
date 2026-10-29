import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import {
  BALL_PATTERN_BACKDROP,
  BALL_PATTERN_GRID,
  MAIN_TITLE_BACKDROP,
  GPOINT_ANIMATION,
  SKIN_SCREEN,
  ballPatternCounterAfter,
  ballPatternRect565,
  ballPatternStartOf,
  finishMainTitleBackdrop565,
  mainTitleLineYs,
  rgbOf565,
  rgbTo565,
} from '@/pages/special/lib/skinBackdrops'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { DRAW_EFFECT, color565Of, css565, effectContextOf, effectSpriteUrl, grayPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawFrameLayers, frameLayersUrl, frameLayerUrl, type FrameLayerListing, type PlacedFrameLayer } from '@/shared/lib/sprite/frameLayers'
import { loadSpriteJson } from '@/shared/lib/sprite/spriteCache'
import { screenGrayRectsNow, subscribeScreenGrayRects, useScreenGrayRects } from '@/shared/lib/pixelEffect/screenGrayRects'
import { translucentOpacityOf, translucentPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { sprite565At } from '@/shared/lib/pixelEffect/sprite565Cache'
import { loadSpriteImage } from '@/shared/lib/sprite/spriteCache'
import type { ScreenGrayRect } from '@/shared/lib/pixelEffect/screenGrayRects'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { tryOr } from '@/shared/lib/safe/tryOr'

const MAIN_TITLE = assetUrl('./sprites/main_title')
const GPOINT_FRAMES = assetUrl('./sprites/gpoint/frames')
const pad = (index: number) => String(index).padStart(3, '0')

/** 명예의 전당 목록을 쓰는 화면의 바탕 — 메뉴 바탕 0x58371 · 공 무늬 0x5fd61 (`lib/skinBackdrops.ts`) */
export type SkinBackdropKind = '메뉴바탕' | '공무늬'

export function SkinBackdrop({ kind }: { readonly kind: SkinBackdropKind }) {
  return kind === '메뉴바탕' ? <MainTitleBackdrop /> : <BallPatternBackdrop />
}

/**
 * 0x58371 — 메인 메뉴에 들어올 때 떠 둔 버퍼(흰 바탕 · 프레임 13 · 이미지 7 · 흐리기 0xbdd65(1) · 3줄 선 · 흰 단계 3)를
 * 그대로 찍는다. 버퍼는 16비트 화면 연산 그대로 캔버스에서 한 번 지어 앱에 하나 둔다([skin+0x450] 처럼).
 * 캔버스가 없으면(테스트) 겹쳐 그리기 근사(흐리기 없음 · 덮기 4/16)로 둔다.
 */
function MainTitleBackdrop() {
  const { width, height } = SKIN_SCREEN
  const [built, setBuilt] = useState<string | null>(mainTitleBuffer.url)
  useEffect(() => {
    if (built !== null) return undefined
    let isActive = true
    void buildMainTitleBuffer().then((url) => {
      if (isActive && url !== null) setBuilt(url)
    })
    return () => {
      isActive = false
    }
  }, [built])
  if (built !== null) {
    return (
      <div className={styles.skinBackdrop} data-testid="바탕-메뉴" style={{ width, height }}>
        <img className={styles.sprite} alt="" src={built} style={{ left: 0, top: 0 }} />
      </div>
    )
  }
  return (
    <div className={styles.skinBackdrop} data-testid="바탕-메뉴" style={{ width, height, background: '#fff' }}>
      <img className={styles.sprite} alt="" src={MAIN_TITLE_FRAME_SRC} style={{ left: 0, top: 0 }} />
      <img
        className={styles.sprite}
        alt=""
        src={MAIN_TITLE_BADGE_SRC}
        style={{ left: MAIN_TITLE_BACKDROP.badgeX, top: MAIN_TITLE_BACKDROP.badgeY }}
      />
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        shapeRendering="crispEdges"
      >
        {mainTitleLineYs().map((y) => (
          <rect key={y} x={0} y={y} width={width} height={1} fill="#000" fillOpacity={MAIN_TITLE_BACKDROP.lineOpacity} />
        ))}
        <rect x={0} y={0} width={width} height={height} fill="#fff" fillOpacity={MAIN_TITLE_BACKDROP.whitenOpacity} />
      </svg>
    </div>
  )
}

const MAIN_TITLE_FRAMES = `${MAIN_TITLE}/frames`
const MAIN_TITLE_FRAME_SRC = `${MAIN_TITLE_FRAMES}/${pad(MAIN_TITLE_BACKDROP.frame)}.png`
const MAIN_TITLE_BADGE_SRC = `${MAIN_TITLE}/${pad(MAIN_TITLE_BACKDROP.badgeImage)}.png`

/** 떠 둔 버퍼 [skin+0x450] — 앱에 하나 */
const mainTitleBuffer: { url: string | null; pending: Promise<string | null> | null } = { url: null, pending: null }

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

/** 프레임 13 의 겹 (`frames/layers.json`) — 하나라도 못 받으면 null */
async function loadMainTitleLayers(): Promise<readonly PlacedFrameLayer[] | null> {
  const listing = await loadSpriteJson<FrameLayerListing>(frameLayersUrl(MAIN_TITLE_FRAMES)).catch(() => null)
  const entries = listing?.[pad(MAIN_TITLE_BACKDROP.frame)]
  if (entries === undefined) return null
  const images = await Promise.all(entries.map((entry) => loadImage(frameLayerUrl(MAIN_TITLE_FRAMES, entry))))
  if (images.some((image) => image === null)) return null
  return entries.map((entry, order) => ({
    image: images[order] as HTMLImageElement,
    offsetX: entry.x,
    offsetY: entry.y,
    effect: entry.effect,
    argument: entry.argument ?? 0,
  }))
}

/** 흰 채우기 → 프레임 13 → 이미지 7 을 캔버스에 그리고 565 로 떠서 흐리기·선·덮기를 한 뒤 다시 그림으로 */
function buildMainTitleBuffer(): Promise<string | null> {
  if (mainTitleBuffer.pending !== null) return mainTitleBuffer.pending
  mainTitleBuffer.pending = (async () => {
    const { width, height } = SKIN_SCREEN
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = tryOr(() => effectContextOf(canvas), null)
    if (context === null) return null
    const [frame, badge, layers] = await Promise.all([loadImage(MAIN_TITLE_FRAME_SRC), loadImage(MAIN_TITLE_BADGE_SRC), loadMainTitleLayers()])
    if (frame === null || badge === null) return null
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    // 0x583a8 0xba759(main_title, 13, 종류 1, 0, 0, 효과 0) — 효과 0 이라 0xc9f98 이 파트 효과를 따른다:
    // 흙먼지(그림 4, 0x67 · 200)는 흰 화면 · 배경 위에 **더한다**. 겹을 못 받았으면 구운 프레임(알파 200/255 근사)
    if (layers === null) context.drawImage(frame, 0, 0)
    else drawFrameLayers(context, layers, 0, 0)
    context.drawImage(badge, MAIN_TITLE_BACKDROP.badgeX, MAIN_TITLE_BACKDROP.badgeY)
    const image = context.getImageData(0, 0, width, height)
    const pixels = new Uint16Array(width * height)
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = rgbTo565(image.data[index * 4], image.data[index * 4 + 1], image.data[index * 4 + 2])
    }
    finishMainTitleBackdrop565(pixels, width, height)
    for (let index = 0; index < pixels.length; index += 1) {
      const [r, g, b] = rgbOf565(pixels[index])
      image.data[index * 4] = r
      image.data[index * 4 + 1] = g
      image.data[index * 4 + 2] = b
      image.data[index * 4 + 3] = 255
    }
    context.putImageData(image, 0, 0)
    mainTitleBuffer.url = canvas.toDataURL()
    return mainTitleBuffer.url
  })()
  return mainTitleBuffer.pending
}

/**
 * 공 무늬를 그린 수 — [skin+0x414] 와 gpoint 애니 진행이 둘 다 스킨(앱에 하나)에 있어 화면을 건너 이어진다.
 * 0 으로 놓는 곳은 스킨을 만들 때(0x5390c) 뿐이다.
 */
const ballPatternDraws = { value: 0 }

/** 그린 뒤 — 지난번 센 틱부터 이번 틱까지 그린 수를 올리고 센 틱을 적는다 */
function countBallPatternDraws(lastDrawn: { tick: number }, tick: number): void {
  ballPatternDraws.value += Math.max(0, tick - lastDrawn.tick)
  lastDrawn.tick = tick
}

/** 0x5fd61 — 하늘색 위에 공 아이콘이 엇갈린 격자로 오른쪽 아래로 흐른다. 그린 **뒤** 카운터·애니를 한 번 진행한다 */
function BallPatternBackdrop() {
  const tick = useUpdateCounter()
  // 이 바탕이 마지막으로 센 틱 — 렌더는 읽기만 하고 센 뒤(effect) 적는다. 적어도 다시 그리지 않는다(그린 수 칸과 같은 바깥 칸)
  const [lastDrawn] = useState(() => ({ tick: tick - 1 }))
  useEffect(() => {
    countBallPatternDraws(lastDrawn, tick)
  }, [lastDrawn, tick])
  // 건너뛴 갱신도 원본에선 한 번씩 그렸다 — 그만큼 앞당겨 센다
  const draws = ballPatternDraws.value + Math.max(0, tick - lastDrawn.tick - 1)
  const counter = ballPatternCounterAfter(draws)
  const frame = animationStepAt(GPOINT_ANIMATION, draws)?.frame ?? 0
  const { width, height } = SKIN_SCREEN
  const grayRects = useScreenGrayRects()
  const start = ballPatternStartOf(counter)
  const src = `${GPOINT_FRAMES}/${pad(frame)}.png`
  usePublishBallPattern(counter, frame)
  // 칸 약 200 개를 gpoint 그림마다 한 벌씩(여섯 벌) 한 번만 만들어 두고, 지금 그림의 벌만 보인다(r316 P1).
  // 틱마다 보이는 벌의 자리(left · top)만 레이아웃 단계에서 DOM 에 곧바로 적는다 — React 가 칸 200 개를 다시 맞춰 보지 않고,
  // 3 틱마다 칸 200 개의 src 를 바꾸지(그림 다시 찾기) 않는다. 그리기 전(같은 틀)에 적으니 화면은 그대로다.
  // 자리 값은 예전과 같은 정수 하나(첫 칸 + 격자)다 — 감싸개를 옮기거나 calc 로 나누면 분수 배율에서 1px 반올림이 갈린다(r321)
  const layerRefs = useRef<(HTMLDivElement | null)[]>([])
  const layers = useMemo(
    () =>
      GPOINT_ANIMATION.map((entry, layer) => (
        <div
          key={entry.frame}
          ref={(element) => {
            layerRefs.current[layer] = element
          }}
          data-frame-layer={entry.frame}
          style={{ display: 'none' }}
        >
          {BALL_PATTERN_GRID.map((_, index) => (
            <img key={index} className={styles.sprite} alt="" src={`${GPOINT_FRAMES}/${pad(entry.frame)}.png`} />
          ))}
        </div>
      )),
    [],
  )
  useLayoutEffect(() => {
    GPOINT_ANIMATION.forEach((entry, layer) => {
      const element = layerRefs.current[layer]
      if (element === null || element === undefined) return
      const isShown = entry.frame === frame
      if (isShown) {
        BALL_PATTERN_GRID.forEach((tile, index) => {
          const image = element.children[index] as HTMLElement | undefined
          if (image === undefined) return
          image.style.left = `${start + tile.x}px`
          image.style.top = `${start + tile.y}px`
        })
      }
      const display = isShown ? '' : 'none'
      if (element.style.display !== display) element.style.display = display
    })
  }, [start, frame])
  return (
    <div
      className={styles.skinBackdrop}
      data-testid="바탕-공무늬"
      data-counter={counter}
      data-frame={frame}
      style={{ width, height, background: BALL_PATTERN_BACKDROP.color }}
    >
      {layers}
      {grayRects.map((rect, index) => (
        <BallPatternGrayRect key={index} rect={rect} start={start} src={src} />
      ))}
    </div>
  )
}

/** 공 무늬 바탕 색의 0xc37a8 회색 (`grayPixel565`) */
const BALL_PATTERN_GRAY = css565(grayPixel565(color565Of(BALL_PATTERN_BACKDROP.color) ?? 0))

/**
 * 0xc37a8 흑백 사각형 안의 공 무늬 — 위에 그린 것(커맨드 줄 아이콘)이 흑백 사각형을 걸면 그 아래 바탕도 회색이 된다.
 * 바탕 색 · 공 그림을 회색 식으로 칠해 사각형으로 잘라 얹는다(`shared/lib/pixelEffect/screenGrayRects`).
 * 칸은 몇 개뿐이라 React 로 그대로 그린다. 열쇠를 칸 자리 대신 격자 번호로 둬 틱마다 다시 붙지 않는다(r316 P2 —
 * 다시 붙으면 칠한 주소를 다시 받아 틱마다 커밋이 한 번 더 났다. 칠한 주소는 미리 칠해 둬 바로 보이므로 화면은 그대로다).
 */
function BallPatternGrayRect({
  rect,
  start,
  src,
}: {
  readonly rect: ScreenGrayRect
  /** 첫 칸 자리 (`ballPatternStartOf`) */
  readonly start: number
  readonly src: string
}) {
  const { tileWidth, tileHeight } = BALL_PATTERN_BACKDROP
  // 애니 그림 여섯 장을 미리 칠해 둔다 — 그림이 바뀌는 틀에 회색 공이 한 번 빠지지 않게
  useEffect(() => {
    for (const entry of GPOINT_ANIMATION) void effectSpriteUrl(`${GPOINT_FRAMES}/${pad(entry.frame)}.png`, DRAW_EFFECT.GRAY, 0)
  }, [])
  const touches = (tile: { readonly x: number; readonly y: number }) => {
    const x = start + tile.x
    const y = start + tile.y
    return x < rect.x + rect.width && x + tileWidth > rect.x && y < rect.y + rect.height && y + tileHeight > rect.y
  }
  return (
    <div
      data-testid="바탕-공무늬-흑백"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        overflow: 'hidden',
        background: BALL_PATTERN_GRAY,
        pointerEvents: 'none',
      }}
    >
      {BALL_PATTERN_GRID.map((tile, index) =>
        touches(tile) ? (
          // 자리는 예전처럼 정수 하나(첫 칸 + 격자 − 사각형)로 준다 — 나눠 더하면 분수 배율에서 1px 반올림이 갈린다
          <EffectImage
            key={index}
            className={styles.sprite}
            src={src}
            effect={DRAW_EFFECT.GRAY}
            style={{ left: start + tile.x - rect.x, top: start + tile.y - rect.y }}
          />
        ) : null,
      )}
    </div>
  )
}

/* ── 공 무늬 위 반투명 그림 (Q-03, r301) ─────────────────────────────────── */

/** 지금 그린 공 무늬 — 카운터 [skin+0x414] · gpoint 애니 그림. 무늬가 없으면 null */
interface BallPatternNow {
  readonly counter: number
  readonly frame: number
}

const ballPatternOwners = new Map<symbol, BallPatternNow>()
let ballPatternNow: BallPatternNow | null = null
const ballPatternListeners = new Set<() => void>()

function setBallPattern(owner: symbol, now: BallPatternNow | null): void {
  if (now === null) ballPatternOwners.delete(owner)
  else ballPatternOwners.set(owner, now)
  ballPatternNow = [...ballPatternOwners.values()].at(-1) ?? null
  for (const listener of ballPatternListeners) listener()
}

/**
 * 무늬를 그린 커밋의 레이아웃 단계에서 알린다 — 위 반투명 그림이 **같은 틀**에 다시 그려 무늬와 한 틀도 어긋나지 않는다
 * (알림을 받는 쪽은 React 를 거치지 않고 캔버스를 곧바로 칠한다)
 */
function usePublishBallPattern(counter: number, frame: number): void {
  const [owner] = useState(() => Symbol('공무늬'))
  useLayoutEffect(() => {
    setBallPattern(owner, { counter, frame })
  }, [owner, counter, frame])
  useLayoutEffect(() => () => setBallPattern(owner, null), [owner])
}

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
    /** 그렸으면 참 — 못 그리면(무늬 없음 · 그림 못 받음 · 다룰 수 없는 줄) 거짓 */
    const draw = (): boolean => {
      const current = latest()
      const pattern = ballPatternNow
      if (pattern === null) return false
      const tileSrc = `${GPOINT_FRAMES}/${pad(pattern.frame)}.png`
      const image = sprite565At(current.src)
      const tile = sprite565At(tileSrc)
      if (image === null || tile === null) {
        const missing = image === null ? current.src : tileSrc
        if (waiting !== missing) {
          waiting = missing
          void loadSpriteImage(missing).then((loaded) => {
            if (!isActive || loaded === null) return
            waiting = null
            setComposed(redraw())
          })
        }
        return false
      }
      const place = current.imagePlaceOf?.(image.width, image.height) ?? { x: current.x, y: current.y }
      const left = place.x - current.x
      const top = place.y - current.y
      if (left < 0 || top < 0 || left + image.width > current.width || top + image.height > current.height) return false
      const rows: (number | null)[] = []
      for (let row = 0; row < image.height; row += 1) {
        const over = current.rowOver === undefined ? null : current.rowOver(place.y + row)
        if (over === undefined) return false
        rows.push(over)
      }
      const context = effectContextOf(canvasRef.current)
      if (context === null) return false
      const rect = { x: current.x, y: current.y, width: current.width, height: current.height }
      const under = ballPatternRect565(rect, pattern.counter, tile, screenGrayRectsNow())
      const out = context.createImageData(rect.width, rect.height)
      for (let row = 0; row < image.height; row += 1) {
        const over = rows[row]
        for (let column = 0; column < image.width; column += 1) {
          const from = row * image.width + column
          if (image.opaque[from] === 0) continue
          const at = (top + row) * rect.width + left + column
          const screen = over ?? under[at]
          const [r, g, b] = rgbOf565(translucentPixel565(current.level, image.pixels[from], screen))
          out.data[at * 4] = r
          out.data[at * 4 + 1] = g
          out.data[at * 4 + 2] = b
          out.data[at * 4 + 3] = 255
        }
      }
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
