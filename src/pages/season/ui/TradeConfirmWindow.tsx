import type { CSSProperties } from 'react'
import { CommonPanel, FrameSprite, PressArea, SolidStamp } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { LINE_HEIGHT, measurePixelTextWidth } from '@/shared/lib/font/layout'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { yearLabelOffsetOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import {
  TRADE_CONFIRM,
  teamNameFrameOf,
  tradeBadgeOf,
  tradeBoostTextOf,
  tradeCostBoxPaintsOf,
  tradeCostTextOf,
} from '@/pages/season/lib/tradeConfirmLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI_FRAMES = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const pad = (index: number) => String(index).padStart(3, '0')
const pixel: CSSProperties = { position: 'absolute', pointerEvents: 'none', imageRendering: 'pixelated' }

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** 확인 판 한 줄 — 이름 · 팀 · 딱지 재료 */
export interface TradeConfirmPlayer {
  readonly name: string
  readonly teamId: number
  /** 레코드 +0xb & 3 */
  readonly profileLow: number
  /** 레코드 +0x1b */
  readonly grade: number
}

export interface TradeConfirmWindowProps {
  /** this+0x154 — 0 투수 · 1 타자 */
  readonly isPitcherTab: boolean
  /** 내 선수(보상) — 박스 4 · 5 · 8 */
  readonly given: TradeConfirmPlayer
  /** 상대 선수(영입) — 박스 6 · 7 · 9 */
  readonly acquired: TradeConfirmPlayer
  /** 진행 단계가 아니면(this+0x160 == 0) 비용 칸 · 목록을 그린다 */
  readonly showsChoices: boolean
  /** 목록 [this+0x7c] 커서 */
  readonly cursor: number
  /** 웹 전용 — 비용 칸 줄 누름 (커서 줄이면 확인, 아니면 커서 옮김은 부르는 쪽) */
  readonly onPressRow?: (index: number) => void
  /** 웹 전용 — 누름 칸 이름에 붙이는 성공률 (원본 판에는 성공률 글이 없다) */
  readonly rateOf?: (index: number) => number
}

/** **트레이드 확인 0xe7 그림 0xd4e8** — 배치 근거는 `lib/tradeConfirmLayout` 머리말(직접 떴다) */
export function TradeConfirmWindow({ isPitcherTab, given, acquired, showsChoices, cursor, onPressRow, rateOf }: TradeConfirmWindowProps) {
  const modeUi = useFrameOrigins(MODE_UI_FRAMES)
  const imgText = useFrameOrigins(IMG_TEXT_FRAMES)
  const animations = useAnimations(MODE_UI_FRAMES)
  const update = useUpdateCounter()
  const T = TRADE_CONFIRM
  const step = animationStepAt(animations?.[T.animation] ?? [], update)
  const cursorRow = T.rows[cursor]

  return (
    <div role="group" aria-label="트레이드 확인" data-testid="트레이드-확인">
      <CommonPanel
        x={T.panel.x}
        y={T.panel.y}
        width={T.panel.width}
        height={T.panel.height}
        topBand={T.panel.topBand}
        titleTab
        testId="시즌-목록-판"
      />
      <FrameSprite folder={MODE_UI_FRAMES} frame={T.cellsFrame} origins={modeUi} x={0} y={0} />
      <SolidStamp folder={IMG_TEXT_FRAMES} frame={T.title.frame} origins={imgText} x={T.title.x} y={T.title.y} color={T.title.color} />
      {T.headers.map((header) => (
        <CenteredImgText key={header.frame} origins={imgText} frame={header.frame} box={header.box} />
      ))}
      {step !== null && <FrameSprite folder={MODE_UI_FRAMES} frame={step.frame} origins={modeUi} x={step.dx} y={step.dy} />}
      <PlayerRow player={given} row={T.myRow} isPitcherTab={isPitcherTab} modeUi={modeUi} imgText={imgText} testId="트레이드-보상" />
      <PlayerRow player={acquired} row={T.opponentRow} isPitcherTab={isPitcherTab} modeUi={modeUi} imgText={imgText} testId="트레이드-영입" />
      {showsChoices && (
        <>
          <FrameSprite folder={MODE_UI_FRAMES} frame={T.listFrame} origins={modeUi} x={0} y={0} />
          {tradeCostBoxPaintsOf(T.costBox).map((paint, index) => (
            <span key={index} style={{ ...pixel, left: paint.x, top: paint.y, width: paint.width, height: paint.height, background: paint.color }} />
          ))}
          <CenteredMarkup raw={tradeCostTextOf(given.grade, acquired.grade)} box={T.costBox} color="#ffff00" testId="트레이드-비용" />
          {cursorRow !== undefined && (
            <RoundBorder x={cursorRow.x - 1} y={cursorRow.y - 1} width={cursorRow.width + 1} height={cursorRow.height + 1} color="#ffff00" />
          )}
          {T.rows.map((box, index) => (
            <CenteredMarkup key={index} raw={tradeBoostTextOf(index)} box={box} color="#ffffff" testId={`트레이드-비용칸-${index}`} />
          ))}
          {onPressRow !== undefined &&
            T.rows.map((box, index) => (
              <PressArea
                key={`p${index}`}
                label={`${tradeBoostLabelOf(index)}${rateOf === undefined ? '' : ` 성공률 ${rateOf(index)}%`}`}
                rect={box}
                onPress={() => onPressRow(index)}
              />
            ))}
        </>
      )}
    </div>
  )
}

const tradeBoostLabelOf = (index: number) =>
  parseGameMarkup(tradeBoostTextOf(index))
    .flatMap((line) => line.segments.map((s) => s.text))
    .join('')

function PlayerRow({
  player,
  row,
  isPitcherTab,
  modeUi,
  imgText,
  testId,
}: {
  readonly player: TradeConfirmPlayer
  readonly row: { readonly name: Box; readonly team: Box; readonly badge: Box }
  readonly isPitcherTab: boolean
  readonly modeUi: FrameOrigins | null
  readonly imgText: FrameOrigins | null
  readonly testId: string
}) {
  const badge = tradeBadgeOf(isPitcherTab, player.profileLow)
  return (
    <div data-testid={testId} aria-label={player.name}>
      <CenteredMarkup raw={player.name} box={row.name} color="#ffffff" />
      <CenteredImgText origins={imgText} frame={teamNameFrameOf(player.teamId)} box={row.team} />
      <FrameSprite folder={MODE_UI_FRAMES} frame={badge.chip} origins={modeUi} x={row.badge.x} y={row.badge.y} />
      <CenteredImgText origins={imgText} frame={badge.label} box={row.badge} />
    </div>
  )
}

/** 0xb9e05 꼴 0x22 — 박스 가운데 */
function CenteredImgText({ origins, frame, box }: { readonly origins: FrameOrigins | null; readonly frame: number; readonly box: Box }) {
  const origin = origins?.[pad(frame)]
  if (origin === undefined) return null
  const dy = box.height - origin.height
  const offset = yearLabelOffsetOf(box.width, origin.width, origin.height)
  return (
    <img
      alt=""
      src={`${IMG_TEXT_FRAMES}/${pad(frame)}.png`}
      style={{ ...pixel, left: box.x + offset.x + origin.x, top: box.y + (dy >> 1) + (dy & 1) + origin.y }}
    />
  )
}

/**
 * 0xba411(박스, 글, 정렬 0x22) → 0xba2e4 (직접 떴다) — 한 줄 글을 박스 가운데.
 * 가로(정렬 0x2, 0xba342~0xba352): x += (w − 글폭(0x9c52d)) asr 1.
 * 세로(정렬 0x20, 0xba368~0xba396): d = h − 글꼴 높이(0x9baf0 = 글꼴 +0x6c = 11) → d > 0 이면 y += ceil(d/2), 아니면 y += d asr 1.
 */
/** 0xba2e4 의 세로 가운데(정렬 0x20) — 0xba37c~0xba396 */
function centeredTextDyOf(boxHeight: number): number {
  const d = boxHeight - LINE_HEIGHT
  return d > 0 ? (d >> 1) + (d % 2) : d >> 1
}

function CenteredMarkup({ raw, box, color, testId }: { readonly raw: string; readonly box: Box; readonly color: string; readonly testId?: string }) {
  const segments = parseGameMarkup(raw).flatMap((line) => line.segments)
  const text = segments.map((segment) => segment.text).join('')
  const width = measurePixelTextWidth(text)
  let x = box.x + ((box.width - width) >> 1)
  const top = box.y + centeredTextDyOf(box.height)
  return (
    <div data-testid={testId} aria-label={text}>
      {segments.map((segment, index) => {
        const left = x
        x += measurePixelTextWidth(segment.text) + 1
        return (
          <PixelText key={index} style={{ ...pixel, left, top, color: segment.color ?? color }}>
            {segment.text}
          </PixelText>
        )
      })}
    </div>
  )
}

function RoundBorder({
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
  const line = (left: number, top: number, width: number, height: number) => (
    <span style={{ ...pixel, left, top, width, height, background: color }} />
  )
  return (
    <div data-testid="트레이드-비용-커서">
      {line(x + 1, y, w - 1, 1)}
      {line(x + 1, y + h, w - 1, 1)}
      {line(x, y + 1, 1, h - 1)}
      {line(x + w, y + 1, 1, h - 1)}
    </div>
  )
}
