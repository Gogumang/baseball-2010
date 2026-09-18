import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { glyphsWidthOf, PERCENT_FRAME } from '@/shared/lib/pixelNumber/pixelNumber'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { rankingOf } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import {
  HEADER_CELLS, HEADER_DIVIDER_COUNT, PERCENT_OFFSET, RANK_GLYPH_HEIGHT, ROW_CELLS, ROW_COUNT, ROW_FRAME,
  ROW_FRAME_ORIGIN, ROW_STEP, STANDINGS_WINDOW, TEAM_LABEL_BASE_FRAME, rankGlyphsOf, valueGlyphsOf,
  winningPercentOf,
} from '@/widgets/standings/lib/standingsLayout'
import type { StandingsBox } from '@/widgets/standings/lib/standingsLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'

const IMG_TEXT = '/sprites/img_text/frames'
const MODE_UI = '/sprites/mode_ui/frames'
const NUM = '/sprites/num'
const navyLabel = (frame: number) => `/sprites/management/label_navy_${frame}.png`
const frameImage = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface StandingsWindowProps {
  readonly league: League
  /** 포스트시즌이면 진출 4팀만 (0x7f070 의 [+0xac] 플래그) */
  readonly rowCount?: number
  readonly onClose: () => void
}

/**
 * 팀 순위표 = 기록실 (0x7f070). 사용자 팀을 따로 강조하지 않는다 — 원본 함수에 색·팔레트 분기가 없다.
 * 나만의리그 장면 위에 뜨는 창이라 관리 화면을 덮는다.
 * **"선수정보 → 기록실" 이 이 표로 간다는 것은 추정이다** — 상태표가 재배치 포인터라 layout-re 가
 * 확인하지 못했고, 나만의리그 장면에서 순위표를 그리는 곳이 여기뿐이라 이렇게 붙였다.
 */
export function StandingsWindow({ league, rowCount = ROW_COUNT, onClose }: StandingsWindowProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')] ?? { width: 0, height: 0 }
  /** 글자 그림을 칸 가운데에 — 세로는 반올림이 위로 가도록 +1 뒤 버림 */
  const centered = (frame: number, box: StandingsBox, dy = 0) => {
    const size = sizeOf(frame)
    return {
      left: box.x + Math.trunc((box.width - size.width) / 2),
      top: box.y + dy + Math.trunc((box.height - size.height + 1) / 2),
    }
  }
  /** 숫자를 칸 가운데에 — SpriteNumber 는 오른쪽 끝을 받으므로 가운데 왼쪽 끝에 글자 폭을 더한다 */
  const centerRight = (glyphs: readonly Glyph[], box: StandingsBox) => {
    const width = glyphsWidthOf(glyphs)
    return box.x + Math.trunc((box.width - width) / 2) + width
  }
  const ranking = rankingOf(league).slice(0, rowCount)

  return (
    <div className={styles.overlay} role="dialog" aria-label="기록실" onClick={onClose}>
      <div className={styles.window}
        style={{ left: STANDINGS_WINDOW.x, top: STANDINGS_WINDOW.y, width: STANDINGS_WINDOW.width, height: STANDINGS_WINDOW.height }} />

      <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {HEADER_CELLS.slice(0, HEADER_DIVIDER_COUNT).map((cell) => (
          <rect key={cell.frame} x={cell.x + cell.width} y={cell.y} width={1} height={cell.height}
            fill={ORIGINAL_COLORS.tableDivider} />
        ))}
      </svg>
      {HEADER_CELLS.map((cell) => (
        <img key={cell.frame} className={styles.layer} alt="" src={navyLabel(cell.frame)} style={centered(cell.frame, cell)} />
      ))}

      {ranking.map((teamId, index) => {
        const dy = ROW_STEP * index
        const wins = league.wins[teamId]
        const losses = league.losses[teamId]
        const rankGlyphs = rankGlyphsOf(index + 1)
        const winGlyphs = valueGlyphsOf(wins)
        const lossGlyphs = valueGlyphsOf(losses)
        const percent = ROW_CELLS.winningPercent
        return (
          <div key={teamId}>
            <img className={styles.layer} alt="" src={frameImage(MODE_UI, ROW_FRAME)}
              style={{ left: ROW_FRAME_ORIGIN.x, top: ROW_FRAME_ORIGIN.y + dy }} />
            <SpriteNumber glyphs={rankGlyphs} right={centerRight(rankGlyphs, ROW_CELLS.rank)}
              boxTop={ROW_CELLS.rank.y + dy} boxHeight={ROW_CELLS.rank.height} glyphHeight={RANK_GLYPH_HEIGHT} />
            <img className={styles.layer} alt="" src={frameImage(IMG_TEXT, TEAM_LABEL_BASE_FRAME + teamId)}
              style={centered(TEAM_LABEL_BASE_FRAME + teamId, ROW_CELLS.team, dy)} />
            <SpriteNumber glyphs={winGlyphs} right={centerRight(winGlyphs, ROW_CELLS.wins)}
              boxTop={ROW_CELLS.wins.y + dy} boxHeight={ROW_CELLS.wins.height} />
            <SpriteNumber glyphs={lossGlyphs} right={centerRight(lossGlyphs, ROW_CELLS.losses)}
              boxTop={ROW_CELLS.losses.y + dy} boxHeight={ROW_CELLS.losses.height} />
            {/* 승률만 오른쪽 정렬이고, 그 오른쪽에 "%" 가 따로 붙는다 */}
            <SpriteNumber glyphs={valueGlyphsOf(winningPercentOf(wins, losses))} right={percent.x + percent.width}
              boxTop={percent.y + dy} boxHeight={percent.height} />
            <img className={styles.layer} alt="" src={frameImage(NUM, PERCENT_FRAME)}
              style={{ left: percent.x + PERCENT_OFFSET.x, top: percent.y + dy + PERCENT_OFFSET.y }} />
          </div>
        )
      })}
    </div>
  )
}
