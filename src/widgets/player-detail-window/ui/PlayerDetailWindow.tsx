import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { FrameSprite } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { yearCellDrawingOf, yearLabelOffsetOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { radarGrowthAt, radarGrowthStart } from '@/shared/lib/radarGrowth/radarGrowth'
import type { RadarGrowthState } from '@/shared/lib/radarGrowth/radarGrowth'
import { abilityChartFrameOf, abilityChartVerticesOf } from '@/pages/create-player/lib/teamSelectLayout'
import { roundFillRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { SKIN_TICKER_CLIP_INSET, SKIN_TICKER_STEP, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import {
  BATTER_DETAIL_ROWS,
  DETAIL_COLORS,
  DETAIL_LABEL_CELL,
  DETAIL_LABEL_DX,
  DETAIL_LABEL_DY,
  DETAIL_RADAR,
  DETAIL_RADAR_AXES,
  DETAIL_RADAR_LABELS,
  DETAIL_VALUE_CELL,
  DETAIL_VALUE_DX,
  DETAIL_WINDOW,
  PITCHER_DETAIL_ROWS,
  detailRadarCenterOf,
  detailWindowFrameAt,
  roundEdgeRectsOf,
} from '@/widgets/player-detail-window/lib/playerDetailWindow'
import type { DetailWindowOrigin, PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const SLT_FRAME = './sprites/slt_frame'
const NUM = './sprites/num'
const pad = (index: number) => String(index).padStart(3, '0')
const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }

/**
 * 0x5aefc 가 쓰는 레이더 객체 [skin+0xd8] — 앱에 하나라 지난 목표값이 창을 건너 산다(`radarGrowth` 의 특이점과 같다).
 * ⚠️ 유력: 엔트리 편집기 ed 도 같은 칸 배치(+0x424 창 · +0xa4 글꼴 · +0xd8 레이더)를 써 교체 창의 skin 과 같은 객체로 본다.
 */
const detailRadarObject: { previous: readonly number[]; hasPrevious: boolean } = { previous: [0, 0, 0, 0], hasPrevious: false }

function Rect({ x, y, width, height, color }: {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string
}) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color }} />
}

/** 둥근 칠 0x6b7d4 (둥글기 1) */
function RoundFill({ x, y, width, height, color }: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string }) {
  return (
    <>
      {roundFillRectsOf({ x, y, width, height, round: 1 }).map((rect, index) => <Rect key={index} {...rect} color={color} />)}
    </>
  )
}

/** 0xb9d75 꼴 0x22 — (x, y, 폭, 15) 안 가운데 */
function CenteredImgText({ origins, frame, x, y, width }: {
  readonly origins: FrameOrigins | null; readonly frame: number; readonly x: number; readonly y: number; readonly width: number
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const offset = yearLabelOffsetOf(width, origin.width, origin.height)
  return <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`} style={{ ...pixel, left: x + offset.x, top: y + offset.y }} />
}

/** 0x6aff8(…, num 0x14, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽(칸 x + 0x18 기준) */
function CellNumber({ drawing, x, y }: { readonly drawing: ReturnType<typeof yearCellDrawingOf>; readonly x: number; readonly y: number }) {
  return (
    <>
      {drawing.glyphs.map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + glyph.x, top: y + 3 }} />
      ))}
      {drawing.dots.map((dot, index) => (
        <Rect key={`d${index}`} x={x + dot.x} y={y + dot.y} width={1} height={2} color={ORIGINAL_COLORS.text} />
      ))}
    </>
  )
}

export interface PlayerDetailWindowProps {
  readonly detail: PlayerDetail
  /** 창 자리 — '0' 키가 세운 첫 x · y (`SUBSTITUTION_DETAIL_ORIGIN` · `ENTRY_DETAIL_ORIGIN`) */
  readonly origin: DetailWindowOrigin
  /** 연 뒤 그림 수 ([+0x424] 를 켠 뒤) */
  readonly draw: number
  /** 도형을 다시 만든(+0x1e3 = 0) 뒤 그림 수 */
  readonly radarDraw: number
  /** 도형을 다시 만든 차례 — 바뀌면 지난 목표값에서 다시 자란다 */
  readonly radarKey: number
}

/**
 * **선수 정보 창 0x5b798** ('0' INFO — 종류 3 투수 · 2 타자). 창 걸음 · 칸 · 값의 근거는 `lib/playerDetailWindow`.
 * 교체 창(0x381e8)과 엔트리 목록 창(0x5c984 끝 0x5cfc8)이 같이 쓴다 — 다른 것은 '0' 키가 세운 창 자리뿐이다.
 */
export function PlayerDetailWindow({ detail, origin, draw, radarDraw, radarKey }: PlayerDetailWindowProps) {
  const gameUi = useFrameOrigins(GAME_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const frame = detailWindowFrameAt(draw, origin)
  const { x, width } = frame
  const y = origin.y
  const height = DETAIL_WINDOW.height
  const isPitcher = detail.kind === '투수'
  const rows = isPitcher ? PITCHER_DETAIL_ROWS : BATTER_DETAIL_ROWS
  // 다 열린 그림은 흐르는 글 칸마다 0x5a8c8 이 한 번씩 돌아 [skin+0x284] 가 3 × 칸 수만큼 오른다
  const tickerCount = frame.isOpen ? rows.filter((_, index) => detail.values[index]?.kind === 'ticker').length : 0
  const tickerCounter = useSkinTickerCounter(draw, tickerCount)
  const openDraw = openDrawOf(origin)
  let tickerIndex = 0
  return (
    <div data-testid="선수 정보 창">
      <RoundFill x={x} y={y} width={width} height={height} color={DETAIL_COLORS.outer} />
      {roundEdgeRectsOf(x + 1, y + 1, width - 2, height - 2).map((rect, index) => <Rect key={index} {...rect} color={DETAIL_COLORS.edge} />)}
      {[[x + 2, y + 2], [x + width - 2, y + 2], [x + 2, y + height - 2], [x + width - 2, y + height - 2]].map(([px, py], index) => (
        <Rect key={`p${index}`} x={px} y={py} width={1} height={1} color={DETAIL_COLORS.edge} />
      ))}
      <RoundFill x={x + 2} y={y + 2} width={width - 4} height={height - 4} color={DETAIL_COLORS.white} />
      <RoundFill x={x + 4} y={y + 4} width={width - 8} height={height - 8} color={DETAIL_COLORS.edge} />
      {/* 0xbae25(x + 5, y + 5, w − 10, h − 10) — 안쪽은 이 칸으로 자른다 */}
      <div style={{ position: 'absolute', left: x + 5, top: y + 5, width: width - 10, height: height - 10, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: -(x + 5), top: -(y + 5), width: 240, height: 320 }}>
          {frame.isOpen && (
            // 도형은 창이 다 열린 그림부터 그린다([+0x425], 0x5b838) — 그 전 그림은 자람 걸음을 안 굴린다
            <DetailRadar abilities={detail.abilities} isPitcher={isPitcher} restartKey={radarKey} center={detailRadarCenterOf(origin, isPitcher)}
              draw={Math.min(radarDraw, draw - openDraw)} />
          )}
          {rows.map((row, index) => {
            const value = detail.values[index]
            const labelX = x + DETAIL_LABEL_DX
            const valueX = x + DETAIL_VALUE_DX
            const textY = y + row.textDy
            let content: ReactNode = null
            if (value?.kind === 'text') {
              const textWidth = measurePixelTextWidth(value.text)
              content = (
                <PixelText style={{ ...pixel, left: valueX + ((54 - textWidth) >> 1), top: textY + 2, color: ORIGINAL_COLORS.text }}>
                  {value.text}
                </PixelText>
              )
            } else if (value?.kind === 'ticker' && frame.isOpen) {
              // 0x5a8c8 — 한 그림의 k 번째 흐르는 글은 카운터 c + 3k 로 그려진다
              content = <DetailTicker text={value.text} x={valueX} y={textY + 2} counter={tickerCounter + SKIN_TICKER_STEP * tickerIndex} />
              tickerIndex += 1
            }
            return (
              <div key={index} data-testid={`선수 정보 줄 ${index}`} aria-label={value?.text}>
                <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_LABEL_CELL} origins={gameUi} x={labelX} y={y + row.cellDy} />
                <CenteredImgText origins={imgText} frame={row.labelFrame} x={labelX} y={y + row.labelDy + DETAIL_LABEL_DY} width={25} />
                <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_VALUE_CELL} origins={gameUi} x={valueX} y={y + row.cellDy} />
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 창이 다 열리는(+0x425 = 1) 첫 그림 */
function openDrawOf(origin: DetailWindowOrigin): number {
  let draw = 0
  while (!detailWindowFrameAt(draw, origin).isOpen) draw += 1
  return draw
}

/** 흐르는 글 0x5a8c8(skin, 글, x, y, 54, 15, _, 자르기 1, 올리기 1) */
function DetailTicker({ text, x, y, counter }: { readonly text: string; readonly x: number; readonly y: number; readonly counter: number }) {
  const width = 54
  const textWidth = measurePixelTextWidth(text)
  const clipLeft = x + SKIN_TICKER_CLIP_INSET
  return (
    <div style={{ position: 'absolute', left: clipLeft, top: y, width: width - SKIN_TICKER_CLIP_INSET * 2, height: 15, overflow: 'hidden' }}>
      <PixelText style={{ position: 'absolute', left: skinTickerTextXOf(x, width, counter, textWidth) - clipLeft, top: 0, color: ORIGINAL_COLORS.text, whiteSpace: 'nowrap' }}>
        {text}
      </PixelText>
    </div>
  )
}

/**
 * 능력치 도형 0x5aefc(종류 3 · 2, 반지름 22) — 바탕 slt_frame 3 (가운데 − 31 · 뒤집어 가운데 − 1) · 바탕 테두리 0x7633c(고정 29, #6B92F4) ·
 * 값 도형(자람 0x760e8, 레이더 객체 [skin+0xd8]) · 축 줄 · 이름 상자 slt_frame 17 · 이름 · 숫자.
 * ⚠️ 유력: 숫자 색(기본값 `0xb6414(rec, k, 0)` 과의 비교)은 기본값이 웹 명단에 없어 흰색으로 둔다. 꼭짓점 그림(프레임 8~11)은 웹에 근거가 없다.
 */
function DetailRadar({ abilities, isPitcher, draw, restartKey, center }: {
  readonly abilities: readonly number[]; readonly isPitcher: boolean; readonly draw: number; readonly restartKey: number
  readonly center: { readonly x: number; readonly y: number }
}) {
  const startRef = useRef<{ key: string; start: RadarGrowthState } | null>(null)
  // '0' · 위아래가 +0x1e3 = 0 — 다음 그림의 0x75ebc 가 지난 목표값(+0xad 면)에서 다시 만든다
  const key = `${restartKey}:${abilities.join(',')}`
  if (startRef.current === null || startRef.current.key !== key) {
    startRef.current = { key, start: radarGrowthStart(detailRadarObject.previous, detailRadarObject.hasPrevious, 4, false) }
  }
  const state = radarGrowthAt(startRef.current.start, abilities, Math.max(0, draw))
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
      <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} width={240} height={320} viewBox="0 0 240 320" shapeRendering="crispEdges">
        <polygon points={polygon(abilityChartFrameOf(center))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} />
        <polygon points={polygon(points)} fill={ORIGINAL_COLORS.highlightYellow} fillOpacity={0xb4 / 0xff} stroke={ORIGINAL_COLORS.text} />
        {DETAIL_RADAR_AXES.map((axis, index) => (
          <line key={index} x1={center.x + axis.end.x} y1={center.y + axis.end.y} x2={points[index]?.x} y2={points[index]?.y}
            stroke={ORIGINAL_COLORS.radarAxis} />
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
