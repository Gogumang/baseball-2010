import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const NUM_FOLDER = assetUrl('./sprites/num')

export interface HudGlyph {
  readonly src: string
  readonly left: number
  readonly top: number
}

export const numSrcOf = (image: number) => `${NUM_FOLDER}/${String(image).padStart(3, '0')}.png`
export const digitsOf = (value: number) => [...String(Math.max(0, Math.trunc(value)))].map(Number)
/** num 이미지 0~9 · 0x50~0x59 — 모두 8×10 이고 "1" 만 4×10 */
const smallDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
/** "/" — 0x3608c 는 기준 0 이면 이미지 101(흰), 아니면 100(노랑). 둘 다 10×10 */
const SLASH_WIDTH = 10
export const COUNTER_GAP = 1

/** 숫자 색 기준 — 0x3608c 의 마지막 인자 (0 흰 · 0x50 노랑) */
export const COUNTER_BASE = { white: 0, yellow: 0x50 } as const

/**
 * 0x585ad 한 줄(자리 채우기 없음) — 폭은 **셋째 글자부터** 간격을 더해 세고(0x58620), 그릴 때는 글자마다 폭 + 간격씩 나아간다.
 * 정렬 4 = x 가 오른끝, 1 = 왼끝. 세로 맞춤 없음(위 = y).
 */
function counterRunOf(value: number, x: number, y: number, align: 1 | 4, base: number): HudGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((total, digit, index) => total + smallDigitWidthOf(digit) + (index > 1 ? COUNTER_GAP : 0), 0)
  let left = align === 1 ? x : x - measured
  return digits.map((digit) => {
    const placed = { src: numSrcOf(base + digit), left, top: y }
    left += smallDigitWidthOf(digit) + COUNTER_GAP
    return placed
  })
}

/**
 * **0x3608c(장면, a, b, x, y, 기준)** — "/" 를 (x, y) 에, a 를 x − 1 에 오른쪽 맞춤, b 를 x + "/" 폭 + 1 부터 왼쪽 맞춤
 * (간격 1, 자리 0). "/" 는 기준 0 이면 이미지 101 · 아니면 100 (0x360a6~0x360b8).
 */
export function slashCounterGlyphsOf(a: number, b: number, x: number, y: number, base: number): HudGlyph[] {
  return [
    ...counterRunOf(a, x - 1, y, 4, base),
    { src: numSrcOf(base === 0 ? 101 : 100), left: x, top: y },
    ...counterRunOf(b, x + SLASH_WIDTH + 1, y, 1, base),
  ]
}
