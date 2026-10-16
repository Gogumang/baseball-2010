import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import {
  FRAME_LAYER_FOLDERS,
  drawFrameLayers,
  frameLayerUrlsOf,
  hasFrameLayers,
  placedFrameLayersOf,
  type FrameLayerListing,
  type PlacedFrameLayer,
} from '@/shared/lib/sprite/frameLayers'

const listingOf = (name: string) =>
  JSON.parse(readFileSync(`public/sprites/${name}/frames/layers.json`, 'utf8')) as FrameLayerListing

/** `tools/decode_pzx.py` 의 write_rgba_png 꼴(RGBA 8비트 · 줄 거르개 0)만 읽는다 */
function readToolPng(path: string): { readonly width: number; readonly height: number; readonly data: Uint8Array } {
  const file = readFileSync(path)
  const width = file.readUInt32BE(16)
  const height = file.readUInt32BE(20)
  const length = file.readUInt32BE(33)
  const raw = inflateSync(file.subarray(41, 41 + length))
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    expect(raw[y * (width * 4 + 1)]).toBe(0)
    data.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4)
  }
  return { width, height, data }
}

describe('0x67 겹 목록 (layers.json)', () => {
  it('목록을 청하는 폴더 = layers.json 을 둔 폴더', () => {
    const withLayers = readdirSync('public/sprites').filter((name) => existsSync(`public/sprites/${name}/frames/layers.json`))
    expect(new Set(withLayers)).toEqual(FRAME_LAYER_FOLDERS)
    expect(hasFrameLayers('./sprites/game_effect/frames')).toBe(true)
    expect(hasFrameLayers('./sprites/effect_frame/frames')).toBe(false)
    expect(hasFrameLayers('./sprites/game_effect')).toBe(false)
  })

  it('겹 그림이 모두 있고 효과는 0 · 2(인자 1~255) 뿐이다', () => {
    for (const name of FRAME_LAYER_FOLDERS) {
      for (const entries of Object.values(listingOf(name))) {
        expect(entries.some((entry) => entry.effect === 2)).toBe(true)
        for (const entry of entries) {
          expect(existsSync(`public/sprites/${name}/frames/layers/${entry.png}`)).toBe(true)
          expect([0, 2]).toContain(entry.effect)
          if (entry.effect === 2) expect(entry.argument).toBeGreaterThanOrEqual(1)
          if (entry.effect === 2) expect(entry.argument).toBeLessThanOrEqual(255)
        }
      }
    }
  })

  it('하늘 조명 11 프레임은 같은 날 그림을 b = 200 ~ 100 으로 더하고, 구운 프레임은 같은 자리의 알파 b 근사다', () => {
    const listing = listingOf('sky_effect_light')
    const origins = JSON.parse(readFileSync('public/sprites/sky_effect_light/frames/origins.json', 'utf8')) as Record<
      string, { x: number; y: number }
    >
    const layer = readToolPng('public/sprites/sky_effect_light/frames/layers/000_0.png')
    for (let frame = 0; frame <= 10; frame += 1) {
      const key = String(frame).padStart(3, '0')
      expect(listing[key]).toEqual([{ png: '000_0.png', x: 163, y: 0, effect: 2, argument: 200 - frame * 10 }])
      expect(origins[key]).toMatchObject({ x: 163, y: 0 })
      const baked = readToolPng(`public/sprites/sky_effect_light/frames/${key}.png`)
      expect([baked.width, baked.height]).toEqual([layer.width, layer.height])
      for (let at = 0; at < layer.data.length; at += 4) {
        expect(baked.data[at + 3]).toBe(layer.data[at + 3] === 0 ? 0 : 200 - frame * 10)
        if (layer.data[at + 3] !== 0) expect([...baked.data.subarray(at, at + 3)]).toEqual([...layer.data.subarray(at, at + 3)])
      }
    }
    // 날 그림은 섞지 않은 불투명 그림이다
    for (let at = 3; at < layer.data.length; at += 4) expect([0, 255]).toContain(layer.data[at])
  })

  it('미리 받기 주소 — 고른 프레임의 겹 그림을 한 번씩', () => {
    expect(frameLayerUrlsOf('./sprites/sky_effect_light/frames', listingOf('sky_effect_light'), [0, 3, 10, 11]))
      .toEqual(['./sprites/sky_effect_light/frames/layers/000_0.png'])
    expect(frameLayerUrlsOf('./sprites/x/frames', null, [0])).toEqual([])
  })

  it('목록 · 그림이 하나라도 아직이면 null — 부르는 쪽이 구운 프레임을 그린다', () => {
    const listing: FrameLayerListing = { '005': [{ png: '005_0.png', x: 1, y: 2, effect: 0 }, { png: '005_1.png', x: 3, y: 4, effect: 2, argument: 255 }] }
    const image = {} as HTMLImageElement
    expect(placedFrameLayersOf('./f', 5, null, () => image)).toBeNull()
    expect(placedFrameLayersOf('./f', 6, listing, () => image)).toBeNull()
    expect(placedFrameLayersOf('./f', 5, listing, (url) => (url.endsWith('005_1.png') ? null : image))).toBeNull()
    expect(placedFrameLayersOf('./f', 5, listing, () => image)).toEqual([
      { image, offsetX: 1, offsetY: 2, effect: 0, argument: 0 },
      { image, offsetX: 3, offsetY: 4, effect: 2, argument: 255 },
    ])
  })

  it('부른 쪽 효과가 0 이 아니면(0x11 뒤집기 — 0xc9f98 ca074) 파트 효과 없이 모두 복사한다', () => {
    const drawImage = vi.fn()
    const context = { drawImage } as unknown as CanvasRenderingContext2D
    const image = {} as HTMLImageElement
    const layers: PlacedFrameLayer[] = [
      { image, offsetX: -3, offsetY: 1, effect: 0, argument: 0 },
      { image, offsetX: 5, offsetY: -2, effect: 2, argument: 200 },
    ]
    drawFrameLayers(context, layers, 10, 20, false)
    expect(drawImage.mock.calls).toEqual([[image, 7, 21], [image, 15, 18]])
  })
})
