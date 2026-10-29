import { LINE_SCORE_INNINGS } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreConstants'
import type { LineScoreGlyph, LineScoreState } from '@/widgets/line-score/lib/lineScoreLayout/lineScoreTypes'

const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

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

/**
 * 41cb6 — 경기 끝이면 합을 `틱 mod 8 ≤ 4` 일 때만 그린다.
 *
 * 원본 그대로임을 r81 에 다시 떠서 확인했다 — 경기 끝 판(0x4fe9c)에서 R 칸이 비어 보이는 그리기는 이 깜빡임의 꺼진 쪽(8틱 중 3틱)이다:
 * - 41c98 `[sp+0x2c] = 0` → 41ca0 0xb68fc(st)(경기 끝) 거짓이면 41ccc `= 1`; 참이면 41cb6 `[장면+0x2c] mod 8 > 4` 일 때 41cca 가 건너뛰어 0 으로 남는다
 * - 41f7c `[sp+0x2c] == 0` 이면 41f80 이 합 두 글자(41fb8~4203c)를 통째로 건너뛰고 42040 으로 간다 — 합 칸(41f26 · 41f5c 칠)은 늘 그린다
 * - 합 값 41fc4 · 4200a `0xb69b0(st, 0/1)` = `(s8) st[0x7e + 측]` — 판 가운데 큰 점수(`endBoardLayout` 0xb69b0)와 같은 값이라 웹은 두 점수를 넘긴다
 * - 자리 (x+0xb1 + 0x1b/2, 칸y + 2) · 0x585ad(…, num 기준 0, 값, …, 간격 0, 자리 0, 정렬 2)
 * 헤드리스(r81 `endboard-R-on.png` · `endboard-R-off.png`)로 8틱 중 5틱 R 에 2 · 5 가 서고 3틱 비는 것을 보았다.
 */
export const isLineScoreTotalShown = (isGameOver: boolean, tick: number): boolean => !isGameOver || tick % 8 <= 4

/** 42054 — 경기 끝이 아니고 `틱 mod 10 ≠ 0` 이면 지금 칸 테를 그린다 */
export const isLineScoreCursorShown = (isGameOver: boolean, tick: number): boolean => !isGameOver && tick % 10 !== 0
