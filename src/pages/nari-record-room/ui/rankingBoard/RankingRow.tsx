import { ORIGINAL_COLORS } from '@/shared/config/design'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { yearNumberGlyphsOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { RANKING_BOARD, rankingColumnXOf, rankingRowYOf, rankingValueDrawingOf } from '@/pages/nari-record-room/lib/rankingBoard'
import { seasonRankingValueTextOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry } from '@/entities/season-mode/model/seasonRecordRanking'
import {
  DOT_COLOR,
  GAME_UI_FRAMES,
  IMG_TEXT,
  NUM,
  centeredLabelPlaceOf,
  imageOf,
  pixel,
} from '@/pages/nari-record-room/ui/rankingBoard/rankingBoardParts'

interface RankingRowProps {
  readonly row: number
  readonly entry: SeasonRankingEntry | undefined
  readonly kind: number
  readonly myTeamId: number
  readonly testIdPrefix: string
  readonly textOrigins: FrameOrigins | null
}

/** 순위 줄 하나 — 칸 그림 넷, 줄이 있으면 순번 · 이름(내 팀이면 노랑) · 팀 이름 글 · 값 */
export function RankingRow({ row, entry, kind, myTeamId, testIdPrefix, textOrigins }: RankingRowProps) {
  const top = rankingRowYOf(row)
  const color = entry !== undefined && entry.record.teamId === myTeamId ? RANKING_BOARD.myTeamColor : ORIGINAL_COLORS.text
  return (
    <div data-testid={`${testIdPrefix}-줄-${row}`} style={{ color }}>
      {RANKING_BOARD.columns.map((column, index) => (
        <img key={index} alt="" src={imageOf(GAME_UI_FRAMES, column.cellFrame)} style={{ ...pixel, left: rankingColumnXOf(index), top }} />
      ))}
      {entry !== undefined && (
        <RankingEntryLine row={row} entry={entry} kind={kind} top={top} color={color} testIdPrefix={testIdPrefix} textOrigins={textOrigins} />
      )}
    </div>
  )
}

function RankingEntryLine({
  row,
  entry,
  kind,
  top,
  color,
  testIdPrefix,
  textOrigins,
}: {
  readonly row: number
  readonly entry: SeasonRankingEntry
  readonly kind: number
  readonly top: number
  readonly color: string
  readonly testIdPrefix: string
  readonly textOrigins: FrameOrigins | null
}) {
  const teamFrame = RANKING_BOARD.teamNameFrameBase + entry.record.teamId
  const teamPlace = centeredLabelPlaceOf(textOrigins, teamFrame, 2, top)
  const value = rankingValueDrawingOf(kind, entry.value)
  return (
    <>
      {yearNumberGlyphsOf(row + 1).map((glyph, index) => (
        <img
          key={`n${index}`}
          alt=""
          src={imageOf(NUM, glyph.frame)}
          style={{ ...pixel, left: rankingColumnXOf(0) + glyph.x, top: top + RANKING_BOARD.numberDy }}
        />
      ))}
      <span
        className={styles.title}
        data-testid={`${testIdPrefix}-이름-${row}`}
        style={{
          left: rankingColumnXOf(1),
          top,
          width: RANKING_BOARD.columns[1].width,
          height: RANKING_BOARD.cellHeight,
          lineHeight: `${RANKING_BOARD.cellHeight}px`,
          whiteSpace: 'nowrap',
          color,
        }}
      >
        {entry.record.name}
      </span>
      {teamPlace !== null && <img alt="" src={imageOf(IMG_TEXT, teamFrame)} style={{ ...pixel, ...teamPlace }} />}
      <div data-testid={`${testIdPrefix}-값-${row}`} aria-label={seasonRankingValueTextOf(kind, entry.value)}>
        {value?.glyphs.map((glyph, index) => (
          <img
            key={`v${index}`}
            alt=""
            src={imageOf(NUM, glyph.frame)}
            style={{ ...pixel, left: rankingColumnXOf(3) + glyph.x, top: top + RANKING_BOARD.valueDy }}
          />
        ))}
        {value?.dots.map((dot, index) => (
          <span
            key={`d${index}`}
            style={{ ...pixel, left: rankingColumnXOf(3) + dot.x, top: top + dot.y, width: 1, height: 2, background: DOT_COLOR }}
          />
        ))}
      </div>
    </>
  )
}
