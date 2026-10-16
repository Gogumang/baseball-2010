// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSpriteImageRequested, loadSpriteImage, resetSpriteCacheForTest, retainDisplayedSprites } from '@/shared/lib/sprite/spriteCache'
import { spriteMaskImage, spriteMaskSrc } from '@/shared/lib/sprite/spriteMask'

class FakeImage {
  static made: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  crossOrigin: string | null = null
  constructor() {
    FakeImage.made.push(this)
  }
  setAttribute() {}
  decode() {
    return Promise.resolve()
  }
}

const flushObserver = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  resetSpriteCacheForTest()
  FakeImage.made = []
  vi.stubGlobal('Image', FakeImage)
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('spriteMask — 마스크는 <img> 와 캐시 칸이 갈리는 다른 주소', () => {
  it('?mask 를 붙이고, data: · 질의 붙은 주소는 그대로 둔다', () => {
    expect(spriteMaskSrc('./sprites/img_text/frames/006.png')).toBe('./sprites/img_text/frames/006.png?mask')
    expect(spriteMaskImage('./sprites/num/001.png')).toBe('url(./sprites/num/001.png?mask)')
    expect(spriteMaskSrc('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
    expect(spriteMaskSrc('./a.png?x')).toBe('./a.png?x')
  })

  it('마스크 주소는 CORS 모드(crossOrigin anonymous)로, 보통 주소는 그대로 받는다', () => {
    void loadSpriteImage('./sprites/img_text/frames/006.png?mask')
    void loadSpriteImage('./sprites/img_text/frames/006.png')
    expect(FakeImage.made.map((image) => [image.src, image.crossOrigin])).toEqual([
      ['./sprites/img_text/frames/006.png?mask', 'anonymous'],
      ['./sprites/img_text/frames/006.png', null],
    ])
  })
})

describe('retainDisplayedSprites — src 가 걸리는 순간 따로 받아 붙든다', () => {
  it('붙는 <img> · 바뀌는 src 를 load 를 기다리지 않고 붙든다 (애니가 받기보다 빨라도 끝내 받힌다)', async () => {
    const stop = retainDisplayedSprites(document)
    const holder = document.createElement('div')
    holder.innerHTML = '<span><img src="./sprites/loadingbar/frames/001.png"></span><img src="./ui/x.png">'
    document.body.appendChild(holder)
    await flushObserver()
    expect(isSpriteImageRequested('./sprites/loadingbar/frames/001.png')).toBe(true)
    expect(isSpriteImageRequested('./ui/x.png')).toBe(false)
    holder.querySelector('img')?.setAttribute('src', './sprites/loadingbar/frames/003.png')
    await flushObserver()
    expect(isSpriteImageRequested('./sprites/loadingbar/frames/003.png')).toBe(true)
    stop()
    holder.querySelector('img')?.setAttribute('src', './sprites/loadingbar/frames/004.png')
    await flushObserver()
    expect(isSpriteImageRequested('./sprites/loadingbar/frames/004.png')).toBe(false)
  })
})
