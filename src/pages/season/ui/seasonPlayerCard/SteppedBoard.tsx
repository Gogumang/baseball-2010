import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SEASON_CARD_BOARD, steppedBoardPointsOf } from '@/pages/season/lib/seasonPlayerCard'
import { managementStyles } from './otherSlices'

/** 계단형 판 0x76724 — 채움 · 테두리, 위 세 변 y+1 밝은 선 · 아래 세 변 y+1 어두운 선 (관리 화면 판과 같은 그리기) */
export function SteppedBoard() {
  const points = steppedBoardPointsOf(SEASON_CARD_BOARD.top, SEASON_CARD_BOARD.height, SEASON_CARD_BOARD.offset)
  const line = (list: readonly { x: number; y: number }[]) => list.map((point) => `${point.x},${point.y + 1.5}`).join(' ')
  return (
    <svg className={managementStyles.board} viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid="시즌카드-판">
      <polygon
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        transform="translate(0.5 0.5)"
        fill={ORIGINAL_COLORS.boardFill}
        stroke={ORIGINAL_COLORS.boardEdge}
        strokeWidth={1}
      />
      <polyline points={line(points.slice(0, 4))} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardHighlight} />
      <polyline points={line(points.slice(4).reverse())} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardEdge} />
    </svg>
  )
}
