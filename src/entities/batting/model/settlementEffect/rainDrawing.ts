import { signedByte, type SceneRain } from '@/entities/batting/model/settlementEffect/rain'

/** 0x8fb08 — 튐 수명(줄인 뒤)별 흰 점 자리. 3 은 가로선 (x − 2, y) ~ (x + 2, y) 도 긋는다 */
export const SPLASH_DOTS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [
    [-1, -1],
    [-2, -2],
    [1, -1],
    [2, -2],
  ],
  2: [
    [-4, 0],
    [-3, 0],
    [-2, -2],
    [-3, -3],
    [4, 0],
    [3, 0],
    [2, -2],
    [3, -3],
  ],
  1: [
    [-6, 0],
    [-5, 0],
    [-4, -2],
    [-5, -3],
    [6, 0],
    [5, 0],
    [4, -2],
    [5, -3],
  ],
  0: [
    [-7, 0],
    [-8, -2],
    [-5, -4],
    [7, 0],
    [8, -2],
    [5, -4],
    [0, 0],
  ],
}

/** 가로선을 함께 긋는 튐 수명 */
const BAR_SPLASH_LIFE = 3

interface RainLine {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly alpha: number
}

interface RainPoint {
  readonly x: number
  readonly y: number
}

/** 0x8f8ec — 이번 틱에 그린 방울마다 선(x, y − 길이) → (x + 바람, y) */
function rainLinesOf(rain: SceneRain): RainLine[] {
  const lines = []
  for (const drop of rain.drops.slots) {
    if (drop === null || drop === undefined || !drop.isDrawn) continue
    lines.push({ x0: drop.x, y0: drop.y - signedByte(drop.length), x1: drop.x + rain.wind, y1: drop.y, alpha: drop.alpha })
  }
  return lines
}

/** 0x8fb08 — 튐 칸마다 가로선(수명 3)과 흰 점 */
function splashMarksOf(rain: SceneRain): { readonly dots: RainPoint[]; readonly bars: RainPoint[] } {
  const dots = []
  const bars = []
  for (const splash of rain.splashes.slots) {
    if (splash === null || splash === undefined) continue
    if (splash.life === BAR_SPLASH_LIFE) bars.push({ x: splash.x, y: splash.y })
    for (const [dx, dy] of SPLASH_DOTS[splash.life] ?? []) dots.push({ x: splash.x + dx, y: splash.y + dy })
  }
  return { dots, bars }
}

/** 비 그리기 0x8f8ec · 0x8fb08 — 빗방울 선과 튐 점 */
export function rainDrawingOf(rain: SceneRain): {
  readonly lines: readonly RainLine[]
  readonly dots: readonly RainPoint[]
  readonly bars: readonly RainPoint[]
} {
  const lines = rainLinesOf(rain)
  const { dots, bars } = splashMarksOf(rain)
  return { lines, dots, bars }
}
