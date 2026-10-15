import { describe, expect, it } from 'vitest'
import {
  DRAW_EFFECT,
  TRANSLUCENT_MASKS,
  TRANSLUCENT_SHIFTS,
  addColorPixel565,
  additivePixel565,
  blendPixel565,
  brightenPixel565,
  composeRgba,
  effectPixel565,
  grayPixel565,
  grayRect565,
  halfMixPixel565,
  nextOriginalRandom,
  recolorRgba,
  solidColorCss,
  solidPixel565,
  translucentOpacityOf,
  translucentPixel565,
} from '@/shared/lib/pixelEffect/pixelEffect'

const WHITE = 0xffff
const RED = 0xf800

describe('효과 1 반투명 — 표 0xd5e58 · 0xd5de0', () => {
  it('단계 L 의 줄은 화면 무게 (16 − L)/16 · 그림 무게 L/16 이다', () => {
    for (let level = 1; level <= 15; level += 1) {
      const weightOf = (from: number) =>
        [0, 1, 2, 3].reduce((sum, i) => sum + (TRANSLUCENT_MASKS[level - 1][from + i] === 0 ? 0 : 16 >> TRANSLUCENT_SHIFTS[level - 1][from + i]), 0)
      expect(weightOf(0)).toBe(16 - level)
      expect(weightOf(4)).toBe(level)
    }
  })

  it('단계 8 은 반반 (아래 비트를 떼고 내림)', () => {
    expect(translucentPixel565(8, WHITE, 0)).toBe(0x7bef)
    expect(translucentPixel565(8, 0, WHITE)).toBe(0x7bef)
  })

  it('마스크마다 내림이 겹쳐 흰 그림 · 검정 화면도 흰색 L/16 보다 조금 어둡다', () => {
    // 단계 15: 그림 ½ + ¼ + ⅛ + 1/16 — R5 31 → 15 + 7 + 3 + 1 = 26
    expect(translucentPixel565(15, WHITE, 0) >> 11).toBe(26)
  })

  it('단계 0 · 16 이상은 안 그린다 (0x9a456)', () => {
    expect(translucentPixel565(0, WHITE, RED)).toBe(RED)
    expect(translucentPixel565(16, WHITE, RED)).toBe(RED)
    expect(translucentOpacityOf(7)).toBe(7 / 16)
    expect(translucentOpacityOf(0)).toBe(0)
  })
})

describe('효과 2 더하기 — 0x9a2f1', () => {
  it('255 는 채널끼리 더해 자른다', () => {
    expect(additivePixel565(255, 0x8410, 0x8410)).toBe(0xffff)
    expect(additivePixel565(255, 0x0841, 0x0841)).toBe(0x1082)
  })

  it('그 밖은 화면 + (그림 · b) >> 8', () => {
    // 그림 R5 31 · b 230 → 31·230 >> 8 = 27
    expect(additivePixel565(230, RED, 0) >> 11).toBe(27)
    expect(additivePixel565(230, RED, 0x2000) >> 11).toBe(31)
  })

  it('0 · 256 이상은 안 그린다', () => {
    expect(additivePixel565(0, WHITE, 0x1234)).toBe(0x1234)
    expect(additivePixel565(256, WHITE, 0x1234)).toBe(0x1234)
  })
})

describe('효과 0xa · 0xb · 0xc · 0xd', () => {
  it('0xa 회색 — s = R5 + G 위 5비트 + B5 + 3, g = s/4 + s/16 + s/64', () => {
    // 흰색: s = 96 → 24 + 6 + 1 = 31
    expect(grayPixel565(WHITE)).toBe((31 << 11) | (31 << 6) | 31)
    // 빨강: s = 34 → 8 + 2 + 0 = 10
    expect(grayPixel565(RED)).toBe((10 << 11) | (10 << 6) | 10)
    // 검정도 + 3 때문에 0 이다: s = 3 → 0
    expect(grayPixel565(0)).toBe(0)
  })

  it('0xb 단색 — 인자 색의 아래 16비트', () => {
    expect(solidPixel565(0x18410)).toBe(0x8410)
    expect(solidColorCss('#808080')).toBe('rgb(132, 130, 132)')
    expect(solidColorCss('#ffffff')).toBe('rgb(255, 255, 255)')
    expect(solidColorCss('rgb(178, 178, 178)')).toBe('rgb(181, 178, 181)')
  })

  it('0xc 반반 — 레이저 반짝임 빨강', () => {
    expect(halfMixPixel565(WHITE, RED)).toBe((30 << 11) | (31 << 5) | 15)
    expect(halfMixPixel565(0, RED)).toBe(15 << 11)
  })

  it('0xd 색 더하기 — 채널마다 끝에서 자른다, 인자 0 이면 안 그린다', () => {
    // R5 16 + 16 → 31 · G6 32 + 32 → 63 · B5 16 + 16 → 31
    expect(addColorPixel565(0x8410, 0x8410)).toBe(0xffff)
    expect(addColorPixel565(0x0841, 0x0841)).toBe(0x1082)
    expect(effectPixel565(DRAW_EFFECT.ADD_COLOR, 0, WHITE, 0x1234)).toBe(0x1234)
  })
})

describe('0xbb91d 종류 비트', () => {
  it('8 밝게 — 비트 복제 없이 펴서 +b, 255 에서 자름', () => {
    // R5 1 → R8 8 + 200 = 208 → 26
    expect(brightenPixel565(0x0800, 200) >> 11).toBe(26)
    expect(brightenPixel565(WHITE, 200)).toBe(WHITE)
  })

  it('0x10 섞기 — 그림·(32 − b)/32 + 화면·b/32', () => {
    expect(blendPixel565(WHITE, 0, 16)).toBe(0x7bef)
    expect(blendPixel565(WHITE, 0, 0)).toBe(WHITE)
    expect(blendPixel565(RED, 0x001f, 32)).toBe(0x001f)
  })
})

describe('0xc37a8 화면 흑백', () => {
  it('사각형만 바꾼다', () => {
    const pixels = new Uint16Array([RED, RED, RED, RED])
    grayRect565(pixels, 2, 1, 0, 1, 2)
    expect([...pixels]).toEqual([RED, grayPixel565(RED), RED, grayPixel565(RED)])
  })
})

describe('RGBA', () => {
  it('recolorRgba 는 투명 칸을 그대로 두고 565 로 계산해 비트 복제로 편다', () => {
    const out = recolorRgba([255, 255, 255, 255, 9, 9, 9, 0], DRAW_EFFECT.HALF_MIX, RED)
    expect([...out]).toEqual([247, 125, 123, 255, 9, 9, 9, 0])
  })

  it('composeRgba — 효과 1 은 불투명 화면 칸에서 원본 식 그대로', () => {
    const screen = { data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]), width: 2, height: 1 }
    const sprite = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]), width: 2, height: 1 }
    composeRgba(screen, sprite, 0, 0, DRAW_EFFECT.TRANSLUCENT, 8)
    expect([...screen.data]).toEqual([123, 125, 123, 255, 0, 0, 0, 255])
  })

  it('composeRgba — 효과 4 는 줄마다 r 을 뽑아 화면[x + r] 을 옮긴다', () => {
    const screen = { data: new Uint8ClampedArray([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255]), width: 3, height: 1 }
    const sprite = { data: new Uint8ClampedArray([1, 1, 1, 255, 1, 1, 1, 255]), width: 2, height: 1 }
    composeRgba(screen, sprite, 0, 0, DRAW_EFFECT.JITTER, 3, () => 1)
    expect([screen.data[0], screen.data[4], screen.data[8]]).toEqual([20, 30, 30])
  })

  it('원본 난수 0x9d469', () => {
    const first = nextOriginalRandom(0, 0x8000)
    expect(first.value).toBe(((0x269ec3 << 1) >>> 17) % 0x8000)
    expect(nextOriginalRandom(5, 0)).toEqual({ seed: 5, value: 0 })
  })
})
