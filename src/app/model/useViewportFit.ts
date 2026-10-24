import { useLayoutEffect, useState } from 'react'
import { keypadWantedOf, viewportFitOf } from '@/shared/lib/viewportFit/viewportFit'
import type { ViewportFit } from '@/shared/lib/viewportFit/viewportFit'

const COARSE_POINTER = '(pointer: coarse)'

const pixelsOf = (value: string) => {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}

/** `body` 안쪽(safe-area 여백을 뺀) 폭·높이 — `body` 는 창 전체에 고정돼 있다(전역 CSS) */
function availableSizeOf(body: HTMLElement): { width: number; height: number } {
  const style = getComputedStyle(body)
  return {
    width: body.clientWidth - pixelsOf(style.paddingLeft) - pixelsOf(style.paddingRight),
    height: body.clientHeight - pixelsOf(style.paddingTop) - pixelsOf(style.paddingBottom),
  }
}

/** 배치를 문서에 적는다 — 배율 `--zoom` · 화면 칸 높이 `--game-height` · 격자 칸 `--game-track` · `body[data-layout]` */
function applyFit(fit: ViewportFit): void {
  const root = document.documentElement
  root.style.setProperty('--zoom', String(fit.zoom))
  root.style.setProperty('--game-height', `${fit.gameHeight}px`)
  const track = fit.layout === 'sides' ? fit.gameWidth : fit.gameHeight
  root.style.setProperty('--game-track', `${track}px`)
  document.body.dataset.layout = fit.layout
}

/**
 * 창 크기 · 회전 · 주소창 높이 변화(visualViewport) · 터치 기기 여부가 바뀔 때마다 화면 배율과 배치를 다시 잡는다
 * (`shared/lib/viewportFit`). 첫 그림 전에 잡는다(layout effect).
 */
export function useViewportFit(): ViewportFit | null {
  const [fit, setFit] = useState<ViewportFit | null>(null)

  useLayoutEffect(() => {
    const coarse = window.matchMedia?.(COARSE_POINTER)
    let frame: number | null = null
    let last = ''

    const refit = () => {
      frame = null
      const isTouch = coarse?.matches ?? false
      const { width, height } = availableSizeOf(document.body)
      const next = viewportFitOf({ width, height, isTouch, showKeypad: keypadWantedOf(window.location.search, isTouch) })
      const signature = JSON.stringify(next)
      if (signature === last) return
      last = signature
      applyFit(next)
      setFit(next)
    }
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(refit)
    }

    refit()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    coarse?.addEventListener?.('change', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(document.body)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      coarse?.removeEventListener?.('change', schedule)
      observer?.disconnect()
    }
  }, [])

  return fit
}
