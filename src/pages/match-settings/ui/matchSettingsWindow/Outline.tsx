import type { RoundOutline, SettingsBox } from '@/pages/match-settings/lib/matchSettingsLayout'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'

/** 둥근 테 0x6aa64(둥글기 1) — (x+1..R−1, y) · (x+1..R−1, B) · (x, y+1..B−1) · (R, y+1..B−1), R = x + w · B = y + h */
export function Outline({ outline }: { readonly outline: RoundOutline }) {
  const { x, y, width, height, color } = outline
  const lines: readonly SettingsBox[] = [
    { x: x + 1, y, width: width - 1, height: 1 },
    { x: x + 1, y: y + height, width: width - 1, height: 1 },
    { x, y: y + 1, width: 1, height: height - 1 },
    { x: x + width, y: y + 1, width: 1, height: height - 1 },
  ]
  return (
    <span data-outline={color} data-x={x} data-y={y}>
      {lines.map((line, index) => (
        <span
          key={index}
          className={styles.outlineLine}
          style={{ left: line.x, top: line.y, width: line.width, height: line.height, background: color }}
        />
      ))}
    </span>
  )
}
