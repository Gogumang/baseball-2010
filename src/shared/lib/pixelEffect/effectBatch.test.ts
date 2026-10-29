import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DRAW_EFFECT,
  composeRgba,
  createReadCache,
  drawRgbaWithEffect,
  drawRgbasWithEffect,
  isEffectDrawn,
} from '@/shared/lib/pixelEffect/pixelEffect'
import type { EffectCanvasContext, EffectDraw, RgbaSurface } from '@/shared/lib/pixelEffect/pixelEffect'

/*
 * 성능 손질(r108) 전후 같은 픽셀 증명 — 화면 읽기 · 쓰기를 모은 `drawRgbasWithEffect` 가
 * 손질 전 `drawImageWithEffect`(그리기마다 제 칸을 읽고 섞고 놓기)를 차례대로 부른 것과 **바이트 단위로 같은지** 본다.
 *
 * 시험 DOM 에는 캔버스가 없어 가짜 캔버스를 쓴다. 브라우저 캔버스는 픽셀을 **곱한 알파(premultiplied)** 로 담아
 * 읽기 · 놓기 왕복이 반투명 칸 값을 반올림할 수 있다 — 가짜 캔버스도 그렇게 담는다(반올림 · 버림 두 모형).
 * 그러면 "왕복 횟수가 달라지면 결과가 달라지는" 경우까지 잡힌다.
 */

type Rounding = 'round' | 'floor'

/** 곱한 알파로 담는 가짜 캔버스 */
function createFakeCanvas(width: number, height: number, rounding: Rounding) {
  const stored = new Uint8ClampedArray(width * height * 4)
  const quantize = rounding === 'round' ? Math.round : Math.floor
  let reads = 0
  let writes = 0
  const store = (at: number, r: number, g: number, b: number, a: number) => {
    stored[at] = quantize((r * a) / 255)
    stored[at + 1] = quantize((g * a) / 255)
    stored[at + 2] = quantize((b * a) / 255)
    stored[at + 3] = a
  }
  const load = (at: number, out: Uint8ClampedArray, to: number) => {
    const a = stored[at + 3]
    for (let channel = 0; channel < 3; channel += 1) out[to + channel] = a === 0 ? 0 : quantize((stored[at + channel] * 255) / a)
    out[to + 3] = a
  }
  const context: EffectCanvasContext = {
    canvas: { width, height },
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      reads += 1
      const data = new Uint8ClampedArray(sw * sh * 4)
      for (let row = 0; row < sh; row += 1) {
        for (let column = 0; column < sw; column += 1) load(((sy + row) * width + sx + column) * 4, data, (row * sw + column) * 4)
      }
      return { data, width: sw, height: sh, colorSpace: 'srgb' } as ImageData
    },
    putImageData(
      image: ImageData,
      dx: number,
      dy: number,
      dirtyX: number = 0,
      dirtyY: number = 0,
      dirtyWidth: number = image.width,
      dirtyHeight: number = image.height,
    ) {
      writes += 1
      for (let row = dirtyY; row < dirtyY + dirtyHeight; row += 1) {
        for (let column = dirtyX; column < dirtyX + dirtyWidth; column += 1) {
          const from = (row * image.width + column) * 4
          const d = image.data
          store(((dy + row) * width + dx + column) * 4, d[from], d[from + 1], d[from + 2], d[from + 3])
        }
      }
    },
  } as EffectCanvasContext
  const fill = (pixel: (index: number) => readonly [number, number, number, number]) => {
    for (let index = 0; index < width * height; index += 1) store(index * 4, ...pixel(index))
  }
  return { context, stored, fill, counts: () => ({ reads, writes }) }
}

/** 손질 전 `drawImageWithEffect` 의 변환 없는 갈래를 그대로 옮긴 것 (8c046db6 pixelEffect.ts 412~442) */
function drawBefore(context: EffectCanvasContext, sprite: RgbaSurface, x: number, y: number, effect: number, argument: number) {
  if (!isEffectDrawn(effect, argument)) return
  const left = Math.max(0, Math.floor(x))
  const top = Math.max(0, Math.floor(y))
  const right = Math.min(context.canvas.width, Math.floor(x) + sprite.width)
  const bottom = Math.min(context.canvas.height, Math.floor(y) + sprite.height)
  if (right <= left || bottom <= top) return
  const region = context.getImageData(left, top, right - left, bottom - top)
  composeRgba({ data: region.data, width: region.width, height: region.height }, sprite, Math.floor(x) - left, Math.floor(y) - top, effect, argument)
  context.putImageData(region, left, top)
}

/** 시드 난수 (mulberry32) */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EFFECTS = [
  DRAW_EFFECT.ADDITIVE,
  DRAW_EFFECT.ADDITIVE,
  DRAW_EFFECT.ADDITIVE,
  DRAW_EFFECT.TRANSLUCENT,
  DRAW_EFFECT.JITTER,
  DRAW_EFFECT.GRAY,
  DRAW_EFFECT.HALF_MIX,
  DRAW_EFFECT.ADD_COLOR,
]

function randomSprite(random: () => number): RgbaSurface {
  const width = 1 + Math.floor(random() * 12)
  const height = 1 + Math.floor(random() * 12)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let at = 0; at < data.length; at += 4) {
    const roll = random()
    data[at] = Math.floor(random() * 256)
    data[at + 1] = Math.floor(random() * 256)
    data[at + 2] = Math.floor(random() * 256)
    data[at + 3] = roll < 0.3 ? 0 : roll < 0.4 ? Math.floor(random() * 256) : 255
  }
  return { data, width, height }
}

function randomDraws(random: () => number, width: number, height: number, clustered: boolean): EffectDraw[] {
  const count = 1 + Math.floor(random() * 14)
  const centerX = random() * width
  const centerY = random() * height
  return Array.from({ length: count }, () => {
    const effect = EFFECTS[Math.floor(random() * EFFECTS.length)]
    const argument =
      effect === DRAW_EFFECT.TRANSLUCENT
        ? Math.floor(random() * 17)
        : effect === DRAW_EFFECT.ADDITIVE
          ? Math.floor(random() * 260)
          : effect === DRAW_EFFECT.JITTER
            ? Math.floor(random() * 4)
            : Math.floor(random() * 32)
    const spread = clustered ? 8 : width
    return {
      sprite: randomSprite(random),
      x: (clustered ? centerX : 0) + (random() - 0.5) * 2 * spread - 4 + random(),
      y: (clustered ? centerY : 0) + (random() - 0.5) * 2 * spread - 4 + random(),
      effect,
      argument,
    }
  })
}

type Backdrop = 'opaque' | 'clear' | 'mixed'

function backdropPixel(kind: Backdrop, random: () => number): readonly [number, number, number, number] {
  const rgb = [Math.floor(random() * 256), Math.floor(random() * 256), Math.floor(random() * 256)] as const
  if (kind === 'opaque') return [...rgb, 255]
  if (kind === 'clear') return [0, 0, 0, 0]
  const roll = random()
  return [...rgb, roll < 0.3 ? 0 : roll < 0.6 ? 1 + Math.floor(random() * 254) : 255]
}

/** 같은 화면 · 같은 그리기로 전후를 돌려 담긴 바이트를 낸다 */
function runBoth(seed: number, backdrop: Backdrop, rounding: Rounding, clustered: boolean) {
  const random = seeded(seed)
  const width = 40
  const height = 30
  const pixels = Array.from({ length: width * height }, () => backdropPixel(backdrop, random))
  const draws = randomDraws(random, width, height, clustered)
  const jitterSeed = Math.floor(random() * 1e9)

  const before = createFakeCanvas(width, height, rounding)
  before.fill((index) => pixels[index])
  let jitter = seeded(jitterSeed)
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => jitter())
  for (const draw of draws) drawBefore(before.context, draw.sprite, draw.x, draw.y, draw.effect, draw.argument)

  const after = createFakeCanvas(width, height, rounding)
  after.fill((index) => pixels[index])
  jitter = seeded(jitterSeed)
  drawRgbasWithEffect(after.context, draws)
  spy.mockRestore()
  return { before, after }
}

afterEach(() => vi.restoreAllMocks())

/** 경우마다 굴리는 시드 수 — 12경우 × 100 = 1200판 (r360 에 400 → 100: 판마다 효과 1~14개 · 8갈래라 100판이면 갈래가 다 나온다) */
const SEEDS_PER_CASE = 100

describe('drawRgbasWithEffect — 하나씩 그린 것과 바이트 단위로 같다', () => {
  const cases: [Backdrop, Rounding, boolean][] = []
  for (const backdrop of ['opaque', 'clear', 'mixed'] as const) {
    for (const rounding of ['round', 'floor'] as const) for (const clustered of [true, false]) cases.push([backdrop, rounding, clustered])
  }
  it.each(cases)(`화면 %s · 왕복 %s · 모임 %s — 시드 ${SEEDS_PER_CASE}개`, (backdrop, rounding, clustered) => {
    for (let seed = 1; seed <= SEEDS_PER_CASE; seed += 1) {
      const { before, after } = runBoth(seed * 7919 + (clustered ? 1 : 0), backdrop, rounding, clustered)
      // 실패하면 시드를 알 수 있게 바이트를 그대로 비교한다
      expect({ seed, bytes: Array.from(after.stored) }).toEqual({ seed, bytes: Array.from(before.stored) })
    }
  })

  it('불투명 화면의 효과 입자 여럿은 한 번 읽고 한 번 놓는다', () => {
    const random = seeded(5)
    const canvas = createFakeCanvas(40, 30, 'round')
    canvas.fill(() => backdropPixel('opaque', random))
    const draws = Array.from({ length: 10 }, (_, index) => ({
      sprite: randomSprite(random),
      x: 5 + index,
      y: 5 + (index % 3),
      effect: DRAW_EFFECT.ADDITIVE,
      argument: 100,
    }))
    drawRgbasWithEffect(canvas.context, draws)
    expect(canvas.counts()).toEqual({ reads: 1, writes: 1 })
  })

  it('하나만 그리면 drawRgbaWithEffect 와 같다', () => {
    for (let seed = 1; seed <= SEEDS_PER_CASE; seed += 1) {
      const random = seeded(seed)
      const pixels = Array.from({ length: 20 * 20 }, () => backdropPixel('mixed', random))
      const [draw] = randomDraws(random, 20, 20, true)
      const one = createFakeCanvas(20, 20, 'round')
      const many = createFakeCanvas(20, 20, 'round')
      one.fill((index) => pixels[index])
      many.fill((index) => pixels[index])
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      drawRgbaWithEffect(one.context, draw)
      drawRgbasWithEffect(many.context, [draw])
      expect(Array.from(many.stored)).toEqual(Array.from(one.stored))
    }
  })
})

describe('createReadCache — 그림 픽셀 캐시', () => {
  it('서명이 같으면 한 번만 읽는다', () => {
    const read = vi.fn((key: { name: string }) => `${key.name}!`)
    const cached = createReadCache(read, (key) => key.name)
    const key = { name: 'a' }
    expect(cached(key)).toBe('a!')
    expect(cached(key)).toBe('a!')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('서명이 바뀌면(그림이 다시 받혔다) 다시 읽는다', () => {
    const read = vi.fn((key: { name: string }) => `${key.name}!`)
    const cached = createReadCache(read, (key) => key.name)
    const key = { name: 'a' }
    cached(key)
    key.name = 'b'
    expect(cached(key)).toBe('b!')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('서명이 null 이면(받는 중 · 바뀔 수 있는 캔버스) 매번 읽는다', () => {
    const read = vi.fn(() => 'x')
    const cached = createReadCache<object, string>(read, () => null)
    const key = {}
    cached(key)
    cached(key)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('못 읽으면(null) 남기지 않는다', () => {
    let ready = false
    const read = vi.fn(() => (ready ? 'ok' : null))
    const cached = createReadCache<object, string>(read, () => 'same')
    const key = {}
    expect(cached(key)).toBeNull()
    ready = true
    expect(cached(key)).toBe('ok')
    expect(cached(key)).toBe('ok')
    expect(read).toHaveBeenCalledTimes(2)
  })
})
