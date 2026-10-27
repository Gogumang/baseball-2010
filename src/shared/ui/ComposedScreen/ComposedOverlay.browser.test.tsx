import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ComposedOverlay } from '@/shared/ui/ComposedScreen/ComposedOverlay'
import { DRAW_EFFECT, translucentPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'

/**
 * **브라우저 시험 — 겹 하나 합성 캔버스가 원본 식 그대로 찍히는가** (Q-03 r301).
 *
 * jsdom 에는 캔버스가 없어 `ComposedOverlay` 가 늘 CSS 근사로 선다. 여기서는 chromium · webkit 아이폰의 진짜 캔버스로
 * 아래 그림(뒤집기 포함) 위에 효과 1 · 12 그림을 섞어, 찍힌 픽셀이 `translucentPixel565`(0x9a449 마스크 내림 · 565)와 같은지,
 * 위 그림이 안 칠한 칸은 비어(알파 0) DOM 아래가 보이는지 본다 — 웹킷의 곱한 알파 저장이 색을 흔들지 않는지도 여기서 잡는다.
 */

afterEach(cleanup)

/** 565 색 줄 하나를 PNG 주소로 (null 은 투명 칸) */
function pngOf(row: readonly (number | null)[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = row.length
  canvas.height = 1
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  const image = context.createImageData(row.length, 1)
  row.forEach((pixel, index) => {
    if (pixel === null) return
    const [r, g, b] = rgbOf565(pixel)
    image.data.set([r, g, b, 255], index * 4)
  })
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

describe('ComposedOverlay — 캔버스 합성', () => {
  it('아래(뒤집은 그림) 위 효과 1 · 12 를 원본 식으로, 안 칠한 칸은 비운다', async () => {
    const under = [rgbTo565(255, 0, 0), rgbTo565(0, 255, 0), rgbTo565(0, 0, 255), rgbTo565(200, 160, 40)]
    const top = [rgbTo565(255, 255, 255), null, rgbTo565(16, 64, 128)]
    const underSrc = pngOf(under)
    const topSrc = pngOf(top)
    render(
      <ComposedOverlay testId="합성" rect={{ x: 10, y: 5, width: 4, height: 1 }}
        underOps={[{ kind: 'image', src: underSrc, x: 10, y: 5, flipX: true }]}
        ops={[{ kind: 'image', src: topSrc, x: 11, y: 5, effect: DRAW_EFFECT.TRANSLUCENT, argument: 12 }]}
        fallback={<span data-testid="근사" />} />,
    )
    const canvas = screen.getByTestId('합성') as HTMLCanvasElement
    await waitFor(() => expect(canvas.dataset.composed).toBe('true'), { timeout: 3000 })
    expect(screen.queryByTestId('근사')).toBeNull()
    const data = Array.from((canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 4, 1).data)
    // 뒤집은 아래: 칸 0 = 열 3 · 칸 1 = 열 2 · 칸 2 = 열 1 · 칸 3 = 열 0. 위 그림은 칸 1 · 3 만 칠한다(가운데는 투명)
    const mixed = (source: number, screenPixel: number) => [...rgbOf565(translucentPixel565(12, source, screenPixel)), 255]
    expect(data.slice(0, 4)[3]).toBe(0)
    expect(data.slice(4, 8)).toEqual(mixed(top[0] as number, under[2]))
    expect(data.slice(8, 12)[3]).toBe(0)
    expect(data.slice(12, 16)).toEqual(mixed(top[2] as number, under[0]))
  })

  it('그림을 못 받으면 근사로 둔다', async () => {
    render(
      <ComposedOverlay testId="합성" rect={{ x: 0, y: 0, width: 1, height: 1 }} underOps={[]}
        ops={[{ kind: 'image', src: '/없는-그림.png', x: 0, y: 0 }]} fallback={<span data-testid="근사" />} />,
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(screen.getByTestId('근사')).toBeTruthy()
    expect((screen.getByTestId('합성') as HTMLCanvasElement).dataset.composed).toBe('false')
  })
})
