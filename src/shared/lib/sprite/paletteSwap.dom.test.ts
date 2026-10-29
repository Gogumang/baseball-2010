// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recoloredSpriteUrl, type SpritePalettes } from '@/shared/lib/sprite/paletteSwap'

/** 번호 지도(`/index/`)는 늘 실패하고 다른 그림은 늘 오는 가짜 Image */
class FakeImage {
  static requested: string[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 1
  height = 1
  set src(url: string) {
    FakeImage.requested.push(url)
    setTimeout(() => (url.includes('/index/') ? this.onerror?.() : this.onload?.()), 0)
  }
}

const palettes: SpritePalettes = {
  mpl: 'stadium/attack_sky_cloud.mpl',
  select: '',
  baked: null,
  colors: ['#000000'],
  palettes: [['#111111'], ['#222222'], ['#333333']],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('번호 지도 실패 캐시', () => {
  it('받지 못한 번호 지도는 벌이 바뀌어도 다시 청하지 않고 구운 그림을 쓴다', async () => {
    FakeImage.requested = []
    vi.stubGlobal('Image', FakeImage)
    const sprite = './sprites/test_sky/frames/000.png'

    expect(await recoloredSpriteUrl(sprite, palettes, 0)).toBe(sprite)
    expect(await recoloredSpriteUrl(sprite, palettes, 1)).toBe(sprite)
    expect(await recoloredSpriteUrl(sprite, palettes, 2)).toBe(sprite)

    const indexRequests = FakeImage.requested.filter((url) => url.includes('/index/'))
    expect(indexRequests).toEqual(['./sprites/test_sky/frames/index/000.png'])
  })
})
