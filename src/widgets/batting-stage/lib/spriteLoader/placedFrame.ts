import { flippedFrameUrlOf, frameCopiesUrl, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'
import {
  type FrameLayerListing,
  type PlacedFrameLayer,
  drawFrameLayers,
  frameLayersUrl,
  hasFrameLayers,
  placedFrameLayersOf,
} from '@/shared/lib/sprite/frameLayers'
import { spriteJsonNow } from '@/shared/lib/sprite/spriteCache'
import { recoloredSprite } from '@/widgets/batting-stage/lib/spriteLoader/recoloredSprite'
import { type PlacedFrame, frameOrigins, sprite } from '@/widgets/batting-stage/lib/spriteLoader/spriteJson'

/**
 * 프레임 한 장을 원점과 함께 돌려준다. 아직 안 불러왔으면 null.
 * `paletteIndex` 를 주면 그 폴더의 대체 팔레트 벌로 칠한 그림을 쓴다 (C-1 — 몸통 피부×15+팀 · 헬멧 팀).
 * 칠하기 전에는 구운 그림이 나가므로 첫 몇 프레임은 구워진 벌(palette.json 의 baked)이 보인다.
 */
export function placedFrame(folder: string, index: number, paletteIndex: number | null = null, isFlipped = false): PlacedFrame | null {
  const origins = frameOrigins(folder)
  if (origins === null) return null

  const key = String(index).padStart(3, '0')
  const origin = origins[key]
  if (origin === undefined) return null

  const url = frameUrlOf(folder, index, paletteIndex, isFlipped)
  const image = paletteIndex === null ? sprite(url) : recoloredSprite(folder, url, paletteIndex)
  if (image === null) return null
  return { image, offsetX: origin.x, offsetY: origin.y }
}

/**
 * 효과 0x11(뒤집기)로 부르면 0xc9f98 ca07c 갈래 — 0x66 반투명 파트도 섞지 않고 복사한 판(`frameCopies`)을 쓴다.
 * 목록이 아직이면 구운 프레임(예전 근사). 복사판에는 팔레트 번호 지도가 없어 다시 칠하는 그림은 구운 판 그대로다
 * (복사판 폴더 — 머리 장비 · player_effect · event_char — 는 타석에서 다시 칠하지 않는다)
 */
function frameUrlOf(folder: string, index: number, paletteIndex: number | null, isFlipped: boolean): string {
  const usesFlippedCopy = isFlipped && paletteIndex === null && hasFrameCopies(folder)
  return usesFlippedCopy
    ? flippedFrameUrlOf(folder, index, spriteJsonNow<unknown>(frameCopiesUrl(folder)))
    : `${folder}/${String(index).padStart(3, '0')}.png`
}

/**
 * 0x67(더하기) 파트가 든 프레임의 겹 (`shared/lib/sprite/frameLayers`). `FRAME_LAYER_FOLDERS` 폴더만 목록을 청한다 —
 * 겹 목록 · 겹 그림이 아직 안 왔거나 그 프레임에 0x67 파트가 없으면 null 이라 부르는 쪽은 구운 프레임(`placedFrame`)을 그린다.
 * `paletteIndex` 는 `placedFrame` 과 같다 — 겹 번호 지도는 `frames/layers/index/` 에 있다.
 */
export function placedFrameLayers(folder: string, index: number, paletteIndex: number | null = null): readonly PlacedFrameLayer[] | null {
  if (!hasFrameLayers(folder)) return null
  return placedFrameLayersOf(folder, index, spriteJsonNow<FrameLayerListing>(frameLayersUrl(folder)), (url) =>
    paletteIndex === null ? sprite(url) : recoloredSprite(folder, url, paletteIndex),
  )
}

/**
 * 프레임 한 장을 (x, y) 기준에 그린다 — 겹이 있으면 0x67 파트를 화면에 더하고(`drawFrameLayers`), 없으면 구운 프레임.
 * `partEffects` 는 부른 쪽 효과가 0 인가(0xc9f98 ca198) — 0x11 뒤집기로 부르면 거짓.
 * 그린 것이 없으면(구운 프레임도 아직) false.
 */
export function drawFrameAt(
  context: CanvasRenderingContext2D,
  folder: string,
  index: number,
  x: number,
  y: number,
  options: { readonly paletteIndex?: number | null; readonly partEffects?: boolean } = {},
): boolean {
  const layers = placedFrameLayers(folder, index, options.paletteIndex ?? null)
  if (layers !== null) {
    drawFrameLayers(context, layers, x, y, options.partEffects ?? true)
    return true
  }
  const placed = placedFrame(folder, index, options.paletteIndex ?? null)
  if (placed === null) return false
  context.drawImage(placed.image, x + placed.offsetX, y + placed.offsetY)
  return true
}
