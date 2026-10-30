import { fill, line, roundEdgeOf, roundFillOf, type PanelPaint } from '@/shared/lib/commonPanel/panelPaint'

/** 0x5eec4 머리 반사 줄의 회색 표 0xd1c44 = [255, 255, 222, 222] — 회색 g 는 RGB(g, g, g) (0x5f016~0x5f022) */
const ROUND_BOX_SHINE_GREYS = ['#FFFFFF', '#FFFFFF', '#DEDEDE', '#DEDEDE'] as const

export interface RoundBoxOptions {
  readonly width: number
  readonly height: number
  /** 다섯째 인자 [sp+0x44] — 둥글기. 0 이하면 1 */
  readonly round: number
  /** 일곱째 인자 [sp+0x4c](u8) — ≠ 0 이면 왼쪽 위에 머리 반사 줄을 긋는다 */
  readonly shine?: boolean
  /** 여덟째 인자 [sp+0x50] — 반사 줄 길이. 9 이하면 10 */
  readonly shineLength?: number
  /** 아홉째 인자 [sp+0x54] — 줄마다 줄어드는 길이 */
  readonly shineStep?: number
  /** 열둘째 인자 [sp+0x64] — ≠ 0 이면 회색 묶음마다 줄을 하나 덜 긋는다 */
  readonly shortShine?: boolean
  /** 열째 인자 [sp+0x5c] — 칠 색 */
  readonly fill: string
  /** 열한째 인자 [sp+0x60] — 테두리 색 */
  readonly edge: string
}

/**
 * 회색 묶음 i 의 줄들 — 참이면 끝 x < 1 인 줄은 안 긋는다. 보통은 줄 셋(넷째 묶음은 넷), 짧게면 묶음 0~2 는 둘 + 거르지 않는 하나 · 묶음 3 은 둘
 */
function shineChecksOf(i: number, shortShine: boolean): readonly boolean[] {
  if (!shortShine) return i === 3 ? [true, true, true, true] : [true, true, true]
  return i <= 2 ? [true, true, false] : [true, true]
}

/** 반사 줄 — 5efba: 길이 9 이하면 10, 맨 위 두 선 뒤 회색 묶음 넷(0xd1c44)을 줄마다 깎아 긋는다. 짧게면 묶음마다 하나 덜, 아니면 넷째 묶음에 한 줄 더 */
function shinePaintsOf(w: number, shineLength: number, shineStep: number, shortShine: boolean): PanelPaint[] {
  const length = shineLength > 9 ? shineLength : 10
  const paints: PanelPaint[] = [...line(2, 1, w - 2, 1, '#DED7DE'), ...line(2, 2, w - 1, 2, '#FFFFFF')]
  let row = 3
  let cut = 0
  const shineLine = (grey: string, checked: boolean) => {
    const end = length - cut + 1
    if (!checked || end >= 1) paints.push(...line(1, row, end, row, grey))
    row += 1
    cut += shineStep
  }
  for (let i = 0; i <= 3; i += 1) {
    const grey = ROUND_BOX_SHINE_GREYS[i]!
    for (const checked of shineChecksOf(i, shortShine)) shineLine(grey, checked)
  }
  return paints
}

/**
 * **둥근 칸 `0x5eec4(?, x, y, w, h, 둥글기, 정렬, 반사, 반사 길이, 걸음, ?, 칠 색, 테두리 색, 짧게)`** 의 칠 목록
 * (정렬로 옮긴 뒤 왼쪽 위 = (0, 0)) — 0x5eec4~0x5f118 을 직접 떴다. 정렬 비트는 0xb9d74 와 같다(0x5eef6~0x5ef2c).
 * 첫 인자는 안 읽고 그림판은 [0x1400070] 이다. 열째 인자 [sp+0x58] 도 안 읽는다.
 * ```
 * 5ef4c  둥근 칠 0x6b7d4(x, y, w, h, 둥글기, 칠 색)                 ; w+1 × h+1
 * 5ef66  둥근 테두리 0x6aa64(x, y, w, h, 둥글기, 테두리 색)
 * 5ef6c  둥글기 == 1 이면 테두리 색 점 넷 (x+1, y+1) · (x+w−1, y+1) · (x+w−1, y+h−1) · (x+1, y+h−1)
 * 5efba  반사 ≠ 0 이면 (L = 반사 길이, 9 이하면 10):
 *          선 #DED7DE (x+2, y+1)–(x+w−2, y+1) · 선 #FFFFFF (x+2, y+2)–(x+w−1, y+2)
 *          줄 y = y+3 부터, 깎음 a = 0 부터, i = 0..3 회색 g = 0xd1c44[i]:
 *            줄 셋(짧게면 i ≤ 2 만 셋 · i = 3 은 둘) — 선 g (x+1, y)–(x+L−a+1, y) · y += 1 · a += 걸음
 *            (짧게가 아니면 끝 x < x+1 인 줄은 안 긋고, i = 3 은 넷째 줄을 하나 더 긋는다)
 * ```
 */
export function roundBoxPaintsOf({
  width: w,
  height: h,
  round: rawRound,
  shine = false,
  shineLength = 0,
  shineStep = 0,
  shortShine = false,
  fill: fillColor,
  edge,
}: RoundBoxOptions): PanelPaint[] {
  const round = rawRound <= 0 ? 1 : rawRound
  const paints: PanelPaint[] = [...roundFillOf(0, 0, w, h, round, fillColor), ...roundEdgeOf(0, 0, w, h, round, edge)]
  if (round === 1) {
    paints.push(...fill(1, 1, 1, 1, edge), ...fill(w - 1, 1, 1, 1, edge), ...fill(w - 1, h - 1, 1, 1, edge), ...fill(1, h - 1, 1, 1, edge))
  }
  if (!shine) return paints
  return [...paints, ...shinePaintsOf(w, shineLength, shineStep, shortShine)]
}
