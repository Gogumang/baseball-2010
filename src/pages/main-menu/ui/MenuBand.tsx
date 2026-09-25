import { useEffect, useRef } from 'react'
import {
  MENU_BAND_COLOR, MENU_BAND_LEFT, MENU_BAND_RIGHT, SCREEN_HEIGHT, SCREEN_WIDTH, menuBandLinesOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

/**
 * 아랫단 바탕 띠 — 알파가 있는 1px 가로선 묶음이라 캔버스로 긋는다 (원본 0x6a905 도 선 그리기다).
 *
 * 원본 순서 그대로 **바퀴 판 위·릴 글자 아래**에 깔린다: 0x2857c 계열이 `0x24b1c`(바퀴) →
 * `0x2524c`(릴) 을 잇달아 부르고, 0x2524c 안에서 띠가 줄보다 먼저 그려진다.
 * 좌표·색·알파 식은 `lib/mainMenuLayout.ts` 의 `MENU_BAND_*` 주석 참고.
 */
export function MenuBand({ spread }: { readonly spread: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const context = canvas.getContext('2d')
    if (context === null) return

    context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    const { r, g, b } = MENU_BAND_COLOR
    const width = MENU_BAND_RIGHT - MENU_BAND_LEFT
    for (const line of menuBandLinesOf(spread)) {
      // 원본은 알파 바이트를 그대로 쓴다 (0xff 면 안 섞고 그대로 찍는다) — 그래서 /255 다
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${line.alpha / 255})`
      context.fillRect(MENU_BAND_LEFT, line.y, width, 1)
    }
  }, [spread])

  return (
    <canvas
      ref={canvasRef}
      className={styles.layer}
      style={{ left: 0, top: 0 }}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      aria-hidden="true"
    />
  )
}
