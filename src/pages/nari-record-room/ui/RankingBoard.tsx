import { ORIGINAL_COLORS } from '@/shared/config/design'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { CommonPanel, useImgTextPalette3 } from '@/shared/ui'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { yearLabelOffsetOf, yearNumberGlyphsOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import {
  RANKING_BLINK_AT_REST, RANKING_BOARD, rankingColumnXOf, rankingRowYOf, rankingSideArrowXOf, rankingValueDrawingOf,
} from '@/pages/nari-record-room/lib/rankingBoard'
import { seasonRankingValueTextOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry } from '@/entities/season-mode/model/seasonRecordRanking'

const IMG_TEXT = './sprites/img_text/frames'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const SLT_FRAME = './sprites/slt_frame'
const NUM = './sprites/num'
const imageOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`
const pixel = { position: 'absolute', pointerEvents: 'none' } as const
/** 0x6aff8 의 점 — 흰 1×2 */
const DOT_COLOR = '#ffffff'

export interface RankingBoardProps {
  /** 쪽의 순위 종류 (`seasonRecordRanking` 종류 번호) */
  readonly kind: number
  /** 쪽의 종류 글 img_text (0x56dd4) */
  readonly kindLabelFrame: number
  readonly entries: readonly SeasonRankingEntry[]
  /** [판+0x448] — 그 팀 줄의 이름 글은 노랑 */
  readonly myTeamId: number
  readonly hasPreviousPage: boolean
  readonly hasNextPage: boolean
  /** 시험용 data-testid 머리 (`기록순위` · `순위기록`) */
  readonly testIdPrefix: string
}

/** **순위 판 0x5796c** — 배치는 `lib/rankingBoard.ts` 머리말(직접 떴다) */
export function RankingBoard({
  kind, kindLabelFrame, entries, myTeamId, hasPreviousPage, hasNextPage, testIdPrefix,
}: RankingBoardProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const centered = (frame: number, column: number, top: number) => {
    const origin = textOrigins?.[String(frame).padStart(3, '0')]
    if (origin === undefined) return null
    const box = RANKING_BOARD.columns[column]
    const offset = yearLabelOffsetOf(box.width, origin.width, origin.height)
    return { left: rankingColumnXOf(column) + offset.x, top: top + offset.y }
  }
  const headerFrames = [...RANKING_BOARD.headerTextFrames, kindLabelFrame]
  const headerTop = RANKING_BOARD.headerY + RANKING_BOARD.headerTextDy
  const arrowTop = RANKING_BOARD.headerY + RANKING_BOARD.sideArrowDy
  const palette3 = useImgTextPalette3()

  return (
    <>
      {palette3.definition}
      {/* 57a52 공용 판 0x55e60(편집기, W/2, H/2 + 5, 210, 220, 0, 0x22, 위 띠 0x12, 0, 0, 0) */}
      <CommonPanel x={RANKING_BOARD.panel.x} y={RANKING_BOARD.panel.y} width={RANKING_BOARD.panel.width}
        height={RANKING_BOARD.panel.height} topBand={0x12} testId={`${testIdPrefix}-판`} />
      {/* 머리 글은 img_text 팔레트 3 (57a5c · 57a9c · 57ad6 · 57b9a `0x913e5(img_text, 3)` 뒤 0x5650c) */}
      {headerFrames.map((frame, column) => {
        const place = centered(frame, column, headerTop)
        return place === null ? null : <img key={column} alt="" src={imageOf(IMG_TEXT, frame)} style={{ ...pixel, ...palette3.style, ...place }} />
      })}
      {hasPreviousPage && (
        <img alt="앞 쪽" src={imageOf(SLT_FRAME, RANKING_BOARD.sideArrowImage)}
          style={{ ...pixel, left: rankingSideArrowXOf('left', RANKING_BLINK_AT_REST), top: arrowTop }} />
      )}
      {hasNextPage && (
        <img alt="다음 쪽" src={imageOf(SLT_FRAME, RANKING_BOARD.sideArrowImage)}
          style={{ ...pixel, left: rankingSideArrowXOf('right', RANKING_BLINK_AT_REST), top: arrowTop, transform: 'scaleX(-1)' }} />
      )}
      {Array.from({ length: RANKING_BOARD.rowCount }, (_unused, row) => {
        const entry = entries[row]
        const top = rankingRowYOf(row)
        const color = entry !== undefined && entry.record.teamId === myTeamId ? RANKING_BOARD.myTeamColor : ORIGINAL_COLORS.text
        const teamFrame = entry === undefined ? null : RANKING_BOARD.teamNameFrameBase + entry.record.teamId
        const teamPlace = teamFrame === null ? null : centered(teamFrame, 2, top)
        const value = entry === undefined ? null : rankingValueDrawingOf(kind, entry.value)
        return (
          <div key={row} data-testid={`${testIdPrefix}-줄-${row}`} style={{ color }}>
            {RANKING_BOARD.columns.map((column, index) => (
              <img key={index} alt="" src={imageOf(GAME_UI_FRAMES, column.cellFrame)}
                style={{ ...pixel, left: rankingColumnXOf(index), top }} />
            ))}
            {entry !== undefined && (
              <>
                {yearNumberGlyphsOf(row + 1).map((glyph, index) => (
                  <img key={`n${index}`} alt="" src={imageOf(NUM, glyph.frame)}
                    style={{ ...pixel, left: rankingColumnXOf(0) + glyph.x, top: top + RANKING_BOARD.numberDy }} />
                ))}
                <span className={styles.title} data-testid={`${testIdPrefix}-이름-${row}`}
                  style={{ left: rankingColumnXOf(1), top, width: RANKING_BOARD.columns[1].width, height: RANKING_BOARD.cellHeight,
                    lineHeight: `${RANKING_BOARD.cellHeight}px`, whiteSpace: 'nowrap', color }}>
                  {entry.record.name}
                </span>
                {teamFrame !== null && teamPlace !== null && (
                  <img alt="" src={imageOf(IMG_TEXT, teamFrame)} style={{ ...pixel, ...teamPlace }} />
                )}
                <div data-testid={`${testIdPrefix}-값-${row}`} aria-label={seasonRankingValueTextOf(kind, entry.value)}>
                  {value?.glyphs.map((glyph, index) => (
                    <img key={`v${index}`} alt="" src={imageOf(NUM, glyph.frame)}
                      style={{ ...pixel, left: rankingColumnXOf(3) + glyph.x, top: top + RANKING_BOARD.valueDy }} />
                  ))}
                  {value?.dots.map((dot, index) => (
                    <span key={`d${index}`}
                      style={{ ...pixel, left: rankingColumnXOf(3) + dot.x, top: top + dot.y, width: 1, height: 2, background: DOT_COLOR }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
