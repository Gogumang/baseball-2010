import { CommonPanel, FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  PITCH_TRAINING_CONNECTORS,
  PITCH_TRAINING_CONNECTOR_COLOR,
  PITCH_TRAINING_INNER,
  PITCH_TRAINING_INNER_COLORS,
  PITCH_TRAINING_LAYOUT_FRAME,
  PITCH_TRAINING_PANEL,
  PITCH_TRAINING_TAB_MARK_FRAME,
  PITCH_TRAINING_TAB_STRIP,
  PITCH_TRAINING_TREE_FRAME,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { FULL_LAYER, G_COIN, MODE_UI, SCREEN } from './figureLayout'

interface WindowBackProps {
  readonly uiOrigins: FrameOrigins | null
  /** 상태 ≠ 0x7b — G 동전(805a8)을 그린다 */
  readonly isTraining: boolean
  /** 고른 탭 꺾쇠 자리 — 그리지 않는 틀이면 null (80d6a) */
  readonly tabMarkAt: { readonly x: number; readonly y: number } | null
}

/**
 * 창 뒤판 — 8046c 공용 판 · 0x802dc 안쪽 칠 · mode_ui 26 배치 · 탭 줄 39 · G 동전 · 나무 29 · 탭 꺾쇠 40 · 칸 잇는 줄(80de4) 차례 그대로.
 */
export function WindowBack({ uiOrigins, isTraining, tabMarkAt }: WindowBackProps) {
  const inner = PITCH_TRAINING_INNER
  return (
    <>
      {/* 8046c 공용 판 — 필살타법 창과 같은 인자 */}
      <CommonPanel
        x={PITCH_TRAINING_PANEL.x}
        y={PITCH_TRAINING_PANEL.y}
        width={PITCH_TRAINING_PANEL.width}
        height={PITCH_TRAINING_PANEL.height}
        topBand={0x10}
        titleTab
        testId="구질훈련-판"
      />
      {/* 0x802dc — 박스 2 칠 · 위(x..x+w−1, y) · 왼(x, y..y+h) #0A266F · 아래(x+1..x+w−1, y+h) · 오른(x+w−1, y+1..y+h) #5683F5 */}
      <svg style={FULL_LAYER} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
        <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={PITCH_TRAINING_INNER_COLORS.fill} />
        <rect x={inner.x} y={inner.y} width={inner.width} height={1} fill={PITCH_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x} y={inner.y} width={1} height={inner.height + 1} fill={PITCH_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x + 1} y={inner.y + inner.height} width={inner.width - 1} height={1} fill={PITCH_TRAINING_INNER_COLORS.lit} />
        <rect x={inner.x + inner.width - 1} y={inner.y + 1} width={1} height={inner.height} fill={PITCH_TRAINING_INNER_COLORS.lit} />
      </svg>
      <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_LAYOUT_FRAME} origins={uiOrigins} x={0} y={0} />
      <FrameSprite
        folder={MODE_UI}
        frame={PITCH_TRAINING_TAB_STRIP.frame}
        origins={uiOrigins}
        x={PITCH_TRAINING_TAB_STRIP.x}
        y={PITCH_TRAINING_TAB_STRIP.y}
      />
      {/* 805a8 — 상태 ≠ 0x7b 일 때만 */}
      {isTraining && <img alt="" src={G_COIN.src} style={{ position: 'absolute', left: G_COIN.x, top: G_COIN.y }} />}
      <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_TREE_FRAME} origins={uiOrigins} x={0} y={0} />
      {tabMarkAt !== null && (
        <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_TAB_MARK_FRAME} origins={uiOrigins} x={tabMarkAt.x} y={tabMarkAt.y} />
      )}
      <svg style={FULL_LAYER} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
        {PITCH_TRAINING_CONNECTORS.map((box) => (
          <rect key={`${box.x},${box.y}`} x={box.x} y={box.y} width={box.width} height={box.height} fill={PITCH_TRAINING_CONNECTOR_COLOR} />
        ))}
      </svg>
    </>
  )
}
