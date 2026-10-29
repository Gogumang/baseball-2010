import { useEffect } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { radarGrowthAt, radarGrowthStart } from '@/shared/lib/radarGrowth/radarGrowth'
import type { RadarGrowthState } from '@/shared/lib/radarGrowth/radarGrowth'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import {
  DETAIL_RADAR,
  DETAIL_RADAR_AXES,
  DETAIL_RADAR_LABELS,
  abilityChartFrameOf,
  abilityChartVerticesOf,
  yearCellDrawingOf,
} from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { IMG_TEXT_FRAMES, SLT_FRAME, pad, pixel } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailAssets'
import { CellNumber } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailPrimitives'

/**
 * 0x5aefc 가 쓰는 레이더 객체 [skin+0xd8] — 앱에 하나라 지난 목표값이 창을 건너 산다(`radarGrowth` 의 특이점과 같다).
 * ⚠️ 유력: 엔트리 편집기 ed 도 같은 칸 배치(+0x424 창 · +0xa4 글꼴 · +0xd8 레이더)를 써 교체 창의 skin 과 같은 객체로 본다.
 */
const detailRadarObject: { previous: readonly number[]; hasPrevious: boolean } = { previous: [0, 0, 0, 0], hasPrevious: false }

/** 도형 자람의 시작 — 열쇠(다시 열기 · 능력)가 바뀐 그림에서 지난 목표값(detailRadarObject)으로 새로 만든다 */
function radarStartOf(previous: { readonly key: string; readonly start: RadarGrowthState } | null, key: string) {
  if (previous !== null && previous.key === key) return previous
  return { key, start: radarGrowthStart(detailRadarObject.previous, detailRadarObject.hasPrevious, 4, false) }
}

/**
 * 능력치 도형 0x5aefc(종류 3 · 2, 반지름 22) — 바탕 slt_frame 3 (가운데 − 31 · 뒤집어 가운데 − 1) · 바탕 테두리 0x7633c(고정 29, #6B92F4) ·
 * 값 도형(자람 0x760e8, 레이더 객체 [skin+0xd8]) · 축 줄 · 이름 상자 slt_frame 17 · 이름 · 숫자.
 * ⚠️ 유력: 숫자 색(기본값 `0xb6414(rec, k, 0)` 과의 비교)은 기본값이 웹 명단에 없어 흰색으로 둔다. 꼭짓점 그림(프레임 8~11)은 웹에 근거가 없다.
 */
export function DetailRadar({
  abilities,
  isPitcher,
  draw,
  restartKey,
  center,
}: {
  readonly abilities: readonly number[]
  readonly isPitcher: boolean
  readonly draw: number
  readonly restartKey: number
  readonly center: { readonly x: number; readonly y: number }
}) {
  // '0' · 위아래가 +0x1e3 = 0 — 다음 그림의 0x75ebc 가 지난 목표값(+0xad 면)에서 다시 만든다
  const key = `${restartKey}:${abilities.join(',')}`
  const { start } = useRenderMachine(radarStartOf, key)
  const state = radarGrowthAt(start, abilities, Math.max(0, draw))
  useEffect(() => {
    detailRadarObject.previous = state.previous
    detailRadarObject.hasPrevious = state.hasPrevious
  })
  const points = abilityChartVerticesOf(center, state.current, DETAIL_RADAR.radius)
  const labels = DETAIL_RADAR_LABELS[isPitcher ? 'pitcher' : 'batter']
  const polygon = (list: readonly { x: number; y: number }[]) => list.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <div data-testid="선수 정보 도형">
      <img alt="" src={`${SLT_FRAME}/003.png`} style={{ ...pixel, left: center.x - 31, top: center.y - 31 }} />
      <img alt="" src={`${SLT_FRAME}/003.png`} style={{ ...pixel, left: center.x - 1, top: center.y - 31, transform: 'scaleX(-1)' }} />
      <svg
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        width={240}
        height={320}
        viewBox="0 0 240 320"
        shapeRendering="crispEdges"
      >
        <polygon points={polygon(abilityChartFrameOf(center))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} />
        <polygon points={polygon(points)} fill={ORIGINAL_COLORS.highlightYellow} fillOpacity={0xb4 / 0xff} stroke={ORIGINAL_COLORS.text} />
        {DETAIL_RADAR_AXES.map((axis, index) => (
          <line
            key={index}
            x1={center.x + axis.end.x}
            y1={center.y + axis.end.y}
            x2={points[index]?.x}
            y2={points[index]?.y}
            stroke={ORIGINAL_COLORS.radarAxis}
          />
        ))}
      </svg>
      {DETAIL_RADAR_AXES.map((axis, index) => {
        const box = { x: center.x + axis.box.x, y: center.y + axis.box.y }
        const value = state.current[index] ?? 0
        return (
          <div key={index}>
            <img alt="" src={`${SLT_FRAME}/017.png`} style={{ ...pixel, left: box.x, top: box.y }} />
            <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(labels[index])}.png`} style={{ ...pixel, left: box.x + 3, top: box.y + 3 }} />
            {/* 0x6aff8(상자 x + 0x12, 상자 y + 0x11, 값, −1, num 0x14, 앵커 4) — `yearCellDrawingOf` 는 칸 x + 0x18 기준이라 옮긴다 */}
            <CellNumber drawing={yearCellDrawingOf({ value, digits: -1, isDecimal: false })} x={box.x + 0x12 - 0x18} y={box.y + 0x11 - 3} />
          </div>
        )
      })}
    </div>
  )
}
