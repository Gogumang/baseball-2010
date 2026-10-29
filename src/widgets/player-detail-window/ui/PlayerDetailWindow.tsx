import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { SKIN_TICKER_STEP, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import {
  BATTER_DETAIL_ROWS,
  DETAIL_WINDOW,
  PITCHER_DETAIL_ROWS,
  detailRadarCenterOf,
  detailWindowFrameAt,
} from '@/widgets/player-detail-window/lib/playerDetailWindow'
import type { DetailWindowOrigin, PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { DetailRadar } from '@/widgets/player-detail-window/ui/playerDetailWindow/DetailRadar'
import { DetailRowView } from '@/widgets/player-detail-window/ui/playerDetailWindow/DetailRowView'
import { DetailWindowFrame } from '@/widgets/player-detail-window/ui/playerDetailWindow/DetailWindowFrame'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES } from '@/widgets/player-detail-window/ui/playerDetailWindow/detailAssets'

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
  // 0x5a8c8 — 한 그림의 k 번째 흐르는 글은 카운터 c + 3k 로 그려진다. 줄마다 그 앞 흐르는 글 수가 k 다
  const tickerOrders = tickerOrdersOf(rows.map((_, index) => detail.values[index]?.kind === 'ticker'))
  return (
    <div data-testid="선수 정보 창">
      <DetailWindowFrame x={x} y={y} width={width} height={height} />
      {/* 0xbae25(x + 5, y + 5, w − 10, h − 10) — 안쪽은 이 칸으로 자른다 */}
      <div
        style={{ position: 'absolute', left: x + 5, top: y + 5, width: width - 10, height: height - 10, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <div style={{ position: 'absolute', left: -(x + 5), top: -(y + 5), width: 240, height: 320 }}>
          {frame.isOpen && (
            // 도형은 창이 다 열린 그림부터 그린다([+0x425], 0x5b838) — 그 전 그림은 자람 걸음을 안 굴린다
            <DetailRadar
              abilities={detail.abilities}
              isPitcher={isPitcher}
              restartKey={radarKey}
              center={detailRadarCenterOf(origin, isPitcher)}
              draw={Math.min(radarDraw, draw - openDraw)}
            />
          )}
          {rows.map((row, index) => (
            <DetailRowView
              key={index}
              index={index}
              row={row}
              value={detail.values[index]}
              x={x}
              y={y}
              isOpen={frame.isOpen}
              tickerCounter={tickerCounter + SKIN_TICKER_STEP * tickerOrders[index]}
              gameUi={gameUi}
              imgText={imgText}
            />
          ))}
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

/** 줄마다 그 앞에 선 흐르는 글 수 — 그림 안 차례 k */
function tickerOrdersOf(isTickerRows: readonly boolean[]): number[] {
  let seen = 0
  return isTickerRows.map((isTicker) => {
    const order = seen
    if (isTicker) seen += 1
    return order
  })
}
