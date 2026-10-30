/** 메뉴 바탕 0x58371 의 떠 둔 버퍼 [skin+0x450] — 캔버스에서 16비트 화면 연산 그대로 한 번 지어 앱에 하나 둔다 */
import { MAIN_TITLE_BACKDROP, SKIN_SCREEN, finishMainTitleBackdrop565, rgbOf565, rgbTo565 } from '@/pages/special/lib/skinBackdrops'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawFrameLayers, frameLayersUrl, frameLayerUrl, type FrameLayerListing, type PlacedFrameLayer } from '@/shared/lib/sprite/frameLayers'
import { loadSpriteJson } from '@/shared/lib/sprite/spriteCache'
import { tryOr } from '@/shared/lib/safe/tryOr'
import { MAIN_TITLE, pad } from '@/pages/special/ui/skinBackdrops/skinAssets'

const MAIN_TITLE_FRAMES = `${MAIN_TITLE}/frames`
export const MAIN_TITLE_FRAME_SRC = `${MAIN_TITLE_FRAMES}/${pad(MAIN_TITLE_BACKDROP.frame)}.png`
export const MAIN_TITLE_BADGE_SRC = `${MAIN_TITLE}/${pad(MAIN_TITLE_BACKDROP.badgeImage)}.png`

/** 떠 둔 버퍼 [skin+0x450] — 앱에 하나 */
export const mainTitleBuffer: { url: string | null; pending: Promise<string | null> | null } = { url: null, pending: null }

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
export function buildMainTitleBuffer(): Promise<string | null> {
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
