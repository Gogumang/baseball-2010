import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { measurePixelTextWidth } from '@/shared/lib/font/layout'
import { CommonPanel, FrameSprite, PressArea, useImgTextPalette3 } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { useMarkSkinNameBars } from '@/shared/lib/skinNameBars/skinNameBars'
import { CLEAR_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { CANCEL_KEY_OFFER } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { yearCellDrawingOf, yearLabelOffsetOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import {
  FIELDER_TYPE_COLORS,
  HEADER_TEXT_FRAMES,
  SUBSTITUTION_WINDOW,
  changeFrameAt,
  cursorBoxOf,
  isBlinkOut,
  movedListCursor,
  roundEdgeRectsOf,
} from '@/pages/team-game/lib/substitutionWindow'
import type { PlayerDetail, SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'
import { PlayerDetailWindow, SUBSTITUTION_DETAIL_ORIGIN } from '@/widgets/player-detail-window'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
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

/**
 * **교체 창 0x384b8** — 투수 교체 · 대타 (배치 근거는 `lib/substitutionWindow` 머리말).
 * 키 0x495fc: '2'·↑ / '8'·↓ 목록(세로 감기) · OK·'5' 확정(상세 창이 떠 있으면 닫고 확정) · '0' 상세 창 · '#'·CLR 취소(부르는 쪽).
 * 마우스 길: 벤치 줄 누름 칸(커서 줄이면 OK, 아니면 커서를 옮긴다) · ▲▼ 화살 자리 · "0 INFO" 자리 · ⚠️ 웹 자리: 취소는 오른쪽 소프트키 자리.
 */
export function SubstitutionWindow({ kind, ourTeamId, current, bench, detailOf, onConfirm, onCancel }: SubstitutionWindowProps) {
  const tick = useSceneTick()
  // 0x37904 · 0x37e5c 그리기가 [skin+0x333] = 1 을 적는다(37a4a · 38044) — 앱에 하나인 스킨 칸이라 스페셜 에디트가 이어 본다
  useMarkSkinNameBars()
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
      // 상태 0xb 의 키 함수 0x495fc 는 장면 키 자리(52da2)에서 받은 다음 틀에 돈다 — 장면 키 칸으로
      if (event.key === 'ArrowUp' || event.key === '2') {
        event.preventDefault()
        pushSceneKey(() => move(-1))
      } else if (event.key === 'ArrowDown' || event.key === '8') {
        event.preventDefault()
        pushSceneKey(() => move(1))
      } else if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        pushSceneKey(() => confirm())
      } else if (event.key === '0') {
        event.preventDefault()
        pushSceneKey(() => toggleDetail())
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
        <PlayerDetailWindow detail={detail} origin={SUBSTITUTION_DETAIL_ORIGIN} draw={tick - detailOpenedAt} radarDraw={tick - radarRestartAt}
          radarKey={radarRestartAt} />
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
      {/* ⚠️ 웹 자리: '#' · CLR 은 원본 화면에 글자가 없다 — 오른쪽 소프트키 자리를 빌린다. 투명 칸이라 터치 기기에는 '취소' 상황 버튼도
          낸다(r194) — 버튼은 Escape 키 사건이라 경기 화면의 CLR 듣는 곳(0x495fc 의 CLR 가지)과 같은 길이다 */}
      <PressArea label="# 취소" rect={CLEAR_PRESS_RECT} touchKey={CANCEL_KEY_OFFER} onPress={onCancel} />
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
