import type { CSSProperties } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { yearCellDrawingOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { abilityChartFrameOf, abilityGrowthVerticesOf } from '@/pages/create-player/lib/teamSelectLayout'
import type { ChartPoint } from '@/pages/create-player/lib/teamSelectLayout'
import { ABILITY_FILL_ALPHA } from '@/pages/create-player/ui/AbilityGrowthPolygon'
import {
  ABILITY_RADAR_BACK, ABILITY_RADAR_BOX, ABILITY_RADAR_EMPTY, abilityRadarAxesOf,
} from '@/pages/create-player/lib/abilityRadarPanel'

const SLT_FRAME = './sprites/slt_frame'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const NUM = './sprites/num'
const pad = (index: number) => String(index).padStart(3, '0')
const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }
/** `yearCellDrawingOf` 는 칸 x + 0x18 기준이라 옮긴다 (숫자 윗변 = 상자 y + 0x11 — 교체 창 `DetailRadar` 와 같다) */
const CELL_DIGIT_X = 0x18

/**
 * **ABILITY 판** — 능력치 도형 0x5aefc 를 통째로 (`lib/abilityRadarPanel` 머리말의 차례):
 * 둥근 바탕(slt_frame 3 두 쪽) · 바탕 테두리 · 값 도형(레이더 [skin+0xd4] 의 자라는 애니) · 축 선 · 이름 상자 · 이름 · 숫자 또는 "???".
 * 숫자는 **지금값**(자라는 중의 값)을 찍어 도형과 같이 오른다. 값이 0 인 축(빈 칸·자라기 전)은 "???" 다.
 */
export function AbilityRadarPanel({ center, radius, maximumLength, labelFrames, targets, restartKey }: {
  readonly center: ChartPoint
  /** [anim+0x1d8] — 마선수 · 명전 목록 30 */
  readonly radius: number
  /** 값 도형 최대길이 = 반지름 × 축 최대치 / 999 (마선수 999 → 30 · 명전 800 → 24) */
  readonly maximumLength: number
  /** 축 이름 img_text 네 개 (`ABILITY_RADAR_LABELS`) */
  readonly labelFrames: readonly number[]
  /** 네 값 — 비면 0 네 개 */
  readonly targets: readonly number[]
  /** 바뀐 그림에서 지난 목표값부터 다시 오르내린다 (목록 커서 +0x25 → +0x1e3 = 0) */
  readonly restartKey: string | number
}) {
  const goal = targets.length === 0 ? [0, 0, 0, 0] : targets
  const current = useRadarGrowth(goal, { restartKey })
  const vertices = abilityGrowthVerticesOf(center, current, maximumLength)
  const axes = abilityRadarAxesOf(center, radius)
  const points = (list: readonly ChartPoint[]) => list.map((point) => `${point.x},${point.y}`).join(' ')
  const back = `${SLT_FRAME}/${pad(ABILITY_RADAR_BACK.image)}.png`
  const emptyWidth = measurePixelTextWidth(ABILITY_RADAR_EMPTY.text)
  return (
    <div data-testid="능력치 도형" aria-label="능력치 도형">
      <img alt="" src={back} style={{ ...pixel, left: center.x - ABILITY_RADAR_BACK.width, top: center.y - ABILITY_RADAR_BACK.width }} />
      <img alt="" src={back}
        style={{ ...pixel, left: center.x - 1, top: center.y - ABILITY_RADAR_BACK.width, transform: 'scaleX(-1)' }} />
      <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} width={240} height={320} viewBox="0 0 240 320"
        shapeRendering="crispEdges">
        <polygon points={points(abilityChartFrameOf(center))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} strokeWidth={1} />
        {current.some((value) => value !== 0) && (
          <polygon data-part="values" points={points(vertices)}
            fill={ORIGINAL_COLORS.radarFill} fillOpacity={ABILITY_FILL_ALPHA} stroke={ORIGINAL_COLORS.radarEdge} strokeWidth={1} />
        )}
        {axes.map((axis, index) => (
          <line key={index} x1={axis.end.x} y1={axis.end.y} x2={vertices[index]?.x} y2={vertices[index]?.y}
            stroke={ORIGINAL_COLORS.radarAxis} strokeWidth={1} />
        ))}
      </svg>
      {axes.map((axis, index) => {
        const { box } = axis
        const value = current[index] ?? 0
        const label = labelFrames[index]
        return (
          <div key={index} data-part="axis">
            <img alt="" src={`${SLT_FRAME}/${pad(ABILITY_RADAR_BOX.image)}.png`} style={{ ...pixel, left: box.x, top: box.y }} />
            {label !== undefined && (
              <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(label)}.png`}
                style={{ ...pixel, left: box.x + ABILITY_RADAR_BOX.labelInset, top: box.y + ABILITY_RADAR_BOX.labelInset }} />
            )}
            {value > 0
              ? yearCellDrawingOf({ value, digits: -1, isDecimal: false }).glyphs.map((glyph, glyphIndex) => (
                  <img key={glyphIndex} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} data-part="value"
                    style={{
                      ...pixel,
                      left: box.x + ABILITY_RADAR_BOX.numberDx - CELL_DIGIT_X + glyph.x,
                      top: box.y + ABILITY_RADAR_BOX.numberDy,
                    }} />
                ))
              : [0, 1].map((dx) => (
                  <PixelText key={dx}
                    style={{
                      position: 'absolute', pointerEvents: 'none', color: ABILITY_RADAR_EMPTY.color, whiteSpace: 'nowrap',
                      left: box.x + ((ABILITY_RADAR_BOX.width - emptyWidth) >> 1) + dx, top: box.y + ABILITY_RADAR_BOX.numberDy,
                    }}>
                    {ABILITY_RADAR_EMPTY.text}
                  </PixelText>
                ))}
          </div>
        )
      })}
    </div>
  )
}
