import { linePixels, scanlineSpans } from '@/features/play-game/model/aceCutIn'
import { MATCH_INFO_BANNER_COLORS, matchInfoBannersOf } from '@/pages/management/lib/matchInfoEntry'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

/**
 * 경기정보(공용 목록 k 4) 들어올 때 배너 둘 — 0x54790 (스캔라인 채우기 0x75c70 · 테두리 0x75dc4 · 윗변 아래 선 셋 0x6a905).
 * 일반모드 22(0x2e0c4) · 시즌 0xdd(0xb398) · 나리 142(0x15d98) 가 같은 0x63b14 갈래로 그린다 (`lib/matchInfoEntry`).
 */
export function MatchInfoEntryBanners({ offset, testId }: { readonly offset: number; readonly testId: string }) {
  return (
    <svg
      className={styles.layer}
      viewBox="0 0 240 320"
      width={240}
      height={320}
      shapeRendering="crispEdges"
      data-testid={testId}
      data-offset={offset}
      style={{ left: 0, top: 0 }}
    >
      {matchInfoBannersOf(offset).map((banner, index) => (
        <g key={index}>
          {scanlineSpans(banner.points).map((span) => (
            <rect
              key={`f${span.y}-${span.x0}`}
              x={span.x0}
              y={span.y}
              width={span.x1 - span.x0 + 1}
              height={1}
              fill={MATCH_INFO_BANNER_COLORS.fill}
            />
          ))}
          {banner.points
            .flatMap((point, corner) => linePixels(point, banner.points[(corner + 1) % banner.points.length]))
            .map((pixel, pixelIndex) => (
              <rect key={`b${pixelIndex}`} x={pixel.x} y={pixel.y} width={1} height={1} fill={MATCH_INFO_BANNER_COLORS.border} />
            ))}
          {banner.lines.flatMap((line, lineIndex) =>
            linePixels(line.from, line.to).map((pixel, pixelIndex) => (
              <rect key={`l${lineIndex}-${pixelIndex}`} x={pixel.x} y={pixel.y} width={1} height={1} fill={line.color} />
            )),
          )}
        </g>
      ))}
    </svg>
  )
}
