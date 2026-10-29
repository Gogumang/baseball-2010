import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  SPECIAL_TRAINING_DESCRIPTION_BOX,
  SPECIAL_TRAINING_INNER,
  SPECIAL_TRAINING_INNER_COLORS,
  SPECIAL_TRAINING_NAME_BOX,
  SPECIAL_TRAINING_NAME_COLOR,
} from '@/widgets/special-swing/lib/specialTrainingWindow'
import { SCREEN, layer } from '@/widgets/special-swing/ui/specialTrainingFigure/figureAssets'

/** 0x802dc — 박스 2 칠 · 위(x..x+w−1, y) · 왼(x, y..y+h) #0A266F · 아래(x+1..x+w−1, y+h) · 오른(x+w−1, y+1..y+h) #5683F5 */
export function TrainingInnerBox() {
  const inner = SPECIAL_TRAINING_INNER
  return (
    <svg style={layer} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
      <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={SPECIAL_TRAINING_INNER_COLORS.fill} />
      <rect x={inner.x} y={inner.y} width={inner.width} height={1} fill={SPECIAL_TRAINING_INNER_COLORS.shade} />
      <rect x={inner.x} y={inner.y} width={1} height={inner.height + 1} fill={SPECIAL_TRAINING_INNER_COLORS.shade} />
      <rect x={inner.x + 1} y={inner.y + inner.height} width={inner.width - 1} height={1} fill={SPECIAL_TRAINING_INNER_COLORS.lit} />
      <rect x={inner.x + inner.width - 1} y={inner.y + 1} width={1} height={inner.height} fill={SPECIAL_TRAINING_INNER_COLORS.lit} />
    </svg>
  )
}

/** 고른 칸 이름 — 박스 가운데 */
export function TrainingName({ name }: { readonly name: string }) {
  return (
    <div
      data-testid="필살타법-이름"
      style={{
        position: 'absolute',
        left: SPECIAL_TRAINING_NAME_BOX.x,
        top: SPECIAL_TRAINING_NAME_BOX.y,
        width: SPECIAL_TRAINING_NAME_BOX.width,
        height: SPECIAL_TRAINING_NAME_BOX.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: SPECIAL_TRAINING_NAME_COLOR,
        fontSize: '11px',
        lineHeight: '13px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {name}
    </div>
  )
}

/** 고른 칸 설명 — 게임 글 꾸밈(색 바꿈)을 줄마다 */
export function TrainingDescription({ text }: { readonly text: string }) {
  const lines = parseGameMarkup(text)
  return (
    <div
      data-testid="필살타법-설명"
      style={{
        position: 'absolute',
        left: SPECIAL_TRAINING_DESCRIPTION_BOX.x,
        top: SPECIAL_TRAINING_DESCRIPTION_BOX.y,
        color: '#FFFFFF',
        fontSize: '11px',
        lineHeight: '13px',
        pointerEvents: 'none',
      }}
    >
      {lines.map((line, index) => (
        <p key={index} style={{ margin: 0, whiteSpace: 'pre' }}>
          {line.segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}
