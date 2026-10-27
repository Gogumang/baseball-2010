import { describe, expect, it } from 'vitest'
import { DRAW_EFFECT, translucentPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import {
  composeOverlay565, composeScreen565, frameComposeOps, rgbaOfScreen565, sprite565Of, type Sprite565,
} from '@/shared/lib/pixelEffect/screenCompose'
import { blackStepCoverPixel565 } from '@/shared/lib/stepCover/stepCover'
import { rgbOf565 } from '@/shared/lib/screen565/screen565'

const rgbaOf = (pixels: readonly (number | null)[]) =>
  pixels.flatMap((pixel) => (pixel === null ? [0, 0, 0, 0] : [...rgbOf565(pixel), 255]))

describe('화면 버퍼 합성 (RGB565)', () => {
  const sprite: Sprite565 = sprite565Of(rgbaOf([0xf800, null, 0x07e0, 0x001f]), 2, 2)

  it('웹 PNG(565 비트 복제) → 565 그림 — 알파 0 은 투명 칸', () => {
    expect(Array.from(sprite.pixels)).toEqual([0xf800, 0, 0x07e0, 0x001f])
    expect(Array.from(sprite.opaque)).toEqual([1, 0, 1, 1])
  })

  it('효과 1 반투명은 그 자리 화면 픽셀과 0x9a449 식으로 섞는다 — 투명 칸 · 화면 밖은 그대로', () => {
    const backdrop = 0x8410
    const { pixels, missing } = composeScreen565(3, 2, backdrop, [
      { kind: 'image', src: 'a', x: 1, y: 0, effect: DRAW_EFFECT.TRANSLUCENT, argument: 7 },
    ], () => sprite)
    expect(missing).toBe(false)
    expect(Array.from(pixels)).toEqual([
      backdrop, translucentPixel565(7, 0xf800, backdrop), backdrop,
      backdrop, translucentPixel565(7, 0x07e0, backdrop), translucentPixel565(7, 0x001f, backdrop),
    ])
  })

  it('단계 덮기는 화면 안으로 자른 사각형만 — 검정 몸통 0x9aac4', () => {
    const { pixels } = composeScreen565(2, 2, 0xffff, [
      { kind: 'cover', x: 1, y: -3, width: 9, height: 4, step: 9, color: null },
    ], () => null)
    expect(Array.from(pixels)).toEqual([0xffff, blackStepCoverPixel565(9, 0xffff), 0xffff, 0xffff])
  })

  it('아직 못 읽은 그림은 건너뛰고 missing 을 알린다', () => {
    const { pixels, missing } = composeScreen565(1, 1, 0x1234, [{ kind: 'image', src: 'b', x: 0, y: 0 }], () => null)
    expect(missing).toBe(true)
    expect(pixels[0]).toBe(0x1234)
  })

  it('프레임 그리기는 원점을 더한 자리 — 원점을 못 읽었으면 빈 목록', () => {
    const origins = { '007': { x: -3, y: 5, width: 2, height: 2 } }
    expect(frameComposeOps('f', 7, origins, 10, 20, DRAW_EFFECT.TRANSLUCENT, 7)).toEqual([
      { kind: 'image', src: 'f/007.png', x: 7, y: 25, effect: DRAW_EFFECT.TRANSLUCENT, argument: 7 },
    ])
    expect(frameComposeOps('f', 8, origins, 0, 0)).toEqual([])
    expect(frameComposeOps('f', 7, null, 0, 0)).toEqual([])
  })

  it('565 화면 → 불투명 RGBA (비트 복제)', () => {
    expect(Array.from(rgbaOfScreen565(new Uint16Array([0xffff, 0x0841])))).toEqual([255, 255, 255, 255, 8, 8, 8, 255])
  })

  it('겹 하나 합성 (Q-03 r301) — 화면 좌표 사각형 안에 아래 그리기(뒤집기 포함)를 깔고 위 그리기만 칠한 칸으로 표시한다', () => {
    const under: Sprite565 = sprite565Of(rgbaOf([0x1111, 0x2222, 0x3333, 0x4444]), 4, 1)
    const top: Sprite565 = sprite565Of(rgbaOf([0xffff, null]), 2, 1)
    const spriteOf = (src: string) => (src === 'under' ? under : top)
    const drawn = composeOverlay565({ x: 10, y: 5, width: 3, height: 1 },
      [{ kind: 'image', src: 'under', x: 10, y: 5, flipX: true }],
      [{ kind: 'image', src: 'top', x: 11, y: 5, effect: DRAW_EFFECT.TRANSLUCENT, argument: 12 }], spriteOf)
    expect(drawn.missing).toBe(false)
    // 뒤집은 아래: 칸 0 = 그림 열 3 · 칸 1 = 열 2 · 칸 2 = 열 1
    expect(Array.from(drawn.pixels)).toEqual([0x4444, translucentPixel565(12, 0xffff, 0x3333), 0x2222])
    expect(Array.from(drawn.touched)).toEqual([0, 1, 0])
    // 안 칠한 칸은 비워 DOM 아래 겹이 보인다
    expect(Array.from(rgbaOfScreen565(drawn.pixels, undefined, drawn.touched)).filter((_, index) => index % 4 === 3)).toEqual([0, 255, 0])
  })

  it('겹 하나 합성 — 못 받은 그림이 있으면 missing', () => {
    expect(composeOverlay565({ x: 0, y: 0, width: 1, height: 1 }, [], [{ kind: 'image', src: 'x', x: 0, y: 0 }], () => null).missing).toBe(true)
  })
})
