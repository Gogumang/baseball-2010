import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const recolored = vi.hoisted(() => [] as string[])
vi.mock('@/shared/lib/sprite/paletteSwap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/sprite/paletteSwap')>()
  return {
    ...actual,
    recoloredSpriteUrl: (url: string, _palettes: unknown, index: number) => {
      recolored.push(`${url}#${index}`)
      return new Promise<string>(() => {})
    },
  }
})

import { resetSpriteCacheForTest } from '@/shared/lib/sprite/spriteCache'
import { resetWarmedRecolorsForTest, warmRecoloredFrame, warmRecoloredFrames } from '@/widgets/batting-stage/lib/spriteLoader'

const FOLDER = './sprites/batter_test/frames'

describe('warmRecoloredFrame — 처음 그리기 전에 칠하기를 건다 (r177 플레이 점검: 첫 스윙의 파란 헬멧)', () => {
  beforeEach(() => {
    recolored.length = 0
    resetSpriteCacheForTest()
    resetWarmedRecolorsForTest()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.endsWith('origins.json')
          ? { '000': { x: 0, y: 0, width: 1, height: 1 }, '005': { x: 0, y: 0, width: 1, height: 1 } }
          : url.endsWith('layers.json')
            ? {
                '005': [
                  { png: '005_0.png', x: 0, y: 0, effect: 0x67 },
                  { png: '005_1.png', x: 0, y: 0, effect: 0 },
                ],
              }
            : { baked: 0, palettes: [['#000'], ['#fff']] }
        return { ok: true, json: async () => body }
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('원점 · 팔레트가 오기 전에는 걸지 못하고 false — 온 뒤에는 그 프레임 칠하기를 건다', async () => {
    expect(warmRecoloredFrame(FOLDER, 5, 1)).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(warmRecoloredFrame(FOLDER, 5, 1)).toBe(true)
    expect(recolored).toEqual([`${FOLDER}/005.png#1`])
  })

  it('원점에 없는 프레임은 칠할 것이 없어 true · 구운 벌이면 칠하지 않는다', async () => {
    warmRecoloredFrame(FOLDER, 0, 1)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(warmRecoloredFrame(FOLDER, 9, 1)).toBe(true)
    expect(warmRecoloredFrame(FOLDER, 0, 0)).toBe(true)
    expect(recolored).toEqual([])
  })

  it('0x67 겹이 있는 폴더(하늘 조명)는 겹 그림도 같이 건다 — 겹 목록이 오기 전에는 false', async () => {
    const sky = './sprites/sky_effect_light/frames'
    expect(warmRecoloredFrame(sky, 5, 1)).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(warmRecoloredFrame(sky, 5, 1)).toBe(true)
    expect(recolored).toEqual([`${sky}/005.png#1`, `${sky}/layers/005_0.png#1`, `${sky}/layers/005_1.png#1`])
  })
})

describe('warmRecoloredFrames — 한 그림 객체의 자세 전부를 한 번에 (r189: 투수 장비 · 주자 · 하늘 조명)', () => {
  beforeEach(() => {
    recolored.length = 0
    resetSpriteCacheForTest()
    resetWarmedRecolorsForTest()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.endsWith('origins.json')
          ? { '000': { x: 0, y: 0, width: 1, height: 1 }, '005': { x: 0, y: 0, width: 1, height: 1 } }
          : { baked: 0, palettes: [['#000'], ['#fff'], ['#f00']] }
        return { ok: true, json: async () => body }
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('원점 · 팔레트가 오기 전에는 다시 보고, 다 걸면 같은 열쇠는 목록도 안 만든다', async () => {
    const framesOf = vi.fn(() => [
      { folder: FOLDER, frame: 0, paletteIndex: 1 },
      { folder: FOLDER, frame: 5, paletteIndex: 2 },
      { folder: FOLDER, frame: 5, paletteIndex: null },
    ])
    warmRecoloredFrames('pitcher|x', framesOf)
    expect(recolored).toEqual([])
    await new Promise((resolve) => setTimeout(resolve, 0))
    warmRecoloredFrames('pitcher|x', framesOf)
    expect(recolored).toEqual([`${FOLDER}/000.png#1`, `${FOLDER}/005.png#2`])
    warmRecoloredFrames('pitcher|x', framesOf)
    expect(framesOf).toHaveBeenCalledTimes(2)
  })
})
