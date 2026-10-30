import * as styles from '@/features/play-team-game/ui/InGameMenu.css'

/**
 * 둥근 칠 0x6b7d4(x, y, w, h, 둥글기 4, 색) — 칠(x+1, y+1, w−1, h−1) 위에 두 칸 안쪽에서 시작하는 선 넷, (w+1)×(h+1)
 * (`shared/lib/commonPanel` 의 `roundFillOf` 와 같은 식)
 */
export function RoundFill({
  x,
  y,
  width: w,
  height: h,
  color,
}: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}) {
  return (
    <svg
      className={styles.paint}
      width={w + 1}
      height={h + 1}
      viewBox={`0 0 ${w + 1} ${h + 1}`}
      shapeRendering="crispEdges"
      style={{ left: x, top: y }}
      aria-hidden
    >
      <rect x={1} y={1} width={w - 1} height={h - 1} fill={color} />
      <rect x={2} y={0} width={w - 3} height={1} fill={color} />
      <rect x={2} y={h} width={w - 3} height={1} fill={color} />
      <rect x={0} y={2} width={1} height={h - 3} fill={color} />
      <rect x={w} y={2} width={1} height={h - 3} fill={color} />
    </svg>
  )
}
