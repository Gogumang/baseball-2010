import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import {
  BALL_PATTERN_BACKDROP,
  BALL_PATTERN_GRID,
  GPOINT_ANIMATION,
  SKIN_SCREEN,
  ballPatternCounterAfter,
  ballPatternStartOf,
} from '@/pages/special/lib/skinBackdrops'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { DRAW_EFFECT, color565Of, css565, effectSpriteUrl, grayPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { useScreenGrayRects } from '@/shared/lib/pixelEffect/screenGrayRects'
import type { ScreenGrayRect } from '@/shared/lib/pixelEffect/screenGrayRects'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
import { GPOINT_FRAMES, pad } from '@/pages/special/ui/skinBackdrops/skinAssets'
import { ballPatternDraws, countBallPatternDraws, usePublishBallPattern } from '@/pages/special/ui/skinBackdrops/ballPatternStore'

/** 0x5fd61 — 하늘색 위에 공 아이콘이 엇갈린 격자로 오른쪽 아래로 흐른다. 그린 **뒤** 카운터·애니를 한 번 진행한다 */
export function BallPatternBackdrop() {
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
