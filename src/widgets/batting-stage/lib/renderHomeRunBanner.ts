/**
 * 홈런 글자 연출 그리기 — 좌표·단계는 homeRunBanner.ts 가 셈한다 (원본 0x40b18, R2 3-2).
 *
 * 원본 0xbb91d 는 PZX 를 픽셀 단위로 풀어 화면 버퍼에 직접 쓴다 (R6 3c):
 *   종류 2 = 최근접 표본으로 a/10 배 확대 · 종류 8 = 채널마다 +b 밝게.
 * 웹은 캔버스라 확대는 imageSmoothingEnabled 를 꺼 최근접으로 맞추고,
 * 밝히기는 알파로 잘라 낸 밝기 판을 'lighter' 로 겹쳐 채널 덧셈을 그대로 낸다.
 */
import { GAME_EFFECT_FRAMES, GAME_EFFECT_IMAGE, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { homeRunBurstFrameAt, homeRunLettersAt } from '@/widgets/batting-stage/lib/homeRunBanner'

/** 밝힌 글자는 몇 장 안 되니(글자 7 × 밝기 2) 만들어 두고 다시 쓴다 */
const brightCache = new Map<string, CanvasImageSource>()

/** 채널마다 +amount — 그림이 있는 칸에만 더해야 해서 알파로 자른 밝기 판을 겹친다 */
function brightened(image: HTMLImageElement, amount: number): CanvasImageSource {
  const key = `${image.src}#${amount}`
  const cached = brightCache.get(key)
  if (cached !== undefined) return cached

  const glow = document.createElement('canvas')
  glow.width = image.width
  glow.height = image.height
  const glowContext = glow.getContext('2d')
  const result = document.createElement('canvas')
  result.width = image.width
  result.height = image.height
  const resultContext = result.getContext('2d')
  if (glowContext === null || resultContext === null) return image

  // 밝기 판 = 그림의 알파를 그대로 쓴 rgb(a,a,a)
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

/** tick = 연출이 켜진 뒤 흐른 틱 */
export function drawHomeRunBanner(context: CanvasRenderingContext2D, tick: number): void {
  // 단계 1·2·3 은 화면 가운데에 game_effect 프레임 18·19·20 을 먼저 깔고 글자를 그 위에 얹는다
  const burst = homeRunBurstFrameAt(tick)
  if (burst !== null) {
    const frame = placedFrame(GAME_EFFECT_FRAMES, burst)
    if (frame !== null) {
      context.drawImage(
        frame.image,
        Math.floor(STAGE_WIDTH / 2) + frame.offsetX,
        Math.floor(STAGE_HEIGHT / 2) + frame.offsetY,
      )
    }
  }

  const smoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  for (const letter of homeRunLettersAt(tick)) {
    const image = sprite(GAME_EFFECT_IMAGE(letter.image))
    if (image === null) continue
    const source = letter.brighten > 0 ? brightened(image, letter.brighten) : image
    context.drawImage(
      source,
      letter.x,
      letter.y,
      image.width * letter.scale,
      image.height * letter.scale,
    )
  }
  context.imageSmoothingEnabled = smoothing
}
