/**
 * **마선수 등장 컷인 `0x473f0`** — 교체 연출 0x16 의 그리기 0x4da30 이 "CHANGE" 애니(`substitutionScene`)를 그린 뒤
 * `+0x195c` 비트 2(들어온 선수가 마선수)면 4dafa 에서 부른다 (2026-10-08 직접 뜸, R2 11절을 줄 단위로 다시 맞춤).
 *
 * 0x16 진입 0x3d458 이 단계 `[+0x196c]` 를 −1 로 두고, 그림마다 아래를 한 번 돈다(W = 240 · H = 320 · cx = W/2 · cy = H/2):
 * ```
 * 47442  fillRect(0, cy − 40, W, 82, RGB(50, 1, 1))                        ; 검붉은 띠 (0x6a9f1)
 * 4746a  창 객체 0x75b19(0x9c 바이트): 테두리 [+0x7c] = RGB(2, 2, 2) · 채우기 [+0x80] = RGB(172, 12, 5)
 * 474c0  번호 = 0xb63a1(들어온 선수) (+5 타자 — +0x195c 비트 0)
 * 474f0  단계 ≠ −1 이면 game_ui 프레임 0x55 + 단계 mod 5 를 (cx, cy − 39) 에 (0xba759 종류 1)     ; 속도선
 * 4752a  switch 단계 (표 0xd0130):
 *          −1  단계 = 0 · 속도 [+0x1970] = 1 · 초상 [+0x1978] = 0x63a05(ui, 0xd0108[번호], 0) · 0x93cfd(초상, 1) ; r = 80
 *           0  r = W/2 − 속도 ; 속도 ×= 4 ; r < 0 이면 r = −4 · 단계 = 1
 *         1·2  r = 0 ; 단계 + 1           3·4  단계 + 1 · 속도 = 1 ; r = 0          그 밖  r = 0
 * 475ea  배너 여덟 점 (0, cy−14) (cx+r+14, cy−14) (cx+r+40, cy−40) (W, cy−40) (W, cy+14) (cx−r−14, cy+14) (cx−r−40, cy+40) (0, cy+40)
 *        0x75ba5 · 0x75e31 — 스캔라인 채우기(0x75c70) 뒤 테두리(0x75dc4), 그리고 윗변 셋 · 아랫변 셋을 y + 1 에 검정 선(0x6a905)
 * 47706  단계 > 4 이면 game_ui 이미지 96 을 (cx + 5, cy − 39) · 95 를 (cx − 104, cy + 12) 에 효과 2(더하기) · 230
 * 47756  switch 단계 − 5 (표 0xd0148):
 *         5~9   흰 사선 넷 — 알파 단계·10 + 50, d = 단계·10 − 50: (cx+d−120, cy−14) (cx+d−66, cy−14) (cx+d−120, cy+40) (cx+d−174, cy+40) ; 단계 + 1
 *        10~13  흰 여덟 점 — 알파 0x8c, e = 단계·5 − 60: (cx+e−26, cy−14) (cx+14, cy−14) (cx+40, cy−40) (cx+e+80, cy−40)
 *               (cx+e+26, cy+14) (cx−14, cy+14) (cx−40, cy+40) (cx+e−80, cy+40) ; 단계 + 1
 *        14~18  흰 넷 — 알파 210 − 단계·5, f = cx + W/2 + 단계·12 − 162: (f−54, cy−40) (f, cy−40) (f−54, cy+14) (f−108, cy+14) ; 단계 + 1
 *        19~21  단계 + 1          22  0xbcb49(장면, 13) — 0x16 을 끝낸다(→ 0xd)
 * 47962  (늘린 뒤의) 단계 > 4 이면 초상: 단계 ≤ 7 이면 x = W − 단계·5 + 25, 아니면 x = W − (폭 / 2) − 5 (폭 = 지금 칸의 상자, 0x93e7d),
 *        y = cy + 13 에 0x93c45(초상, x, y) — 칸을 넘기는 0x93d91 은 안 부른다(첫 칸에 선다)
 * 479e0  (늘린 뒤의) 단계 5 → 이미지 93 을 (W/2 − 150, cy + 5) · 6 → (W/2 − 120) · 7 → (W/2 − 59) ·
 *        8~10 → 0xbb91d(이미지 93, W/2 − 40, cy + 5, 종류 8, 10, 200)(+200 밝게) · 그 밖 → (W/2 − 49)
 * ```
 * 곧 그림 0 에서 −1 → 0, 그림 1~4 에서 배너가 미끄러져 들어오고(r = 119 · 116 · 104 · 56), 그림 5 에서 r = −4 로 맞물린 뒤
 * 그림 9 부터 사선 · 초상 · "CHANGE" 글자(이미지 93)가 들어오고, 그림 26 이 단계 22 를 보고 13 을 보내 **27 그림**에 끝난다.
 *
 * 그리기 바탕(픽셀 단위로 옮긴다):
 * - 0x6a9f1 fillRect · 0x6a905 drawLine 은 색 윗바이트 알파가 0 · 0xff 가 아니면 반투명(0x1400698(ctx, 4, 알파))이다.
 *   RGB 0x1400748 은 윗바이트 0 이라 불투명이다.
 * - 0x75c70 스캔라인: y = 최소 y 부터 최대 y **앞까지**, 변 (i−1, i) 마다 `(yi < y ≤ yj) || (yj < y ≤ yi)` 이고 yi ≠ yj 면
 *   x = xi + (y − yi)(xj − xi) / (yj − yi)(0 쪽으로 자름), 정렬해 둘씩 [최소 x, 최대 x] 로 자른 뒤 가로선(채우기 색).
 * - 0x75dc4 테두리: 점 i 에서 다음 점으로 선(테두리 색) — 닫힌 다각형.
 * - 효과 2(0x9a2f1 · 팔레트 0x973c5): 채널마다 화면 + 그림·230 >> 8, 최대에서 자름.
 */

/** 표 0xd0108 — 번호(투수 0~4 · 타자 5~9) → event_char 인물 번호 */
export const ACE_CUT_IN_PORTRAITS: readonly number[] = [17, 11, 18, 13, 19, 10, 20, 12, 21, 22]

/** 0x63a04 의 인물 → 애니 바탕 (표 0xd0ae6, `pages/management/lib/centerStage` 와 같은 표) — n = 0 */
const PORTRAIT_ANIMATION_BASE: readonly number[] = [-1, -1, 16, 23, 30, 37, 44, 51, 58, 65, 0, 7, 15, 23, 72, 79, 86, 40, 16, 8, 0, 24, 32]

/** 컷인 인물 그림 — event_char 폴더 · 애니 번호 (0x63a18~0x63a34: 10~13 → _1 · 17~22 → _2) */
export function aceCutInPortraitOf(aceSlot: number): { readonly folder: string; readonly animation: number } | null {
  const index = ACE_CUT_IN_PORTRAITS[aceSlot]
  if (index === undefined) return null
  const file = index >= 10 && index <= 13 ? 'event_char_1' : index >= 17 && index <= 22 ? 'event_char_2' : 'event_char_0'
  return { folder: `./sprites/${file}/frames`, animation: PORTRAIT_ANIMATION_BASE[index] ?? 0 }
}

/** 컷인 번호 — 0xb63a1(들어온 선수) 에 타자면 +5 (474c0) */
export function aceCutInSlotOf(side: '투수' | '타자', aceIndex: number): number {
  return side === '타자' ? aceIndex + 5 : aceIndex
}

export interface CutInPoint {
  readonly x: number
  readonly y: number
}

/** 색 — 알파는 0~255(0 · 255 는 불투명, 0x6a905 · 0x6a9f1) */
export interface CutInColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly alpha: number
}

export interface CutInPolygon {
  readonly points: readonly CutInPoint[]
  readonly fill: CutInColor
  readonly border: CutInColor
}

export interface CutInLine {
  readonly from: CutInPoint
  readonly to: CutInPoint
  readonly color: CutInColor
}

/** 한 그림에 그릴 것 — 그리는 차례대로 */
export interface AceCutInDraw {
  /** 이 그림을 시작할 때의 단계 [+0x196c] */
  readonly stage: number
  readonly band: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: CutInColor }
  /** game_ui 프레임 (속도선) 과 그 자리 — 단계 −1 이면 없음 */
  readonly speedLines: { readonly frame: number; readonly x: number; readonly y: number } | null
  readonly banner: CutInPolygon
  readonly bannerShadows: readonly CutInLine[]
  /** game_ui 이미지 96 · 95 (효과 2 · 230) */
  readonly streaks: readonly { readonly image: number; readonly x: number; readonly y: number }[]
  readonly sweep: CutInPolygon | null
  /** 초상 자리 — x 가 `'centered'` 면 W − 폭/2 − 5 */
  readonly portrait: { readonly x: number | 'centered'; readonly y: number } | null
  /** game_ui 이미지 93 ("CHANGE") — `brighten` 은 0xbb91d 종류 8 의 b */
  readonly label: { readonly image: number; readonly x: number; readonly y: number; readonly brighten: number } | null
  /** 이 그림이 단계 22 를 보고 메시지 13 을 보냈다 — 다음 그림부터 0xd */
  readonly ends: boolean
}

const W = 240
const H = 320
const CX = W >> 1
const CY = H >> 1

const opaque = (r: number, g: number, b: number): CutInColor => ({ r, g, b, alpha: 0 })
const white = (alpha: number): CutInColor => ({ r: 255, g: 255, b: 255, alpha: alpha & 0xff })

const BAND_COLOR = opaque(50, 1, 1)
const BANNER_FILL = opaque(172, 12, 5)
const BANNER_BORDER = opaque(2, 2, 2)
const SHADOW = opaque(0, 0, 0)

/** 0xca911 — C 의 % (0 쪽으로 자르는 나머지) */
const remainder = (value: number, divisor: number) => value - Math.trunc(value / divisor) * divisor

function bannerPoints(r: number): CutInPoint[] {
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
function bannerShadowsOf(points: readonly CutInPoint[]): CutInLine[] {
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

function sweepOf(stage: number): CutInPolygon | null {
  if (stage >= 5 && stage <= 9) {
    const color = white(stage * 10 + 50)
    const d = stage * 10 - 50
    return {
      points: [
        { x: CX + d - 120, y: CY - 14 },
        { x: CX + d - 66, y: CY - 14 },
        { x: CX + d - 120, y: CY + 40 },
        { x: CX + d - 174, y: CY + 40 },
      ],
      fill: color,
      border: color,
    }
  }
  if (stage >= 10 && stage <= 13) {
    const color = white(0x8c)
    const e = stage * 5 - 60
    return {
      points: [
        { x: CX + e - 26, y: CY - 14 },
        { x: CX + 14, y: CY - 14 },
        { x: CX + 40, y: CY - 40 },
        { x: CX + e + 80, y: CY - 40 },
        { x: CX + e + 26, y: CY + 14 },
        { x: CX - 14, y: CY + 14 },
        { x: CX - 40, y: CY + 40 },
        { x: CX + e - 80, y: CY + 40 },
      ],
      fill: color,
      border: color,
    }
  }
  if (stage >= 14 && stage <= 18) {
    const color = white(210 - stage * 5)
    const f = CX + CX + stage * 12 - 162
    return {
      points: [
        { x: f - 54, y: CY - 40 },
        { x: f, y: CY - 40 },
        { x: f - 54, y: CY + 14 },
        { x: f - 108, y: CY + 14 },
      ],
      fill: color,
      border: color,
    }
  }
  return null
}

function labelOf(stage: number): AceCutInDraw['label'] {
  const y = CY + 5
  switch (stage - 5) {
    case 0:
      return { image: 93, x: CX - 150, y, brighten: 0 }
    case 1:
      return { image: 93, x: CX - 120, y, brighten: 0 }
    case 2:
      return { image: 93, x: CX - 59, y, brighten: 0 }
    case 3:
    case 4:
    case 5:
      return { image: 93, x: CX - 40, y, brighten: 200 }
    default:
      return { image: 93, x: CX - 49, y, brighten: 0 }
  }
}

/** 단계 기계를 그림마다 돌린 결과 — 단계 22 를 본 그림(메시지 13)까지 */
export function aceCutInDraws(): readonly AceCutInDraw[] {
  const draws: AceCutInDraw[] = []
  let stage = -1
  let speed = 0
  for (let guard = 0; guard < 64; guard += 1) {
    const startStage = stage
    const speedLines = stage === -1 ? null : { frame: 0x55 + remainder(stage, 5), x: CX, y: CY - 39 }
    let r = 0
    if (stage === -1) {
      // 47532 — 초상 적재 · 속도 1. r 은 함수 머리의 0x50 그대로
      stage = 0
      speed = 1
      r = 0x50
    } else if (stage === 0) {
      r = CX - speed
      speed *= 4
      if (r < 0) {
        r = -4
        stage = 1
      }
    } else if (stage === 1 || stage === 2) {
      stage += 1
    } else if (stage === 3 || stage === 4) {
      stage += 1
      speed = 1
    }
    const points = bannerPoints(r)
    const streaks =
      stage > 4
        ? [
            { image: 96, x: CX + 5, y: CY - 39 },
            { image: 95, x: CX - 104, y: CY + 12 },
          ]
        : []
    const sweep = sweepOf(stage)
    let ends = false
    if (stage >= 5 && stage <= 21) stage += 1
    else if (stage === 22) ends = true
    const portrait = stage > 4 ? { x: stage <= 7 ? W - stage * 5 + 25 : ('centered' as const), y: CY + 13 } : null
    const label = stage > 4 ? labelOf(stage) : null
    draws.push({
      stage: startStage,
      band: { x: 0, y: CY - 40, width: W, height: 0x52, color: BAND_COLOR },
      speedLines,
      banner: { points, fill: BANNER_FILL, border: BANNER_BORDER },
      bannerShadows: bannerShadowsOf(points),
      streaks,
      sweep,
      portrait,
      label,
      ends,
    })
    if (ends) break
  }
  return draws
}

/** 컷인을 다 그리는 그림 수 — 마지막 그림이 메시지 13 을 보낸다 */
export const ACE_CUT_IN_DRAWS = aceCutInDraws().length

/**
 * 0x75c70 의 스캔라인 — 가로선 [x0, x1] (양 끝 포함) 들. 0x75ba5 가 적은 상자(최소·최대 x · y)를 쓴다.
 */
export function scanlineSpans(points: readonly CutInPoint[]): readonly { readonly y: number; readonly x0: number; readonly x1: number }[] {
  if (points.length < 3) return []
  const ys = points.map((point) => point.y)
  const xs = points.map((point) => point.x)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spans: { y: number; x0: number; x1: number }[] = []
  for (let y = minY; y < maxY; y += 1) {
    const crossings: number[] = []
    for (let i = 0; i < points.length; i += 1) {
      const pi = points[i]
      const pj = points[(i + points.length - 1) % points.length]
      const crosses = (pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)
      if (!crosses || pj.y === pi.y) continue
      crossings.push(pi.x + Math.trunc(((y - pi.y) * (pj.x - pi.x)) / (pj.y - pi.y)))
    }
    crossings.sort((a, b) => a - b)
    for (let k = 0; k < crossings.length; k += 2) {
      let x0 = crossings[k]
      if (x0 >= maxX) break
      let x1 = crossings[k + 1] ?? x0
      if (x1 <= minX) continue
      if (x0 < minX) x0 = minX
      if (x1 > maxX) x1 = maxX
      spans.push({ y, x0, x1 })
    }
  }
  return spans
}

/** 선의 점들 — 브레젠험 (양 끝 포함). ⚠️ 플랫폼 drawLine 0x14006c8 의 본문은 못 읽었다 — 가로 · 세로선은 같고 빗선은 근사 */
export function linePixels(from: CutInPoint, to: CutInPoint): readonly CutInPoint[] {
  const pixels: CutInPoint[] = []
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - from.x)
  const dy = -Math.abs(to.y - from.y)
  const sx = from.x < to.x ? 1 : -1
  const sy = from.y < to.y ? 1 : -1
  let error = dx + dy
  for (let guard = 0; guard < 4096; guard += 1) {
    pixels.push({ x, y })
    if (x === to.x && y === to.y) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += sx
    }
    if (doubled <= dx) {
      error += dx
      y += sy
    }
  }
  return pixels
}
