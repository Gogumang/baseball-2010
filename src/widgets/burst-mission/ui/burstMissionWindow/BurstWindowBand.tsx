import {
  BURST_BAND_HEIGHT,
  BURST_BAND_SLASH_LENGTH,
  BURST_BAND_SLASH_X,
  BURST_COLORS,
  BURST_SCREEN,
  burstBandTopOf,
} from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import * as styles from '@/widgets/burst-mission/ui/BurstMissionWindow.css'

/** 판 — 0x8f194 윗 띠(가장자리 · 밝은 줄 · 칠 · 빗금) · 0x8f392 본체(검정 알파 0xB4). `height` 는 판 높이 [+0x21c] */
export function BurstWindowBand({ height }: { readonly height: number }) {
  const bandTop = burstBandTopOf(height)
  const bodyTop = BURST_SCREEN.height - height
  return (
    <svg
      className={styles.layer}
      width={BURST_SCREEN.width}
      height={BURST_SCREEN.height}
      viewBox={`0 0 ${BURST_SCREEN.width} ${BURST_SCREEN.height}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {/* 0x8f194 윗 띠 */}
      <rect x={0} y={bandTop} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT} fill={BURST_COLORS.bandEdge} />
      <rect x={0} y={bandTop + 1} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT - 2} fill={BURST_COLORS.bandLight} />
      <rect x={0} y={bandTop + 2} width={BURST_SCREEN.width} height={BURST_BAND_HEIGHT - 2} fill={BURST_COLORS.bandFill} />
      {Array.from({ length: BURST_BAND_SLASH_LENGTH }, (_, i) => {
        const x = BURST_BAND_SLASH_X + i
        const y = bandTop + BURST_BAND_HEIGHT - 1 - i
        return (
          <g key={i}>
            <rect x={x} y={y} width={1} height={1} fill={BURST_COLORS.bandEdge} />
            <rect x={x - 1} y={y} width={1} height={1} fill={BURST_COLORS.bandLight} />
            <rect x={x + 1} y={y} width={1} height={1} fill={BURST_COLORS.bandLight} />
          </g>
        )
      })}
      {/* 0x8f392 본체 — 검정 알파 0xB4 */}
      <rect x={0} y={bodyTop} width={BURST_SCREEN.width} height={height} fill={BURST_COLORS.body} />
    </svg>
  )
}
