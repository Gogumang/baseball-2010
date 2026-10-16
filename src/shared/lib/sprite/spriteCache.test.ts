import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSpriteImageRequested, loadSpriteImage, loadSpriteJson, readySpriteJson, resetSpriteCacheForTest, retainDisplayedSprites, spriteImage,
  spriteJsonNow,
} from '@/shared/lib/sprite/spriteCache'

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve()
}

/** onload/onerror 를 손으로 부르는 가짜 Image */
class FakeImage {
  static made: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
  decodeCalls = 0
  readonly attributes = new Map<string, string>()
  constructor() {
    FakeImage.made.push(this)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  decode() {
    this.decodeCalls += 1
    return Promise.resolve()
  }
}

beforeEach(() => {
  resetSpriteCacheForTest()
  FakeImage.made = []
  vi.stubGlobal('Image', FakeImage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('spriteImage (캔버스)', () => {
  it('처음엔 null 이고 받기를 시작한다 — 도착하면 그 그림을 돌려준다', () => {
    expect(spriteImage('./a.png')).toBeNull()
    expect(FakeImage.made).toHaveLength(1)
    expect(FakeImage.made[0]?.src).toBe('./a.png')
    expect(spriteImage('./a.png')).toBeNull()
    expect(FakeImage.made).toHaveLength(1)

    FakeImage.made[0]?.onload?.()
    expect(spriteImage('./a.png')).toBe(FakeImage.made[0])
  })

  it('실패한 그림은 다시 받지 않는다', () => {
    spriteImage('./x.png')
    FakeImage.made[0]?.onerror?.()
    expect(spriteImage('./x.png')).toBeNull()
    expect(FakeImage.made).toHaveLength(1)
  })

  it('Image 가 없는 환경(node)에서는 null', () => {
    vi.stubGlobal('Image', undefined)
    expect(spriteImage('./a.png')).toBeNull()
    expect(isSpriteImageRequested('./a.png')).toBe(false)
  })
})

describe('loadSpriteImage (미리 받기)', () => {
  it('decode 까지 마치고 풀리며, 캔버스가 같은 그림을 바로 쓴다', async () => {
    const loaded = loadSpriteImage('./b.png', true)
    const image = FakeImage.made[0]
    expect(image?.attributes.get('fetchpriority')).toBe('low')
    image?.onload?.()
    await expect(loaded).resolves.toBe(image)
    expect(image?.decodeCalls).toBe(1)
    expect(spriteImage('./b.png')).toBe(image)
    expect(FakeImage.made).toHaveLength(1)
  })

  it('캔버스가 먼저 부른 그림을 다시 요청하지 않는다', async () => {
    spriteImage('./c.png')
    const loaded = loadSpriteImage('./c.png')
    expect(FakeImage.made).toHaveLength(1)
    FakeImage.made[0]?.onload?.()
    await expect(loaded).resolves.toBe(FakeImage.made[0])
  })

  it('실패하면 null 로 풀린다', async () => {
    const loaded = loadSpriteImage('./d.png')
    FakeImage.made[0]?.onerror?.()
    await expect(loaded).resolves.toBeNull()
  })
})

describe('JSON 캐시', () => {
  it('같은 주소는 한 번만 받고, 도착하면 readySpriteJson·spriteJsonNow 가 바로 돌려준다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ '000': { x: 1 } }) }))
    vi.stubGlobal('fetch', fetchMock)
    expect(readySpriteJson('./o.json')).toBeUndefined()
    expect(spriteJsonNow('./o.json')).toBeNull()
    const loaded = loadSpriteJson('./o.json')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(loaded).resolves.toEqual({ '000': { x: 1 } })
    expect(readySpriteJson('./o.json')).toEqual({ value: { '000': { x: 1 } } })
    expect(spriteJsonNow('./o.json')).toEqual({ '000': { x: 1 } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('실패하면 캔버스는 다시 받지 않지만, loadSpriteJson 은 다시 받는다', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => null }))
    vi.stubGlobal('fetch', fetchMock)
    expect(spriteJsonNow('./none.json')).toBeNull()
    await flush()
    expect(spriteJsonNow('./none.json')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(loadSpriteJson('./none.json')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('retainDisplayedSprites', () => {
  it('스프라이트 <img> 가 뜨면 같은 주소를 공용 캐시에 붙든다 (요소 자체는 두지 않는다)', () => {
    const listeners: ((event: Event) => void)[] = []
    const target = {
      addEventListener: (_type: string, listener: (event: Event) => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    } as unknown as Document
    class FakeElement {
      constructor(readonly srcAttribute: string | null) {}
      getAttribute() {
        return this.srcAttribute
      }
    }
    vi.stubGlobal('HTMLImageElement', FakeElement)
    const stop = retainDisplayedSprites(target)
    listeners[0]?.({ target: new FakeElement('./sprites/main_ball/frames/002.png') } as unknown as Event)
    listeners[0]?.({ target: new FakeElement('./ui/logo.png') } as unknown as Event)
    listeners[0]?.({ target: { getAttribute: () => './sprites/x/000.png' } } as unknown as Event)
    expect(isSpriteImageRequested('./sprites/main_ball/frames/002.png')).toBe(true)
    expect(isSpriteImageRequested('./ui/logo.png')).toBe(false)
    expect(isSpriteImageRequested('./sprites/x/000.png')).toBe(false)
    expect(FakeImage.made.map((image) => image.src)).toEqual(['./sprites/main_ball/frames/002.png'])
    stop()
    expect(target.removeEventListener).toHaveBeenCalled()
  })
})
