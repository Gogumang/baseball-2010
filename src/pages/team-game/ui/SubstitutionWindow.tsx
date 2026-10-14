import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { CommonPanel, FrameSprite, PressArea, useImgTextPalette3 } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { CLEAR_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { yearCellDrawingOf, yearLabelOffsetOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { radarGrowthAt, radarGrowthStart } from '@/pages/management/lib/radarGrowth'
import type { RadarGrowthState } from '@/pages/management/lib/radarGrowth'
import { abilityChartFrameOf, abilityChartVerticesOf } from '@/pages/create-player/lib/teamSelectLayout'
import {
  BATTER_DETAIL_ROWS,
  DETAIL_COLORS,
  DETAIL_LABEL_CELL,
  DETAIL_LABEL_DX,
  DETAIL_RADAR,
  DETAIL_RADAR_AXES,
  DETAIL_RADAR_LABELS,
  DETAIL_VALUE_CELL,
  DETAIL_VALUE_DX,
  DETAIL_WINDOW,
  FIELDER_TYPE_COLORS,
  HEADER_TEXT_FRAMES,
  PITCHER_DETAIL_ROWS,
  SUBSTITUTION_WINDOW,
  changeFrameAt,
  cursorBoxOf,
  detailWindowFrameAt,
  isBlinkOut,
  movedListCursor,
  roundEdgeRectsOf,
} from '@/pages/team-game/lib/substitutionWindow'
import type { PlayerDetail, SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'
import { roundFillRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { SKIN_TICKER_CLIP_INSET, SKIN_TICKER_STEP, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const SLT_FRAME = './sprites/slt_frame'
const NUM = './sprites/num'
const TEAM_LOGO = './sprites/team_logo'
const pad = (index: number) => String(index).padStart(3, '0')
const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }

interface SubstitutionWindowProps {
  readonly kind: '투수' | '대타'
  readonly ourTeamId: number
  readonly current: SubstitutionRow
  readonly bench: readonly SubstitutionRow[]
  /** 그 벤치 칸(명단 칸)의 상세 창 값 (`playerDetailOf`) */
  readonly detailOf: (index: number) => PlayerDetail | null
  /** OK — 커서 줄의 명단 칸으로 교체를 확정한다 (0x495fc → 0x49598 · 상태 0x16) */
  readonly onConfirm: (index: number) => void
  /** '#' · CLR — 예약을 지우고 0xe 로 (0x495fc 0x49844) */
  readonly onCancel: () => void
}

/** 0x5aefc 가 쓰는 레이더 객체 [skin+0xd8] — 앱에 하나라 지난 목표값이 창을 건너 산다(`radarGrowth` 의 특이점과 같다) */
const detailRadarObject: { previous: readonly number[]; hasPrevious: boolean } = { previous: [0, 0, 0, 0], hasPrevious: false }

/**
 * **교체 창 0x384b8** — 투수 교체 · 대타 (배치 근거는 `lib/substitutionWindow` 머리말).
 * 키 0x495fc: '2'·↑ / '8'·↓ 목록(세로 감기) · OK·'5' 확정(상세 창이 떠 있으면 닫고 확정) · '0' 상세 창 · '#'·CLR 취소(부르는 쪽).
 * 마우스 길: 벤치 줄 누름 칸(커서 줄이면 OK, 아니면 커서를 옮긴다) · ▲▼ 화살 자리 · "0 INFO" 자리 · ⚠️ 웹 자리: 취소는 오른쪽 소프트키 자리.
 */
export function SubstitutionWindow({ kind, ourTeamId, current, bench, detailOf, onConfirm, onCancel }: SubstitutionWindowProps) {
  const tick = useSceneTick()
  const [list, setList] = useState({ cursor: 0, top: 0 })
  /** [skin+0x424] — 연 그림 수 (창 걸음 · 도형 자람). null 이면 닫힘 */
  const [detailOpenedAt, setDetailOpenedAt] = useState<number | null>(null)
  /** 도형을 다시 만든 그림 (+0x1e3 = 0 — '0' · 위아래) */
  const [radarRestartAt, setRadarRestartAt] = useState(0)
  const stateRef = useRef({ list, detailOpenedAt, tick })
  stateRef.current = { list, detailOpenedAt, tick }
  const latest = useRef({ bench, onConfirm })
  latest.current = { bench, onConfirm }

  const move = (dy: number) => {
    setList((value) => movedListCursor(value.cursor, value.top, latest.current.bench.length, dy))
    // 0x4962c — 상세 창이 떠 있으면 [[skin+0xd8]+0x1e3] = 0 (도형을 다시 만든다)
    if (stateRef.current.detailOpenedAt !== null) setRadarRestartAt(stateRef.current.tick)
  }
  const confirm = () => {
    const row = latest.current.bench[stateRef.current.list.cursor]
    setDetailOpenedAt(null)
    if (row !== undefined) latest.current.onConfirm(row.index)
  }
  const toggleDetail = () => {
    const opening = stateRef.current.detailOpenedAt === null
    setDetailOpenedAt(opening ? stateRef.current.tick : null)
    if (opening) setRadarRestartAt(stateRef.current.tick)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'ArrowUp' || event.key === '2') {
        event.preventDefault()
        move(-1)
      } else if (event.key === 'ArrowDown' || event.key === '8') {
        event.preventDefault()
        move(1)
      } else if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        confirm()
      } else if (event.key === '0') {
        event.preventDefault()
        toggleDetail()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // 키 처리는 stateRef · latest 로 지금 값을 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gameUi = useFrameOrigins(GAME_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const isPitcher = kind === '투수'
  const W = SUBSTITUTION_WINDOW
  const blinkOut = isBlinkOut(tick)
  const visible = bench.slice(list.top, list.top + W.bench.visibleRows)
  const cursorRow = list.cursor - list.top
  const detailRow = bench[list.cursor]
  const detail = detailOpenedAt === null || detailRow === undefined ? null : detailOf(detailRow.index)

  return (
    <div data-testid={isPitcher ? '투수 교체 창' : '타자 교체 창'}>
      {palette3.definition}
      <CommonPanel x={W.panel.x} y={W.panel.y} width={W.panel.width} height={W.panel.height} topBand={W.panel.topBand}
        bottomBand={W.panel.bottomBand} titleTab dim testId="교체 창 판" />
      <img alt="" src={`${GAME_UI}/${pad(W.arrows.upImage)}.png`} style={{ ...pixel, left: W.arrows.x, top: W.arrows.upY[blinkOut ? 0 : 1] }} />
      <img alt="" src={`${GAME_UI}/${pad(W.arrows.downImage)}.png`} style={{ ...pixel, left: W.arrows.x, top: W.arrows.downY[blinkOut ? 0 : 1] }} />
      {/* 사람 팀 큰 로고 — 1.5 배 · 섞기 7/32 (0xbb91d 종류 0x12) */}
      <img alt="" src={`${TEAM_LOGO}/${pad(ourTeamId)}.png`} data-testid="교체 창 로고"
        style={{ ...pixel, left: W.logo.centerX, top: W.logo.centerY, opacity: W.logo.opacity,
          transform: `translate(-50%, -50%) scale(${W.logo.scale})` }} />
      <img alt={isPitcher ? '투수' : '타자'} src={`${IMG_TEXT_FRAMES}/${pad(isPitcher ? W.title.pitcherFrame : W.title.batterFrame)}.png`}
        style={{ ...pixel, ...palette3.style, left: W.title.firstX, top: W.title.y }} />
      <img alt="교체" src={`${IMG_TEXT_FRAMES}/${pad(W.title.changeFrame)}.png`} style={{ ...pixel, left: W.title.secondX, top: W.title.y }} />

      {/* 지금 선수 칸 0x37904 — 머리 줄 + 값 줄 */}
      {HEADER_TEXT_FRAMES[isPitcher ? 'pitcher' : 'batter'].map((frame, column) => (
        <CenteredImgText key={column} origins={imgText} frame={frame} x={W.columnX[column]} y={W.current.headerY}
          width={W.columnWidth[column]} />
      ))}
      <RowCells row={current} y={W.current.cellY} isPitcher={isPitcher} gameUi={gameUi} imgText={imgText} testId="지금 선수" />
      <FrameSprite folder={GAME_UI_FRAMES} frame={changeFrameAt(tick)} origins={gameUi} x={W.change.x} y={W.change.y} />

      {/* 벤치 목록 0x37e5c — 6 줄 · 커서 상자 0x37dd4 */}
      {visible.map((row, offset) => (
        <RowCells key={row.index} row={row} y={W.bench.firstY + offset * W.bench.step} isPitcher={isPitcher} gameUi={gameUi}
          imgText={imgText} testId={`벤치 ${offset}`} />
      ))}
      {visible.length > 0 && <CursorBox rowY={W.bench.firstY + cursorRow * W.bench.step} tick={tick} />}
      {detail !== null && detailOpenedAt !== null && (
        <DetailWindow detail={detail} draw={tick - detailOpenedAt} radarDraw={tick - radarRestartAt} radarKey={radarRestartAt}
          gameUi={gameUi} imgText={imgText} />
      )}

      {/* 바닥 소프트키 자리 — game_ui 이미지 12 · "0 INFO" */}
      <img alt="" src={`${GAME_UI}/${pad(W.info.image)}.png`} style={{ ...pixel, left: W.info.x, top: W.info.y }} />
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={W.info.textFrame} origins={imgText} x={W.info.textX - 1} y={W.info.textY} />

      {visible.map((row, offset) => (
        <PressArea key={row.index} label={offset === cursorRow ? `${row.name} 교체` : `${row.name} 고르기`}
          rect={{ x: W.cursorBox.x, y: W.bench.firstY + offset * W.bench.step, width: W.cursorBox.width, height: W.cursorBox.height }}
          onPress={() => (offset === cursorRow ? confirm() : move(offset - cursorRow))} />
      ))}
      <PressArea label="위" rect={{ x: W.arrows.x, y: W.arrows.upY[0], width: 13, height: 10 }} onPress={() => move(-1)} />
      <PressArea label="아래" rect={{ x: W.arrows.x, y: W.arrows.downY[1], width: 13, height: 10 }} onPress={() => move(1)} />
      <PressArea label="0 INFO" rect={{ x: W.info.x, y: W.info.y, width: W.info.width, height: W.info.height }} onPress={toggleDetail} />
      {/* ⚠️ 웹 자리: '#' · CLR 은 원본 화면에 글자가 없다 — 오른쪽 소프트키 자리를 빌린다 */}
      <PressArea label="# 취소" rect={CLEAR_PRESS_RECT} onPress={onCancel} />
    </div>
  )
}

/** 0x5650c · 0xb9d75 꼴 0x22 — (x, y, 폭, 15) 안 가운데 */
function CenteredImgText({ origins, frame, x, y, width, style }: {
  readonly origins: FrameOrigins | null; readonly frame: number; readonly x: number; readonly y: number; readonly width: number
  readonly style?: CSSProperties
}) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const offset = yearLabelOffsetOf(width, origin.width, origin.height)
  return <img alt="" src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`} style={{ ...pixel, ...style, left: x + offset.x, top: y + offset.y }} />
}

/** 칸 넷 — 이름(game_ui 28) · 딱지 · 방어율/타율 · 탈삼진/홈런 (game_ui 35) */
function RowCells({ row, y, isPitcher, gameUi, imgText, testId }: {
  readonly row: SubstitutionRow; readonly y: number; readonly isPitcher: boolean
  readonly gameUi: FrameOrigins | null; readonly imgText: FrameOrigins | null; readonly testId: string
}) {
  const W = SUBSTITUTION_WINDOW
  const [nameX, badgeX, rateX, countX] = W.columnX
  // 0xba2e5(x − 1, y, 54, 15, 이름, 정렬 2(가로 가운데), dy 2) — 앱 글꼴 흰색
  const nameWidth = measurePixelTextWidth(row.name)
  const rate = row.rate === null ? null : isPitcher
    ? yearCellDrawingOf({ value: row.rate > 100 ? row.rate * 10 : row.rate, digits: 3, isDecimal: true })
    : yearCellDrawingOf({ value: row.rate, digits: row.rate > 999 ? 3 : 0, isDecimal: true })
  const count = row.count === null ? null : yearCellDrawingOf({ value: row.count, digits: -1, isDecimal: false })
  return (
    <div data-testid={`교체 줄 ${testId}`} aria-label={row.name}>
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.nameCellFrame} origins={gameUi} x={nameX} y={y} />
      <PixelText style={{ ...pixel, left: nameX - 1 + ((W.columnWidth[0] - nameWidth) >> 1), top: y + 2, color: ORIGINAL_COLORS.text }}>
        {row.name}
      </PixelText>
      {row.stamina !== null && (
        <>
          {/* 0x571d8 투수 — 녹 (0x1c, 0x93, 0) 두 줄 위에 빨 (0xff, 0x3c, 0x14) 두 줄 */}
          <Rect x={nameX + 3} y={y + W.cellHeight - 2} width={row.stamina.length + 1} height={2} color="#1C9300" />
          <Rect x={nameX + 3} y={y + W.cellHeight - 2} width={row.stamina.current + 1} height={2} color="#FF3C14" />
        </>
      )}
      {row.fielderType !== null && FIELDER_TYPE_COLORS[row.fielderType] !== undefined && (
        // 0x571d8 타자 — (x + w − 4 · x + w − 3, y + 1)~(…, y + h − 2) 두 줄, 색은 +0xb & 3
        <Rect x={nameX + W.columnWidth[0] - 4} y={y + 1} width={2} height={W.cellHeight - 2} color={FIELDER_TYPE_COLORS[row.fielderType]} />
      )}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={badgeX} y={y} />
      {row.badge !== null && (
        <>
          <FrameSprite folder={GAME_UI_FRAMES} frame={row.badge.chipFrame} origins={gameUi} x={badgeX} y={y} />
          <CenteredImgText origins={imgText} frame={row.badge.label} x={badgeX} y={y} width={W.columnWidth[1]} />
        </>
      )}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={rateX} y={y} />
      {rate !== null && <CellNumber drawing={rate} x={rateX} y={y} />}
      <FrameSprite folder={GAME_UI_FRAMES} frame={W.valueCellFrame} origins={gameUi} x={countX} y={y} />
      {count !== null && <CellNumber drawing={count} x={countX} y={y} />}
    </div>
  )
}

/** 0x6aff8(칸 x + 0x18, 칸 y + 3, …, num 0x14, 앵커 4) — `yearCellDrawingOf` 는 칸 왼쪽 기준이다 */
function CellNumber({ drawing, x, y, dx = 0 }: {
  readonly drawing: ReturnType<typeof yearCellDrawingOf>; readonly x: number; readonly y: number; readonly dx?: number
}) {
  return (
    <>
      {drawing.glyphs.map((glyph, index) => (
        <img key={index} alt="" src={`${NUM}/${pad(glyph.frame)}.png`} style={{ ...pixel, left: x + dx + glyph.x, top: y + 3 }} />
      ))}
      {drawing.dots.map((dot, index) => (
        <Rect key={`d${index}`} x={x + dx + dot.x} y={y + dot.y} width={1} height={2} color={ORIGINAL_COLORS.text} />
      ))}
    </>
  )
}

function Rect({ x, y, width, height, color, opacity = 1 }: {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string; readonly opacity?: number
}) {
  if (width <= 0 || height <= 0) return null
  return <span style={{ ...pixel, left: x, top: y, width, height, background: color, opacity }} />
}

function CursorBox({ rowY, tick }: { readonly rowY: number; readonly tick: number }) {
  const box = cursorBoxOf(rowY, tick)
  return (
    <div data-testid="교체 커서">
      {roundEdgeRectsOf(box.x, box.y, box.width, box.height).map((rect, index) => (
        <Rect key={index} {...rect} color={box.color} opacity={box.opacity} />
      ))}
    </div>
  )
}

/** 창이 다 열리는(+0x425 = 1) 첫 그림 */
const DETAIL_OPEN_DRAW = (() => {
  let draw = 0
  while (!detailWindowFrameAt(draw).isOpen) draw += 1
  return draw
})()

/** 둥근 칠 0x6b7d4 (둥글기 1) */
function RoundFill({ x, y, width, height, color }: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string }) {
  return (
    <>
      {roundFillRectsOf({ x, y, width, height, round: 1 }).map((rect, index) => <Rect key={index} {...rect} color={color} />)}
    </>
  )
}

/**
 * **선수 정보 창 0x5b798** ('0' INFO — 종류 3 투수 · 2 타자). 창 걸음 · 칸 · 값의 근거는 `lib/substitutionWindow`.
 */
function DetailWindow({ detail, draw, radarDraw, radarKey, gameUi, imgText }: {
  readonly detail: PlayerDetail; readonly draw: number; readonly radarDraw: number; readonly radarKey: number
  readonly gameUi: FrameOrigins | null; readonly imgText: FrameOrigins | null
}) {
  const frame = detailWindowFrameAt(draw)
  const { x, width } = frame
  const y = DETAIL_WINDOW.y
  const height = DETAIL_WINDOW.height
  const rows = detail.kind === '투수' ? PITCHER_DETAIL_ROWS : BATTER_DETAIL_ROWS
  const tickerCounter = useSkinTickerCounter(draw)
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
            // 도형은 창이 다 열린 그림부터 그린다 — 그 전 그림은 자람 걸음을 안 굴린다
            <DetailRadar abilities={detail.abilities} isPitcher={detail.kind === '투수'} restartKey={radarKey}
              draw={Math.min(radarDraw, draw - DETAIL_OPEN_DRAW)} />
          )}
          {rows.map((row, index) => {
            const value = detail.values[index]
            const labelX = x + DETAIL_LABEL_DX
            const valueX = x + DETAIL_VALUE_DX
            let content: ReactNode = null
            if (value?.kind === 'text') {
              const textWidth = measurePixelTextWidth(value.text)
              content = (
                <PixelText style={{ ...pixel, left: valueX + ((54 - textWidth) >> 1), top: row.textY + 2, color: ORIGINAL_COLORS.text }}>
                  {value.text}
                </PixelText>
              )
            } else if (value?.kind === 'ticker' && frame.isOpen) {
              // 0x5a8c8 — 한 그림의 k 번째 흐르는 글은 카운터 c + 3k 로 그려진다
              content = <DetailTicker text={value.text} x={valueX} y={row.textY + 2} counter={tickerCounter + SKIN_TICKER_STEP * tickerIndex} />
              tickerIndex += 1
            }
            return (
              <div key={index} data-testid={`선수 정보 줄 ${index}`} aria-label={value?.text}>
                <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_LABEL_CELL} origins={gameUi} x={labelX} y={row.cellY} />
                <CenteredImgText origins={imgText} frame={row.labelFrame} x={labelX} y={row.labelY} width={25} />
                <FrameSprite folder={GAME_UI_FRAMES} frame={DETAIL_VALUE_CELL} origins={gameUi} x={valueX} y={row.cellY} />
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
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
function DetailRadar({ abilities, isPitcher, draw, restartKey }: {
  readonly abilities: readonly number[]; readonly isPitcher: boolean; readonly draw: number; readonly restartKey: number
}) {
  const center = { x: DETAIL_RADAR.centerX, y: isPitcher ? DETAIL_RADAR.pitcherCenterY : DETAIL_RADAR.batterCenterY }
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
