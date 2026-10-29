import { ORIGINAL_COLORS } from '@/shared/config/design'
import { EVENT_DIALOGUE, EVENT_DIALOGUE_CHOICE, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/story/ui/EventDialogueBox.css'

const SPLIT = EVENT_DIALOGUE.bandSplit
const SLOPE = EVENT_DIALOGUE.bandHeight - 1

/** 0x7cfc8 윗 띠(꺾임 계단) · 0xb9f74 본체 — 높이 `height` 로 올라온 상자 */
export function DialogueBoxBody({ height }: { readonly height: number }) {
  const boxTop = SCREEN_HEIGHT - height
  const bandTop = boxTop - EVENT_DIALOGUE.bandHeight
  const bandBottom = bandTop + EVENT_DIALOGUE.bandHeight - 1
  return (
    <svg
      className={styles.layer}
      style={{ left: 0, top: 0 }}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
      shapeRendering="crispEdges"
    >
      {/* 0x7cfc8 윗 띠 — 바깥 #12307E · 안 #1D44A8 · 꺾임 계단(높이 − 1 칸) · 밝은 줄 #3563D7 */}
      <rect data-part="띠" x={0} y={bandTop} width={SCREEN_WIDTH} height={EVENT_DIALOGUE.bandHeight} fill={ORIGINAL_COLORS.bandDark} />
      <rect x={0} y={bandTop + 1} width={SCREEN_WIDTH} height={EVENT_DIALOGUE.bandHeight - 2} fill={ORIGINAL_COLORS.panelDeep} />
      {Array.from({ length: SLOPE }, (_unused, index) => (
        <g key={index}>
          <rect x={SPLIT + index} y={bandBottom - index} width={1} height={1} fill={ORIGINAL_COLORS.bandDark} />
          <rect x={SPLIT + index + 1} y={bandBottom - index} width={1} height={1} fill={ORIGINAL_COLORS.bandLight} />
        </g>
      ))}
      <rect x={SPLIT + SLOPE} y={bandTop + 1} width={SCREEN_WIDTH - SPLIT - SLOPE} height={1} fill={ORIGINAL_COLORS.bandLight} />
      {/* 0xb9f74 본체 — 검정 알파 0xB4 */}
      <rect data-part="본체" x={0} y={boxTop} width={SCREEN_WIDTH} height={height} fill="#000000" fillOpacity={EVENT_DIALOGUE.boxAlpha} />
    </svg>
  )
}

/** 0x6a978 — 고른 줄 노랑 테두리 (글 뒤에 그린다) */
export function ChoiceFrame({ top }: { readonly top: number }) {
  const { cursor } = EVENT_DIALOGUE_CHOICE
  return (
    <svg
      className={styles.layer}
      style={{ left: 0, top: 0 }}
      width={SCREEN_WIDTH}
      height={SCREEN_HEIGHT}
      viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
      shapeRendering="crispEdges"
      data-part="고른줄"
    >
      <rect
        x={cursor.x + 0.5}
        y={top + cursor.top + 0.5}
        width={cursor.width - 1}
        height={cursor.height - 1}
        fill="none"
        stroke={cursor.color}
        strokeWidth={1}
      />
    </svg>
  )
}
