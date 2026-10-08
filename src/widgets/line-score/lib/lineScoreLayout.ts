/**
 * **이닝별 점수판 `0x41c18(장면, x, y)`** — 직접 떴다(0x41c18~0x420ca).
 *
 * 부르는 곳(xref 둘): 0x21 중계 그리기 0x4258c(4283a) — (W/2 − 폭/2, 10) = (14, 10) · 0x18 경기 끝 판 그리기 0x4fe9c(503d8) —
 * (W/2 − 폭/2, H − 높이 − 0xb) = (14, 252). 폭 · 높이 = game_ui 프레임 19 상자 4(212 · 57, `0x94a65(…, 0, 4)`).
 *
 * ```
 * 41c46  i0 = st[0x6b] − 8, 음수면 0                          ; 보이는 아홉 칸의 첫 이닝 (9회 넘으면 밀린다)
 * 41c5e  0x5461c(skin, x, y, 0xd6, 0x3b)                       ; 판 (아래 `panelRectsOf`)
 * 41c94  0xba0bd((x+0x17, y+0x14, 0xb5, 0x1e), 둥글기 1, RGB(0x12, 0x23, 0x52))
 * 41c9e  깜빡 = 0xb68fc(st)(경기 끝) ? ([장면+0x2c] mod 8 ≤ 4) : 1
 * 41cfa  game_ui([장면+0x1018]) 이미지 34 "R" 을 (x+0xba, y+8)
 * 41d1a  [장면+0x1054](team_logo_ini 그림[측 0 팀]) 을 (x+8, y+0x16) · [+0x1058](측 1) 을 (x+8, y+0x25)    ; 적재 0x48a38~0x48a74
 * 41d58  k = 0..8: 0x585ad(skin, num, 0x32, i0+k+1, x+0x21+17k, y+8, 0, 0, 2)                 ; 이닝 번호
 * 41dba  k = 0..8 (i = i0+k):  칸 (x+0x18+17k, y+0x15, 0x10, 0xe) 0xb9f75 RGB(0x1d, 0x35, 0x6e)
 *          i ≤ st[0x6b] 이면 0x585ad(…, 0, 0xb6989(st, i, 0), 칸x + 8, 칸y + 2, 0, 0, 2)          ; 측 0
 * 41e78  같은 칸을 y+0x24 에 — i < st[0x6b] 이거나 (i == st[0x6b] 이고 st[9] == 1) 이면 측 1 점수
 * 41f26  합 칸 (x+0xb1, y+0x15, 0x1b, 0xe) · (x+0xb1, y+0x24, …) 0xb9f75 같은 색
 * 41fb8  깜빡이 서 있으면 0xb69b0(st, 0/1) 을 (x+0xb1 + 13, 칸y + 2) 가운데                    ; 경기 끝이면 8틱에 5틱 보인다
 * 42040  경기 끝이 아니고 [장면+0x2c] mod 10 ≠ 0 이면 game_ui 이미지 33(노란 테)을
 *          (x+0x15 + 17·(st[0x6b] − i0), st[9] == 1 ? y+0x21 : y+0x12)                       ; 지금 칸 — 10틱에 한 번 꺼진다
 * ```
 * 0xb6989(st, i, s) = st[0x6c + (i mod 9)·2 + s] (s8) — 9칸을 돌려 쓴다(`MissionInningRuns`). 숫자 0x585ad 정렬 2 = x 에서 폭/2 를 뺀다
 * (`widgets/matchup-cards` 의 `paddedNumberGlyphsOf` 와 같은 함수 — 간격 0 · 자리 0).
 */

const LINE_SCORE_INNINGS = 9

/** 판 0x5461c 의 폭 · 높이 (41c50 `movs r3, #0x3b` · 41c5a `#0xd6`) */
export const LINE_SCORE_PANEL = { width: 0xd6, height: 0x3b } as const

/** 부르는 곳별 (x, y) — 0x4258c (W/2 − 106, 10) · 0x4fe9c 경기 끝 (W/2 − 106, H − 57 − 0xb) */
export const LINE_SCORE_AT = {
  autoRelay: { x: 14, y: 10 },
  gameEnd: { x: 14, y: 320 - 57 - 0xb },
} as const

/** 칠 색 — 0x1400748(r, g, b) */
export const LINE_SCORE_COLORS = {
  /** 0x5461c 바깥 칠 RGB(8, 0x1c, 0x4a) */
  panelOuter: '#081C4A',
  /** 0x5461c 테 · 점 · 안쪽 칠 RGB(0x33, 0x5f, 0xcd) */
  panelBlue: '#335FCD',
  /** 0x5461c 흰 칠 */
  panelWhite: '#FFFFFF',
  /** 41c7a 둥근 칠 RGB(0x12, 0x23, 0x52) */
  plate: '#122352',
  /** 41dba 칸 칠 RGB(0x1d, 0x35, 0x6e) */
  cell: '#1D356E',
} as const

/** game_ui **이미지**(프레임 아님 — [[+0x1018]+8]+8 의 배열) 번호 */
export const LINE_SCORE_IMAGES = {
  /** "R" (8×10) — 41ce4 `adds r3, #0x88` */
  runsHeader: 34,
  /** 노란 테 (22×20) — 420ae `adds r3, #0x84` */
  cursor: 33,
} as const

/** num 이미지 기준 — 이닝 번호 0x32(50~59) · 점수 0 (0~9). 둘 다 "1" 만 폭 4, 나머지 8 */
export const LINE_SCORE_NUMBER_BASE = { inning: 0x32, runs: 0 } as const
const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

export interface LineScoreRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

export interface LineScoreGlyph {
  /** num 이미지 번호 */
  readonly image: number
  readonly x: number
  readonly y: number
}

export interface LineScoreImage {
  readonly image: number
  readonly x: number
  readonly y: number
}

/** 이닝별 점수판 하나에 필요한 판 값 */
export interface LineScoreState {
  /** st[0x6b] — 0 부터 센 지금 이닝 */
  readonly inning: number
  /** st[9] — 지금 공격 측 */
  readonly offenseSide: 0 | 1
  /** st[0x6c..] — 측마다 아홉 칸 (이닝 mod 9) */
  readonly inningRuns: readonly [readonly number[], readonly number[]]
  /** st[0x7e] · st[0x7f] — 0xb69b0 */
  readonly totals: readonly [number, number]
  /** 0xb68fc — 경기 끝 */
  readonly isGameOver: boolean
  /** [장면+0x2c] — 이 상태에 들어와 돈 틱 */
  readonly tick: number
}

export interface LineScorePlacement {
  readonly rects: readonly LineScoreRect[]
  readonly images: readonly LineScoreImage[]
  /** 측 0 · 측 1 작은 로고 (team_logo_ini) 의 자리 */
  readonly logos: readonly [{ readonly x: number; readonly y: number }, { readonly x: number; readonly y: number }]
  readonly inningNumbers: readonly LineScoreGlyph[]
  readonly runs: readonly LineScoreGlyph[]
  readonly totals: readonly LineScoreGlyph[]
}

/** 둥근 칠 0x6b7d4 · 0xba0bd(둥글기 1) — (w+1)×(h+1) 에서 네 모서리 점이 빠진 꼴 (`roundPlateRectsOf` 와 같다) */
function roundFill(x: number, y: number, width: number, height: number, color: string): LineScoreRect[] {
  return [
    { x: x + 1, y, width: width - 1, height: height + 1, color },
    { x, y: y + 1, width: width + 1, height: height - 1, color },
  ]
}

/** 둥근 테 0x6aa64(둥글기 1) — R = x + w · B = y + h 일 때 (x+1..R−1, y) · (x+1..R−1, B) · (x, y+1..B−1) · (R, y+1..B−1) */
function roundOutline(x: number, y: number, width: number, height: number, color: string): LineScoreRect[] {
  return [
    { x: x + 1, y, width: width - 1, height: 1, color },
    { x: x + 1, y: y + height, width: width - 1, height: 1, color },
    { x, y: y + 1, width: 1, height: height - 1, color },
    { x: x + width, y: y + 1, width: 1, height: height - 1, color },
  ]
}

const dot = (x: number, y: number, color: string): LineScoreRect => ({ x, y, width: 1, height: 1, color })

/**
 * **판 0x5461c(skin, x, y, w, h)** — 직접 떴다(0x5461c~0x54756):
 * ```
 * 54648  0x6b7d5(x, y, w, h, 둥글기 1, RGB(8, 0x1c, 0x4a))
 * 54674  0x6aa65(x+1, y+1, w−2, h−2, 둥글기 1, RGB(0x33, 0x5f, 0xcd))          ; 테
 * 54698  0x6a8a9 점 (x+2, y+2) · (x+w−2, y+2) · (x+2, y+h−2) · (x+w−2, y+h−2) 같은 색
 * 5471e  0x6b7d5(x+2, y+2, w−4, h−4, 둥글기 1, 흰색)
 * 5474a  0x6b7d5(x+4, y+4, w−8, h−8, 둥글기 1, RGB(0x33, 0x5f, 0xcd))
 * ```
 */
export function panelRectsOf(x: number, y: number, width: number, height: number): LineScoreRect[] {
  const blue = LINE_SCORE_COLORS.panelBlue
  return [
    ...roundFill(x, y, width, height, LINE_SCORE_COLORS.panelOuter),
    ...roundOutline(x + 1, y + 1, width - 2, height - 2, blue),
    dot(x + 2, y + 2, blue),
    dot(x + width - 2, y + 2, blue),
    dot(x + 2, y + height - 2, blue),
    dot(x + width - 2, y + height - 2, blue),
    ...roundFill(x + 2, y + 2, width - 4, height - 4, LINE_SCORE_COLORS.panelWhite),
    ...roundFill(x + 4, y + 4, width - 8, height - 8, blue),
  ]
}

/** 0x585ad(…, 기준, 값, x, y, 간격 0, 자리 0, 정렬 2) — 폭/2 를 x 에서 빼고 글자마다 폭만큼 나아간다 */
export function centeredNumberGlyphsOf(value: number, x: number, y: number, base: number): LineScoreGlyph[] {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const width = digits.reduce((sum, digit) => sum + digitWidthOf(digit), 0)
  let left = x - (width >> 1)
  return digits.map((digit) => {
    const glyph = { image: base + digit, x: left, y }
    left += digitWidthOf(digit)
    return glyph
  })
}

/** 0xb6989(st, i, s) — 아홉 칸을 이닝 mod 9 로 돌려 쓴다 */
export const inningRunsAt = (inningRuns: LineScoreState['inningRuns'], inning: number, side: 0 | 1): number =>
  inningRuns[side][((inning % LINE_SCORE_INNINGS) + LINE_SCORE_INNINGS) % LINE_SCORE_INNINGS] ?? 0

/** 41cb6 — 경기 끝이면 합을 `틱 mod 8 ≤ 4` 일 때만 그린다 */
export const isLineScoreTotalShown = (isGameOver: boolean, tick: number): boolean => !isGameOver || tick % 8 <= 4

/** 42054 — 경기 끝이 아니고 `틱 mod 10 ≠ 0` 이면 지금 칸 테를 그린다 */
export const isLineScoreCursorShown = (isGameOver: boolean, tick: number): boolean => !isGameOver && tick % 10 !== 0

/** 이닝 칸 사이 (칸폭 0x10 + 1) */
const CELL_STEP = 0x11
const CELL = { width: 0x10, height: 0xe } as const

/** 0x41c18 의 그림 자리 — (x, y) 는 부르는 곳(`LINE_SCORE_AT`) */
export function lineScorePlacementOf(x: number, y: number, state: LineScoreState): LineScorePlacement {
  const first = Math.max(0, state.inning - 8)
  const rows = [y + 0x15, y + 0x24] as const
  const rects: LineScoreRect[] = [
    ...panelRectsOf(x, y, LINE_SCORE_PANEL.width, LINE_SCORE_PANEL.height),
    ...roundFill(x + 0x17, y + 0x14, 0xb5, 0x1e, LINE_SCORE_COLORS.plate),
  ]
  const inningNumbers: LineScoreGlyph[] = []
  for (let k = 0; k < LINE_SCORE_INNINGS; k += 1) {
    inningNumbers.push(...centeredNumberGlyphsOf(first + k + 1, x + 0x21 + CELL_STEP * k, y + 8, LINE_SCORE_NUMBER_BASE.inning))
  }
  const runs: LineScoreGlyph[] = []
  for (const side of [0, 1] as const) {
    for (let k = 0; k < LINE_SCORE_INNINGS; k += 1) {
      const inning = first + k
      const cellX = x + 0x18 + CELL_STEP * k
      rects.push({ x: cellX, y: rows[side], ...CELL, color: LINE_SCORE_COLORS.cell })
      const shown = side === 0
        ? inning <= state.inning
        : inning < state.inning || (inning === state.inning && state.offenseSide === 1)
      if (!shown) continue
      runs.push(...centeredNumberGlyphsOf(
        inningRunsAt(state.inningRuns, inning, side), cellX + (CELL.width >> 1), rows[side] + 2, LINE_SCORE_NUMBER_BASE.runs,
      ))
    }
  }
  const totalCell = { x: x + 0xb1, width: 0x1b, height: 0xe }
  rects.push(
    { ...totalCell, y: rows[0], color: LINE_SCORE_COLORS.cell },
    { ...totalCell, y: rows[1], color: LINE_SCORE_COLORS.cell },
  )
  const totals = isLineScoreTotalShown(state.isGameOver, state.tick)
    ? ([0, 1] as const).flatMap((side) =>
        centeredNumberGlyphsOf(state.totals[side], totalCell.x + (totalCell.width >> 1), rows[side] + 2, LINE_SCORE_NUMBER_BASE.runs))
    : []
  const images: LineScoreImage[] = [{ image: LINE_SCORE_IMAGES.runsHeader, x: x + 0xba, y: y + 8 }]
  if (isLineScoreCursorShown(state.isGameOver, state.tick)) {
    images.push({
      image: LINE_SCORE_IMAGES.cursor,
      x: x + 0x15 + CELL_STEP * (state.inning - first),
      y: state.offenseSide === 1 ? y + 0x21 : y + 0x12,
    })
  }
  return {
    rects,
    images,
    logos: [{ x: x + 8, y: y + 0x16 }, { x: x + 8, y: y + 0x25 }],
    inningNumbers,
    runs,
    totals,
  }
}
