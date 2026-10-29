/** 판 채우기 사각형 — 둥근 판(0xba0bc) · 판 바탕 · 체력 막대 */
import { PITCHER_BOXES } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
import { CARD_COLORS } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'
import type { Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardPlacement'

export interface FillRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
  /** 0xba0bc 의 둥글기 (0 이면 0xb9f74 네모 칠 · 0x6a9f0 점) */
  readonly round: number
}

export const fill = (x: number, y: number, width: number, height: number, color: string, round = 0): FillRect => ({
  x,
  y,
  width,
  height,
  color,
  round,
})

export interface PlainRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 기기 선 긋기(0x14006c8) 한 줄 — 두 끝을 다 칠한다. 끝이 거꾸로면 작은 쪽부터 */
const lineRect = (x1: number, y1: number, x2: number, y2: number): PlainRect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  width: Math.abs(x2 - x1) + 1,
  height: Math.abs(y2 - y1) + 1,
})

/**
 * **둥근 칠 `0x6b7d4(gfx, x, y, w, h, 둥글기, 색)`** (직접 떴다, 0x6b7d4~0x6ba0a) — 둥글기는 7 로 자르고(6b7e4), 실제 모양은
 * 둘뿐이다. 칠 0x14006e8 = 기기 사각 칠(x, y, w, h) · 선 0x14006c8 = 기기 선(x1, y1, x2, y2). R = x + w · B = y + h.
 * ```
 * 둥글기 ≤ 3 (6b812):  칠(x+1, y+1, w−1, h−1) · 선(x+1, y, R−1, y) · 선(x+1, B, R−1, B) · 선(x, y+1, x, B−1) · 선(R, y+1, R, B−1)
 * 둥글기 4~7 (6b8c0):  칠(x+1, y+1, w−1, h−1) · 선(x+2, y, R−2, y) · 선(x+2, B, R−2, B) · 선(x, y+2, x, B−2) · 선(R, y+2, R, B−2)
 * ```
 * 그래서 둥근 칠은 **(w+1) × (h+1)** 칸을 덮고 모서리를 1칸(≤3) 또는 3칸(4~7, ㄱ자) 비운다 — 네모 칠 0xb9f74(→ 0x6a9f0 →
 * 같은 기기 사각 칠)은 w × h 다. (둥글기 > 7 갈래 6b952 는 자르기 때문에 안 탄다.) 폭이 음수인 칠은 아무것도 안 칠한다.
 */
export function roundFillRectsOf(rect: Pick<FillRect, 'x' | 'y' | 'width' | 'height' | 'round'>): PlainRect[] {
  const { x, y, width: w, height: h } = rect
  const right = x + w
  const bottom = y + h
  const inset = Math.min(7, rect.round) <= 3 ? 1 : 2
  const body: PlainRect[] = w - 1 > 0 && h - 1 > 0 ? [{ x: x + 1, y: y + 1, width: w - 1, height: h - 1 }] : []
  return [
    ...body,
    lineRect(x + inset, y, right - inset, y),
    lineRect(x + inset, bottom, right - inset, bottom),
    lineRect(x, y + inset, x, bottom - inset),
    lineRect(right, y + inset, right, bottom - inset),
  ]
}

/** 판 바탕 — 박스 0 둥글기 5 검정 · (+1, +1, −2, −2) 둥글기 5 #335FCD (0x44a96 · 0x44ae0 / 0x4516e · 0x451b2) */
export function cardBackgroundOf(origin: Placed): FillRect[] {
  const base = PITCHER_BOXES[0]
  return [
    fill(origin.x + base.x, origin.y + base.y, base.width, base.height, CARD_COLORS.border, 5),
    fill(origin.x + base.x + 1, origin.y + base.y + 1, base.width - 2, base.height - 2, CARD_COLORS.fill, 5),
  ]
}

/**
 * 체력 막대의 셈 값 (0x44ea0~0x44f04).
 * - `lengthValue` = `0x66e44(0xb8680(팀), 투수, f)` — 실효 체력 0xb6414(투수, 3, 1) 를 컨디션([+2], 없으면 100)으로
 *   >90 +1/20 · 51~70 −1/10 · 31~50 −1/5 · 11~30 −30/100 · ≤10 −1/2 고친 뒤 + (f ? 200 : 0) + 250. 투수가 없으면 0.
 * - `maxValue` = f ? 0x5a9(1449) : 0x4e1(1249) — f = `팀[+0x26] − 팀[+0x33] == 1` (팀 = [장면+0x224]).
 * - `percent` = `0xaebb0(팀)` (남은 체력 %, 홈런더비는 늘 100 — P1).
 */
export interface StaminaGauge {
  readonly lengthValue: number
  readonly maxValue: number
  readonly percent: number
}

/**
 * 체력 막대 — 박스 9 (0x44f02~0x450a6, 직접 떴다).
 * ```
 * 길이 L = lengthValue × 박스폭 / maxValue
 * (x, y − 1, L, 14)        둥글기 1 #081C5A
 * (x + 1, y, L − 2, 12)    둥글기 1 #29349C
 * (x + 2, y + 1, L − 4, 6) #184DCE
 * 붉은 막대 R = ((percent × lengthValue / 100) × (박스폭 × 10 − 10) / maxValue) 를 s16 으로 / 10 − 2
 * (x + 2, y + 1, R, 1) #F32C00 · (…, y + 2, R, 5) #FF4D00 · (…, y + 7, R, 5) #F32C00 · (…, y + 12, R, 1) #CD1100
 * ```
 */
export function staminaGaugeRectsOf(gauge: StaminaGauge, origin: Placed): FillRect[] {
  const gaugeBox = PITCHER_BOXES[9]
  const x = origin.x + gaugeBox.x
  const y = origin.y + gaugeBox.y
  const length = Math.trunc((gauge.lengthValue * gaugeBox.width) / gauge.maxValue)
  const scaled = Math.trunc((gauge.percent * gauge.lengthValue) / 100)
  const raw = Math.trunc((scaled * (gaugeBox.width * 10 - 10)) / gauge.maxValue)
  // 0x44ffa `lsls #0x10 · asrs #0x10` — s16 로 자른 뒤 나눈다
  const red = Math.trunc(((raw << 16) >> 16) / 10) - 2
  return [
    fill(x, y - 1, length, 14, '#081C5A', 1),
    fill(x + 1, y, length - 2, 12, '#29349C', 1),
    fill(x + 2, y + 1, length - 4, 6, '#184DCE'),
    fill(x + 2, y + 1, red, 1, '#F32C00'),
    fill(x + 2, y + 2, red, 5, '#FF4D00'),
    fill(x + 2, y + 7, red, 5, '#F32C00'),
    fill(x + 2, y + 12, red, 1, '#CD1100'),
  ]
}
