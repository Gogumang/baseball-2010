// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  readyRecoloredSpriteUrl,
  recolorRequestsOf,
  useWarmRecoloredFolder,
  useWarmRecoloredSprites,
  warmRecoloredSprites,
  type SpritePalettes,
} from '@/shared/lib/sprite/paletteSwap'
import { resetSpriteCacheForTest } from '@/shared/lib/sprite/spriteCache'

/** 그림 · 번호 지도가 늘 오는 가짜 Image (jsdom 캔버스는 없어 칠하기는 구운 주소로 끝나지만 "칠해 둠" 표는 남는다) */
class FakeImage {
  static requested: string[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 1
  height = 1
  set src(url: string) {
    FakeImage.requested.push(url)
    setTimeout(() => this.onload?.(), 0)
  }
}

const palettes: SpritePalettes = {
  mpl: 'test.mpl',
  select: '',
  baked: 0,
  colors: ['#000000'],
  palettes: [['#000000'], ['#111111'], ['#222222']],
}

/** 시험마다 다른 폴더 — 칠해 둔 표(모듈 안)가 시험끼리 섞이지 않게 */
let folderSerial = 0
let folder = ''

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  folderSerial += 1
  folder = `./sprites/warm_test_${folderSerial}/frames`
  FakeImage.requested = []
  resetSpriteCacheForTest()
  vi.stubGlobal('Image', FakeImage)
  // jsdom 은 캔버스가 없다 — 칠하기는 구운 주소로 끝난다(시끄러운 "Not implemented" 를 막는다)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.endsWith('origins.json')
        ? { '000': { x: 0, y: 0, width: 1, height: 1 }, '003': { x: 0, y: 0, width: 1, height: 1 } }
        : palettes
      return { ok: true, json: async () => body }
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('recolorRequestsOf', () => {
  it('폴더 프레임을 벌 하나로 — 같은 프레임은 한 번, 벌이 null 이면 빈 목록', () => {
    expect(recolorRequestsOf('./sprites/a/frames', [3, 0, 3], 2)).toEqual([
      { url: './sprites/a/frames/003.png', paletteIndex: 2 },
      { url: './sprites/a/frames/000.png', paletteIndex: 2 },
    ])
    expect(recolorRequestsOf('./sprites/a/frames', [0], null)).toEqual([])
  })
})

describe('warmRecoloredSprites — 처음 그리기 전에 칠해 둔다 (r189: 첫 와인드업 · 첫 동작의 구운 벌)', () => {
  it('팔레트를 받아 칠하기를 걸고, 끝나면 그리는 쪽이 기다리지 않고 바로 쓴다', async () => {
    const url = `${folder}/003.png`
    expect(readyRecoloredSpriteUrl(url, palettes, 1)).toBeNull()
    warmRecoloredSprites([
      { url, paletteIndex: 1 },
      { url: `${folder}/000.png`, paletteIndex: null },
    ])
    await flush()
    expect(readyRecoloredSpriteUrl(url, palettes, 1)).not.toBeNull()
    // 벌이 null 인 그림은 칠하지 않는다 — 번호 지도도 청하지 않는다
    expect(FakeImage.requested).not.toContain(`${folder}/index/000.png`)
  })

  it('useWarmRecoloredSprites — 렌더마다 새 목록이어도 내용이 같으면 다시 걸지 않는다', async () => {
    const url = `${folder}/000.png`
    const fetchMock = vi.mocked(fetch)
    const { rerender } = renderHook(({ index }) => useWarmRecoloredSprites(recolorRequestsOf(folder, [0], index)), {
      initialProps: { index: 2 },
    })
    await flush()
    expect(readyRecoloredSpriteUrl(url, palettes, 2)).not.toBeNull()
    const calls = fetchMock.mock.calls.length
    rerender({ index: 2 })
    await flush()
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('useWarmRecoloredFolder — 원점에 있는 칸 전부를 벌마다 칠한다', async () => {
    renderHook(() => useWarmRecoloredFolder(folder, [1, null, 1]))
    await flush()
    expect(readyRecoloredSpriteUrl(`${folder}/000.png`, palettes, 1)).not.toBeNull()
    expect(readyRecoloredSpriteUrl(`${folder}/003.png`, palettes, 1)).not.toBeNull()
    expect(readyRecoloredSpriteUrl(`${folder}/003.png`, palettes, 2)).toBeNull()
  })
})

describe('모양이 틀린 palette.json', () => {
  it('벌 목록이 없으면 칠하지 않고 구운 그림 — 미리 칠하기가 먼저 받아 둔 JSON 이 그리는 쪽을 깨뜨리지 않게', async () => {
    const url = `${folder}/000.png`
    const broken = { '000': {} } as unknown as SpritePalettes
    expect(readyRecoloredSpriteUrl(url, broken, 1)).toBe(url)
  })
})
