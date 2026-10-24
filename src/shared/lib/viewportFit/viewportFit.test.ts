import { describe, expect, it } from 'vitest'
import {
  CONTROLS_MIN_HEIGHT, CONTROLS_MIN_SIDE_WIDTH, desktopZoomOf, fittedZoomOf, touchControlsWantedOf, viewportFitOf,
} from '@/shared/lib/viewportFit/viewportFit'

describe('fittedZoomOf — 240×320 을 칸에 꽉 차게', () => {
  it('정수배가 최대 배율의 90% 이상이면 정수배', () => {
    expect(fittedZoomOf(480, 640)).toBe(2)
    expect(fittedZoomOf(500, 660)).toBe(2)
    expect(fittedZoomOf(240, 330)).toBe(1)
  })

  it('아니면 1/80 단위로 내린 최대 배율 — 확대한 폭·높이가 정수 px', () => {
    const zoom = fittedZoomOf(390, 600)
    expect(zoom).toBe(1.625)
    expect(Number.isInteger(240 * zoom)).toBe(true)
    expect(Number.isInteger(320 * zoom)).toBe(true)
    const odd = fittedZoomOf(361, 999)
    expect(odd).toBeLessThanOrEqual(361 / 240)
    expect(Number.isInteger(240 * odd) && Number.isInteger(320 * odd)).toBe(true)
  })

  it('칸을 넘지 않는다', () => {
    for (const [w, h] of [[360, 428], [412, 700], [844, 369], [1000, 300]] as const) {
      const zoom = fittedZoomOf(w, h)
      expect(240 * zoom).toBeLessThanOrEqual(w)
      expect(320 * zoom).toBeLessThanOrEqual(h)
    }
  })

  it('아주 작은 칸에서는 0.5 아래로 줄이지 않는다', () => {
    expect(fittedZoomOf(10, 10)).toBe(0.5)
  })
})

describe('desktopZoomOf — 예전 미디어 쿼리 그대로', () => {
  it('480×800 은 1배, 500×660 은 2배, 740×980 은 3배', () => {
    expect(desktopZoomOf(480, 800)).toBe(1)
    expect(desktopZoomOf(500, 660)).toBe(2)
    expect(desktopZoomOf(1280, 800)).toBe(2)
    expect(desktopZoomOf(740, 980)).toBe(3)
  })
})

describe('viewportFitOf — 배치', () => {
  it('데스크톱(마우스 · 키패드 없음)은 예전 정수배 · 화면 칸은 창 전체', () => {
    expect(viewportFitOf({ width: 480, height: 800, isTouch: false, showControls: false }))
      .toEqual({ layout: 'plain', zoom: 1, gameWidth: 480, gameHeight: 800 })
  })

  it('세로 폰은 버튼 아래 — 판 폭을 꽉 채우고 남은 높이는 버튼', () => {
    // iPhone 14 세로 (safe-area 47·34 를 뺀 390×763)
    const fit = viewportFitOf({ width: 390, height: 763, isTouch: true, showControls: true })
    expect(fit.layout).toBe('below')
    expect(fit.zoom).toBe(1.625)
    expect(fit.gameHeight).toBe(520)
    expect(763 - fit.gameHeight).toBeGreaterThanOrEqual(CONTROLS_MIN_HEIGHT)
  })

  it('작은 안드로이드 360×640 도 화면은 폭 가득(1.5배) · 버튼 자리를 남긴다', () => {
    const fit = viewportFitOf({ width: 360, height: 640, isTouch: true, showControls: true })
    expect(fit.layout).toBe('below')
    expect(fit.zoom).toBe(1.5)
    expect(640 - fit.gameHeight).toBeGreaterThanOrEqual(CONTROLS_MIN_HEIGHT)
  })

  it('세로 폰은 숫자 키패드 없이 화면이 폭을 꽉 채운다 — iPhone SE 375×647 도', () => {
    const fit = viewportFitOf({ width: 375, height: 647, isTouch: true, showControls: true })
    expect(fit.layout).toBe('below')
    expect(240 * fit.zoom).toBeGreaterThanOrEqual(360)
    expect(647 - fit.gameHeight).toBeGreaterThanOrEqual(CONTROLS_MIN_HEIGHT)
  })

  it('가로 폰은 버튼이 양옆 — 판 높이를 꽉 채운다', () => {
    const fit = viewportFitOf({ width: 750, height: 369, isTouch: true, showControls: true })
    expect(fit.layout).toBe('sides')
    expect(320 * fit.zoom).toBeLessThanOrEqual(369)
    expect(fit.gameWidth).toBe(240 * fit.zoom)
    expect((750 - fit.gameWidth) / 2).toBeGreaterThanOrEqual(CONTROLS_MIN_SIDE_WIDTH)
  })

  it('터치 기기에서 버튼을 끄면 화면만 꽉 차게', () => {
    expect(viewportFitOf({ width: 390, height: 763, isTouch: true, showControls: false }).zoom).toBe(1.625)
  })
})

describe('touchControlsWantedOf', () => {
  it('터치 기기면 보이고, ?keypad=1 · 0 으로 강제한다', () => {
    expect(touchControlsWantedOf('', true)).toBe(true)
    expect(touchControlsWantedOf('', false)).toBe(false)
    expect(touchControlsWantedOf('?keypad=1', false)).toBe(true)
    expect(touchControlsWantedOf('?keypad=0', true)).toBe(false)
  })
})
