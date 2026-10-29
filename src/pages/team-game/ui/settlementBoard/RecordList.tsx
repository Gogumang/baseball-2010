import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { NO_RECORD_TEXT, SETTLEMENT_SCROLL_TRACK, recordCountTextOf } from '@/pages/team-game/lib/settlementBoard'
import type { settlementPanelLayoutOf, settlementRecordRowsOf, startSettlementScroll } from '@/pages/team-game/lib/settlementBoard'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { SCROLL_ARROW_IMAGE, SCROLL_TRACK_COLOR, SLT_FRAME, imageSrc } from './settlementAssets'

type PanelLayout = ReturnType<typeof settlementPanelLayoutOf>

/** 스크롤 막대 0x58c11 — 길 · ▲▼(slt_frame 이미지 78) · 흰 손잡이 */
function ScrollBar({ panel, scroll }: { readonly panel: PanelLayout; readonly scroll: ReturnType<typeof startSettlementScroll> }) {
  const bar = panel.records.scrollBar
  return (
    <>
      <div
        className={styles.block}
        style={{ left: bar.x, top: bar.y, width: 7, height: SETTLEMENT_SCROLL_TRACK + 2, background: SCROLL_TRACK_COLOR }}
      />
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, SCROLL_ARROW_IMAGE)} style={{ left: bar.x, top: bar.y - 4 }} />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, SCROLL_ARROW_IMAGE)}
        style={{ left: bar.x, top: bar.y + SETTLEMENT_SCROLL_TRACK + 1, transform: 'scaleY(-1)' }}
      />
      <div className={styles.scrollThumb} style={{ left: bar.x + 1, top: bar.y + scroll.thumb + 1, width: 4, height: scroll.thumbLength }} />
    </>
  )
}

/** 4ab6e 기록 칸 안 — 보이는 줄(이름 · 횟수)과 스크롤 막대. 기록이 없으면 가운데 글 하나 */
export function RecordList({
  panel,
  visibleRows,
  scroll,
}: {
  readonly panel: PanelLayout
  readonly visibleRows: ReturnType<typeof settlementRecordRowsOf>
  readonly scroll: ReturnType<typeof startSettlementScroll>
}) {
  if (!panel.hasRecords) {
    return (
      <span className={styles.text} style={{ left: panel.emptyText.x, top: panel.emptyText.y, width: panel.emptyText.width, textAlign: 'center' }}>
        {NO_RECORD_TEXT}
      </span>
    )
  }
  return (
    <>
      {visibleRows.map((row, offset) => {
        const y = panel.records.firstRowY + panel.records.rowStep * offset
        return (
          <div key={row.id} data-testid={`정산-기록-${row.id}`}>
            <span className={styles.text} style={{ left: panel.records.nameX, top: y }}>
              {RECORD_NAMES[row.id] ?? ''}
            </span>
            <span className={styles.text} style={{ left: panel.records.countX, top: y, width: panel.records.countWidth, textAlign: 'right' }}>
              {recordCountTextOf(row.count)}
            </span>
          </div>
        )
      })}
      <ScrollBar panel={panel} scroll={scroll} />
    </>
  )
}
