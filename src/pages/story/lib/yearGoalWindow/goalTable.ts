import type { CardBox } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { averageGlyphsOf, earnedRunAverageGlyphsOf, numberPiecesOf, textPieceOf, winRateGlyphsOf } from './goalPieces'
import { SEASON_YEAR_GOAL_LABEL_SET, SEASON_YEAR_GOAL_LABELS, YEAR_GOAL_BOXES, YEAR_GOAL_LABELS, YEAR_GOAL_TEXT } from './goalWindowSpec'
import type { YearGoalNumberPiece, YearGoalTextPiece, YearGoalWindowLayout, YearGoalWindowSource } from './goalWindowSpec'

/** 줄 간격 — 박스.y += 박스 높이 + 2 */
const ROW_GAP = 2
const ROWS = 5

const rowOf = (area: CardBox, row: number): CardBox => ({ ...area, y: area.y + row * (area.height + ROW_GAP) })

/** 시즌모드 한 칸 — ① 숫자 · ② 승률 · ③ 타율 · ④ 방어율 · ⑤ 숫자 (현재·목표 같은 꼴) */
function seasonCellOf(value: number, area: CardBox, row: number): YearGoalNumberPiece[] {
  if (row === 1) return winRateGlyphsOf(value, area)
  if (row === 2) return averageGlyphsOf(value, area)
  if (row === 3) return earnedRunAverageGlyphsOf(value, area)
  return numberPiecesOf(value, area)
}

/** 0x8656c 가 받는 박스 셋 — 이름 줄 · 현재 열 · 목표 열 */
export interface GoalTableBoxes {
  readonly labels: CardBox
  readonly current: CardBox
  readonly goals: CardBox
}

/**
 * **0x8656c(w, 이름 박스, 현재 박스, 목표 박스, 0)** 한 번 — 이름 다섯 줄 · "현재"/"목표" 머리 · 값 다섯 줄.
 * 박스 현재 · 목표는 머리 줄 다음(1줄째)부터 값이다. 올해의 목표 창(0x86fdc, 박스 2·3·4)과 경기 평가 변화 창
 * (0x86c90, 박스 7·5·6)이 같이 부른다.
 */
export function goalTableLayoutOf(values: YearGoalWindowSource, boxes: GoalTableBoxes): YearGoalWindowLayout {
  const labels = values.labelSet === SEASON_YEAR_GOAL_LABEL_SET ? SEASON_YEAR_GOAL_LABELS : YEAR_GOAL_LABELS[values.labelSet]
  const texts: YearGoalTextPiece[] = [
    ...labels.map((frame, row) => textPieceOf(frame, rowOf(boxes.labels, row), 0x24, 0)),
    textPieceOf(YEAR_GOAL_TEXT.current, boxes.current, 0x22, 0),
    textPieceOf(YEAR_GOAL_TEXT.goal, boxes.goals, 0x22, 0),
  ]
  const firstGlyphsOf = values.labelSet === 0 ? averageGlyphsOf : earnedRunAverageGlyphsOf
  const cellOf =
    values.labelSet === SEASON_YEAR_GOAL_LABEL_SET
      ? seasonCellOf
      : (value: number, area: CardBox, row: number) => (row === 0 ? firstGlyphsOf(value, area) : numberPiecesOf(value, area))
  const columnOf = (column: readonly number[], area: CardBox) =>
    column.slice(0, ROWS).flatMap((value, row) => cellOf(value, rowOf(area, row + 1), row))
  return { texts, numbers: [...columnOf(values.current, boxes.current), ...columnOf(values.goals, boxes.goals)] }
}

/** 창 한 장의 글·숫자 자리 — 제목 뒤 0x8656c(w, 박스 2, 박스 3, 박스 4, 0) */
export function yearGoalWindowLayoutOf(values: YearGoalWindowSource): YearGoalWindowLayout {
  const B = YEAR_GOAL_BOXES
  const table = goalTableLayoutOf(values, B)
  return { texts: [textPieceOf(YEAR_GOAL_TEXT.title, B.title, 0x22, 3), ...table.texts], numbers: table.numbers }
}
