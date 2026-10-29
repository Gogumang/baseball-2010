import { PANEL, STRIP_OPACITY, TRAINNING_FOLDER, TRAINNING_FRAMES } from './hudPanel'
import type { HudSprite } from './hudPanel'
import { COUNTER_GAP, digitsOf, numSrcOf } from './hudCounter'

/** 시계 띠 (5, h + 7) · 시계 그림 이미지 16 (0xd, h + 10) */
export const TIMER_STRIP: HudSprite = { src: `${TRAINNING_FRAMES}/013.png`, left: 5, top: PANEL.height + 7, opacity: STRIP_OPACITY }
export const TIMER_ICON: HudSprite = { src: `${TRAINNING_FOLDER}/016.png`, left: 0xd, top: PANEL.height + 10 }

/** 0x1400748 색 — 꺼진 칸 RGB(0x29, 0x56, 0xa2) · 켜진 숫자 · 쌍점 RGB(0x80, 0xe6, 0xff) */
export const TIMER_COLORS = { unlit: '#2956a2', lit: '#80e6ff' } as const

export interface TimerGlyph {
  /** num 이미지 (0x3c + 숫자) — 효과 0xb(단색)로 `color` 를 찍는다 */
  readonly src: string
  readonly left: number
  readonly top: number
  readonly color: string
}

export interface TimerDots {
  readonly left: number
  readonly top: number
  readonly size: number
  readonly color: string
}

/** num 0x3c~0x45 — 모두 7×12 */
const TIMER_DIGIT_WIDTH = 7
const TIMER_BASE = 0x3c

/**
 * 0x585ad(…, 기준 0x3c, 값, x, y, 간격 1, 자리 2, 정렬, 효과 0xb, 색) — 자리 채우기 2.
 * 정렬 4: x = 오른끝 − 폭(셋째 글자부터 간격) 에서 모자란 자리마다 (0 폭 + 간격) 만큼 더 왼쪽으로 가 '0' 을 먼저 찍는다(0x58670~).
 * 정렬 1: x 그대로, 모자란 자리의 '0' 을 먼저 찍는다.
 */
function timerRunOf(value: number, x: number, y: number, align: 1 | 4, color: string): TimerGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((total, _digit, index) => total + TIMER_DIGIT_WIDTH + (index > 1 ? COUNTER_GAP : 0), 0)
  let left = align === 1 ? x : x - measured
  const padCount = Math.max(0, 2 - digits.length)
  if (align === 4) left -= padCount * (TIMER_DIGIT_WIDTH + COUNTER_GAP)
  const all = [...Array<number>(padCount).fill(0), ...digits]
  return all.map((digit) => {
    const placed = { src: numSrcOf(TIMER_BASE + digit), left, top: y, color }
    left += TIMER_DIGIT_WIDTH + COUNTER_GAP
    return placed
  })
}

/**
 * **시계 0x361e4(장면, 남은 초, X = 5, Y = 58)** — 분 · 초를 꺼진 칸 "88" 위에 켜진 색으로 겹쳐 찍는다.
 * ```
 * 36228  0x585ad(…, 0x3c, 88, X + 0x33, Y + 3, 1, 2, 정렬 4, 0xb, RGB(0x29,0x56,0xa2))   ; 분 자리 꺼진 칸
 * 36270  0x585ad(…, 0x3c, 초 / 60, X + 0x33, Y + 3, 1, 2, 정렬 4, 0xb, RGB(0x80,0xe6,0xff))
 * 362a2  0x585ad(…, 0x3c, 88, X + 0x3b, Y + 3, 1, 2, 정렬 1, 0xb, 꺼진 색)              ; 초 자리
 * 362dc  0x585ad(…, 0x3c, 초 % 60, X + 0x3b, Y + 3, 1, 2, 정렬 1, 0xb, 켜진 색)
 * 36308  0x6a9f1(X + 0x36, Y + 5, 2, 2, 켜진 색) · 0x6a9f1(X + 0x36, Y + 0xb, 2, 2, 켜진 색)  ; 쌍점
 * ```
 * 분 자리는 셋째 글자부터만 간격을 세는 0x585ad 때문에 한 자리 값("0" 채움)이 "88" 보다 1px 왼쪽에 놓인다 — 원본 그대로.
 */
export function timerGlyphsOf(seconds: number): { readonly glyphs: TimerGlyph[]; readonly dots: TimerDots[] } {
  const x = TIMER_STRIP.left
  const y = TIMER_STRIP.top
  const whole = Math.max(0, Math.trunc(seconds))
  return {
    glyphs: [
      ...timerRunOf(88, x + 0x33, y + 3, 4, TIMER_COLORS.unlit),
      ...timerRunOf(Math.trunc(whole / 60), x + 0x33, y + 3, 4, TIMER_COLORS.lit),
      ...timerRunOf(88, x + 0x3b, y + 3, 1, TIMER_COLORS.unlit),
      ...timerRunOf(whole % 60, x + 0x3b, y + 3, 1, TIMER_COLORS.lit),
    ],
    dots: [
      { left: x + 0x36, top: y + 5, size: 2, color: TIMER_COLORS.lit },
      { left: x + 0x36, top: y + 0xb, size: 2, color: TIMER_COLORS.lit },
    ],
  }
}
