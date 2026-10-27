import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useTitleIntro } from '@/pages/title/model/useTitleIntro'
import { INTRO_ANIMATION, PROMPT_ANIMATION, TITLE_FRAMES } from '@/pages/title/model/titleIntro'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawFrameLayers, frameLayersUrl, placedFrameLayersOf, type FrameLayerListing } from '@/shared/lib/sprite/frameLayers'
import { spriteImage, spriteJsonNow } from '@/shared/lib/sprite/spriteCache'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/pages/title/ui/TitleScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const SPRITE = assetUrl('./sprites/main_title')
/** 판 번호는 main_title 이 아니라 ui/num.pzx 의 131 번 그림이다 (0x2cd2a: 기준 0x81 = 129 + 값 2) */
const NUM_SPRITE = assetUrl('./sprites/num')

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 저작권 프레임 18(129×10) — x = W/2 − w/2 + 3 = 59, y = H − h − 2 = 308 (0x2cc78 확정) */
const COPYRIGHT = { x: 59, y: 308 }
/** 판 번호 num 131 "2" — x = W/2 − w/2 + w + 4 = 189, y = 308 (0x2cd2a 확정) */
const VERSION = { x: 189, y: 308 }
/** 전체이용가 이미지 7(40×46) — x = W − w − 2 = 198, y = 2 (0x2ccbc 확정) */
const RATING = { x: 198, y: 2 }

const TITLE_ANIMATION_FRAMES = [...new Set([...INTRO_ANIMATION, ...PROMPT_ANIMATION].map((entry) => entry.frame))]

interface TitleScreenProps {
  readonly onStart: () => void
}

/** main_title 프레임 한 장을 앵커 (0, 0) 에 — 0x67 겹이 있으면 화면에 더하고(`drawFrameLayers`), 아직이면 구운 프레임 */
function drawTitleFrame(context: CanvasRenderingContext2D, frame: number): void {
  const layers = placedFrameLayersOf(TITLE_FRAMES, frame, spriteJsonNow<FrameLayerListing>(frameLayersUrl(TITLE_FRAMES)), spriteImage)
  if (layers !== null) {
    drawFrameLayers(context, layers, 0, 0)
    return
  }
  const key = String(frame).padStart(3, '0')
  const origin = spriteJsonNow<FrameOrigins>(`${TITLE_FRAMES}/origins.json`)?.[key]
  const image = spriteImage(`${TITLE_FRAMES}/${key}.png`)
  if (origin !== undefined && image !== null) context.drawImage(image, origin.x, origin.y)
}

/**
 * 원작 타이틀 (그리기 0x2cbac — 차례 · 근거는 `model/titleIntro`). 화면을 검정으로 지우고 애니 0 의 프레임,
 * 끝 깃발이 선 뒤에는 애니 1(PRESS ANY KEY)을 한 캔버스에 그린다 — 흙먼지의 0x67 더하기가 아래 화면을 읽기 때문이다.
 * 저작권 · 판 번호 · 전체이용가는 효과 없는 그림이라 그 위 DOM 으로 둔다(원본도 애니 1 다음에 그린다).
 */
export function TitleScreen({ onStart }: TitleScreenProps) {
  const { scene, press } = useTitleIntro(onStart)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 애니 0 · 1 의 프레임과 0x67 겹을 먼저 받는다 — 칸이 바뀔 때마다 처음 받으면 그 칸이 비어 보인다
  useEffect(() => {
    preloadSprites([{ folder: TITLE_FRAMES, frames: TITLE_ANIMATION_FRAMES, json: ['origins.json'] }])
  }, [])

  // 그림이 늦게 와도 다음 그리기(매 rAF 다시 그린다)부터 보인다
  useEffect(() => {
    let context: CanvasRenderingContext2D | null = null
    try {
      context = effectContextOf(canvasRef.current)
    } catch {
      context = null
    }
    if (context === null) return
    // 2cbbc 0x6a735(화면, 0) — 검정
    context.fillStyle = '#000'
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    drawTitleFrame(context, scene.introFrame)
    if (scene.promptFrame !== null) drawTitleFrame(context, scene.promptFrame)
  })

  return (
    <RawScreen onPress={press}>
      <canvas ref={canvasRef} className={styles.canvas} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
        data-intro-frame={scene.introFrame} data-prompt-frame={scene.promptFrame ?? undefined}
        aria-label="2010 프로야구" />
      {scene.isSettled && (
        <>
          <Layer src={`${SPRITE}/006.png`} x={COPYRIGHT.x} y={COPYRIGHT.y} label="© 2009 GAMEVIL" />
          <Layer src={`${NUM_SPRITE}/131.png`} x={VERSION.x} y={VERSION.y} label="2" />
          <Layer src={`${SPRITE}/007.png`} x={RATING.x} y={RATING.y} label="전체이용가" />
        </>
      )}
    </RawScreen>
  )
}

interface LayerProps {
  readonly src: string
  readonly x: number
  readonly y: number
  readonly label: string
}

/** 효과 없는 그림 한 장을 원본 좌표에 */
function Layer({ src, x, y, label }: LayerProps) {
  return <img className={styles.overCanvas} style={{ left: x, top: y }} src={src} alt={label} />
}
