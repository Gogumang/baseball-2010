import { fill, line, roundEdge, roundFill, type PanelPaint } from '@/shared/lib/commonPanel/panelPaint'

/** 0x55e60 의 색 (리터럴 0x56208 · 0x56210 · 0x5621c · 0x56220 · 0x56228 · 0x5622c) */
export const COMMON_PANEL_COLORS = {
  fill: '#335FCD',
  edge: '#080408',
  white: '#FFFFFF',
  light: '#E2E2E2',
  grey: '#C5C5C5',
  deep: '#1D44A8',
} as const

export interface CommonPanelOptions {
  readonly width: number
  readonly height: number
  /** 일곱째 인자 [sp+0x84] — 띠 높이. 제목 탭이 아니고 > 0 이면 판 위에 띠를 긋는다 */
  readonly topBand?: number
  /** 여덟째 인자 [sp+0x88] — 아래 띠 높이 */
  readonly bottomBand?: number
  /** 아홉째 인자 [sp+0x8c] — ≠ 0 이면 위 두 띠 대신 왼쪽 위 제목 탭을 그린다 */
  readonly titleTab?: boolean
}

const c = COMMON_PANEL_COLORS

/** 55fb6 제목 탭 (cx = w/2) — 밝은 회색 쐐기 · 회색/짙은 파랑 경계 · 흰 반사 (띠는 안 본다) */
function titleTabPaintsOf(w: number): PanelPaint[] {
  const cx = Math.trunc(w / 2)
  const paints: PanelPaint[] = [...line(2, 2, w - 3, 2, c.light), ...line(2, 3, cx, 3, c.light)]
  for (let i = 0; i <= 13; i += 1) paints.push(...line(2, 3 + i, cx - i, 3 + i, c.light))
  paints.push(
    ...line(2, 17, cx - 14, 17, c.grey),
    ...line(cx - 14, 17, cx, 3, c.grey),
    ...line(cx + 1, 3, w - 3, 3, c.grey),
    ...line(2, 18, cx - 14, 18, c.deep),
    ...line(cx - 14, 18, cx, 4, c.deep),
    ...line(cx + 1, 4, w - 3, 4, c.deep),
  )
  for (let i = 0; i <= 7; i += 1) paints.push(...line(3, 3 + i, cx - i - 2, 3 + i, c.white))
  return paints
}

/** 위 띠 560fe · 아래 띠 56172 — 줄 top 부터 높이 band: 회색 선 둘 사이에 흰 · 밝은 회색 반쪽 칠 (whiteTop = 흰 칠의 위 줄) */
function bandPaintsOf(w: number, top: number, band: number, whiteTop: number): PanelPaint[] {
  const half = Math.trunc(band / 2)
  return [
    ...line(2, top, w - 3, top, c.grey),
    ...line(2, top + band, w - 3, top + band, c.grey),
    ...fill(2, whiteTop, w - 4, half, c.white),
    ...fill(2, top + half, w - 4, half, c.light),
  ]
}

/**
 * **공용 판 `0x55e60(skin, x, y, w, h, 알파, 정렬, 위 띠, 아래 띠, 제목 탭, 어둡게)`** 의 칠 목록 (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)).
 *
 * ```
 * 55f0e  둥근 칠 0x6b7d4(x, y, w−1, h−1, 1, #335FCD)               ; w × h, 네 모서리 점은 빈다
 * 55f28  둥근 테두리 0x6aa64(x, y, w−1, h−1, 1, #080408)
 * 55f44  점 0x6a8a8 #080408 넷 — (x+1, y+1) · (x+w−2, y+1) · (x+1, y+h−2) · (x+w−2, y+h−2)
 * 55f92  둥근 테두리 0x6aa64(x+1, y+1, w−3, h−3, 1, #FFFFFF)
 * 55fb6  제목 탭([sp+0x8c] ≠ 0, cx = x + w/2):
 *          선 #E2E2E2 (x+2, y+2)–(x+w−3, y+2) · (x+2, y+3)–(cx, y+3) · i = 0..13: (x+2, y+3+i)–(cx−i, y+3+i)
 *          선 #C5C5C5 (x+2, y+17)–(cx−14, y+17) · (cx−14, y+17)–(cx, y+3) · (cx+1, y+3)–(x+w−3, y+3)
 *          선 #1D44A8 (x+2, y+18)–(cx−14, y+18) · (cx−14, y+18)–(cx, y+4) · (cx+1, y+4)–(x+w−3, y+4)
 *          선 #FFFFFF i = 0..7: (x+3, y+3+i)–(cx−i−2, y+3+i)                ; 그리고 끝 (띠는 안 본다)
 * 560fe  아니면 위 띠 t = [sp+0x84] > 0:
 *          선 #C5C5C5 (x+2, y+2)–(x+w−3, y+2) · (x+2, y+t+2)–(x+w−3, y+t+2)
 *          칠 #FFFFFF (x+2, y+3, w−4, t/2) · 칠 #E2E2E2 (x+2, y+2+t/2, w−4, t/2)
 * 56172  아래 띠 b = [sp+0x88] > 0, yb = y + h − b − 3:
 *          선 #C5C5C5 (x+2, yb)–(x+w−3, yb) · (x+2, yb+b)–(x+w−3, yb+b)
 *          칠 #FFFFFF (x+2, yb+1, w−4, b/2) · 칠 #E2E2E2 (x+2, yb+b/2, w−4, b/2)
 * ```
 * 나눗셈은 모두 0 쪽으로 버린다(asr + 부호 보정). 어둡게([sp+0x90] ≠ 0)는 판 앞에 화면 전체를 [0x15605d0] 검정 단계 5 로
 * 덮는 것이라(0x55ea8~0x55ebe) 판 칠 목록에는 넣지 않고 `CommonPanel` 의 `dim` 이 판 뒤에 화면 전체 덮개로 깐다.
 */
export function commonPanelPaintsOf({ width: w, height: h, topBand = 0, bottomBand = 0, titleTab = false }: CommonPanelOptions): PanelPaint[] {
  const paints: PanelPaint[] = [
    ...roundFill(0, 0, w - 1, h - 1, c.fill),
    ...roundEdge(0, 0, w - 1, h - 1, c.edge),
    ...fill(1, 1, 1, 1, c.edge),
    ...fill(w - 2, 1, 1, 1, c.edge),
    ...fill(1, h - 2, 1, 1, c.edge),
    ...fill(w - 2, h - 2, 1, 1, c.edge),
    ...roundEdge(1, 1, w - 3, h - 3, c.white),
  ]
  if (titleTab) return [...paints, ...titleTabPaintsOf(w)]
  if (topBand > 0) paints.push(...bandPaintsOf(w, 2, topBand, 3))
  if (bottomBand > 0) {
    const top = h - bottomBand - 3
    paints.push(...bandPaintsOf(w, top, bottomBand, top + 1))
  }
  return paints
}
