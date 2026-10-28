// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screenRectFrom, screenRectOf } from '@/shared/lib/viewportFit/zoomedRect'

describe('zoom 판 안 요소의 화면 좌표 사각형 (r242)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('웹킷은 zoom 을 뺀 사각형을 낸다 — 폭이 offsetWidth 와 같으면 zoom 곱을 곱한다 (아이폰 13 세로 · 배율 1.625)', () => {
    expect(screenRectFrom({ left: 0, top: 0, width: 240, height: 320 }, 240, 1.625)).toEqual({
      left: 0,
      top: 0,
      width: 390,
      height: 520,
    })
  })

  it('크로미움 128+ 은 이미 화면 좌표다 — 그대로 둔다', () => {
    expect(screenRectFrom({ left: 0, top: 0, width: 390, height: 520 }, 240, 1.625)).toEqual({
      left: 0,
      top: 0,
      width: 390,
      height: 520,
    })
  })

  it('배율 1 이거나 배치 폭을 모르면(jsdom 0) 그대로', () => {
    expect(screenRectFrom({ left: 5, top: 6, width: 240, height: 320 }, 240, 1)).toEqual({ left: 5, top: 6, width: 240, height: 320 })
    expect(screenRectFrom({ left: 5, top: 6, width: 240, height: 320 }, 0, 2)).toEqual({ left: 5, top: 6, width: 240, height: 320 })
  })

  it('조상 zoom 을 모두 곱한다', () => {
    const outer = document.createElement('div')
    const canvas = document.createElement('canvas')
    outer.append(canvas)
    document.body.append(outer)
    const real = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = real(element)
      return { ...style, zoom: element === outer ? '1.625' : '' } as CSSStyleDeclaration
    })
    Object.defineProperty(canvas, 'offsetWidth', { configurable: true, value: 240 })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 320 }) as DOMRect
    expect(screenRectOf(canvas).width).toBeCloseTo(390)
    outer.remove()
  })
})
