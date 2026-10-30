import type { AceCutInDraw, CutInColor, CutInLine, CutInPoint, CutInPolygon } from '@/features/play-game/model/aceCutIn/types'

/** 화면 240 × 320 과 그 가운데 (0x473f0 의 W · H · cx · cy) */
export const W = 240
const H = 320
export const CX = W >> 1
export const CY = H >> 1

const opaque = (r: number, g: number, b: number): CutInColor => ({ r, g, b, alpha: 0 })
const white = (alpha: number): CutInColor => ({ r: 255, g: 255, b: 255, alpha: alpha & 0xff })

/** 검붉은 띠 RGB(50, 1, 1) (47442) */
export const BAND_COLOR = opaque(50, 1, 1)
/** 창 객체 0x75b19 의 채우기 [+0x80] · 테두리 [+0x7c] (4746a) */
export const BANNER_FILL = opaque(172, 12, 5)
export const BANNER_BORDER = opaque(2, 2, 2)
const SHADOW = opaque(0, 0, 0)

/** 475ea — 배너 여덟 점 (r 만큼 가운데에서 벌어진다) */
export function bannerPoints(r: number): CutInPoint[] {
  return [
    { x: CX - CX, y: CY - 14 },
    { x: CX + r + 14, y: CY - 14 },
    { x: CX + r + 40, y: CY - 40 },
    { x: CX + CX, y: CY - 40 },
    { x: CX + CX, y: CY + 14 },
    { x: CX - r - 14, y: CY + 14 },
    { x: CX - r - 40, y: CY + 40 },
    { x: CX - CX, y: CY + 40 },
  ]
}

/** 47698~476fc — 윗변 (0→1, 1→2, 2→3) 과 아랫변 (7→6, 6→5, 5→4) 을 y + 1 에 검정 선 */
export function bannerShadowsOf(points: readonly CutInPoint[]): CutInLine[] {
  const lines: CutInLine[] = []
  for (let k = 0; k < 3; k += 1) {
    const top = points[k]
    const topNext = points[k + 1]
    lines.push({ from: { x: top.x, y: top.y + 1 }, to: { x: topNext.x, y: topNext.y + 1 }, color: SHADOW })
    const bottom = points[6 - k]
    const bottomNext = points[7 - k]
    lines.push({ from: { x: bottomNext.x, y: bottomNext.y + 1 }, to: { x: bottom.x, y: bottom.y + 1 }, color: SHADOW })
  }
  return lines
}

/** 같은 색으로 채우고 두르는 흰 다각형 */
const whitePolygon = (alpha: number, points: CutInPoint[]): CutInPolygon => {
  const color = white(alpha)
  return { points, fill: color, border: color }
}

/** 단계 5~9 — 흰 사선 넷, 알파 단계·10 + 50, d = 단계·10 − 50 */
function slashSweepOf(stage: number): CutInPolygon {
  const d = stage * 10 - 50
  return whitePolygon(stage * 10 + 50, [
    { x: CX + d - 120, y: CY - 14 },
    { x: CX + d - 66, y: CY - 14 },
    { x: CX + d - 120, y: CY + 40 },
    { x: CX + d - 174, y: CY + 40 },
  ])
}

/** 단계 10~13 — 흰 여덟 점, 알파 0x8c, e = 단계·5 − 60 */
function bannerSweepOf(stage: number): CutInPolygon {
  const e = stage * 5 - 60
  return whitePolygon(0x8c, [
    { x: CX + e - 26, y: CY - 14 },
    { x: CX + 14, y: CY - 14 },
    { x: CX + 40, y: CY - 40 },
    { x: CX + e + 80, y: CY - 40 },
    { x: CX + e + 26, y: CY + 14 },
    { x: CX - 14, y: CY + 14 },
    { x: CX - 40, y: CY + 40 },
    { x: CX + e - 80, y: CY + 40 },
  ])
}

/** 단계 14~18 — 흰 넷, 알파 210 − 단계·5, f = cx + W/2 + 단계·12 − 162 */
function trailSweepOf(stage: number): CutInPolygon {
  const f = CX + CX + stage * 12 - 162
  return whitePolygon(210 - stage * 5, [
    { x: f - 54, y: CY - 40 },
    { x: f, y: CY - 40 },
    { x: f - 54, y: CY + 14 },
    { x: f - 108, y: CY + 14 },
  ])
}

/** 47756 switch 단계 − 5 (표 0xd0148) 의 흰 다각형 — 단계 5~18 밖이면 없음 */
export function sweepOf(stage: number): CutInPolygon | null {
  if (stage >= 5 && stage <= 9) return slashSweepOf(stage)
  if (stage >= 10 && stage <= 13) return bannerSweepOf(stage)
  if (stage >= 14 && stage <= 18) return trailSweepOf(stage)
  return null
}

/** 479e0 — 단계 5 · 6 · 7 의 "CHANGE" x 자리, 8~10 은 가운데 − 40 에 밝게(0xbb91d 종류 8, 200), 그 밖 가운데 − 49 */
const LABEL_IMAGE = 93
const LABEL_ENTRY_X: Readonly<Record<number, number>> = { 5: CX - 150, 6: CX - 120, 7: CX - 59 }
const LABEL_FLASH_STAGES = { first: 8, last: 10 } as const
const LABEL_FLASH = 200

export function labelOf(stage: number): AceCutInDraw['label'] {
  const y = CY + 5
  const entryX = LABEL_ENTRY_X[stage]
  if (entryX !== undefined) return { image: LABEL_IMAGE, x: entryX, y, brighten: 0 }
  if (stage >= LABEL_FLASH_STAGES.first && stage <= LABEL_FLASH_STAGES.last) return { image: LABEL_IMAGE, x: CX - 40, y, brighten: LABEL_FLASH }
  return { image: LABEL_IMAGE, x: CX - 49, y, brighten: 0 }
}
