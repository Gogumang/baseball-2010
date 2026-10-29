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
