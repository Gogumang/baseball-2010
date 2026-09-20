import { SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { glyphsWidthOf, PERCENT_FRAME } from '@/shared/lib/pixelNumber/pixelNumber'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEAMS } from '@/shared/config/original/teams'
import { nationalCupRankingOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import {
  HEADER_CELLS, HEADER_DIVIDER_COUNT, NATIONAL_CUP_ROW_COUNT, PERCENT_OFFSET, RANK_GLYPH_HEIGHT,
  ROW_CELLS, ROW_FRAME, ROW_FRAME_ORIGIN, ROW_STEP, STANDINGS_WINDOW, TEAM_LABEL_BASE_FRAME,
  rankGlyphsOf, valueGlyphsOf, winningPercentOf,
} from '@/pages/national-cup/lib/nationalCupLayout'
import type { StandingsBox } from '@/widgets/standings/lib/standingsLayout'
import * as styles from '@/pages/national-cup/ui/NationalCupStandings.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const NUM = './sprites/num'
const navyLabel = (frame: number) => `./sprites/management/label_navy_${frame}.png`
const frameImage = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface NationalCupStandingsProps {
  readonly cup: NationalCup
  /** 확인(−5/0x35) — 다음 경기 또는 결과 화면으로 */
  readonly onConfirm: () => void
  /**
   * 확인 칸을 받는가. 결과 팝업이 떠 있는 동안에는 원본도 키를 팝업이 가져가므로 끈다
   * (그때도 순위표 자체는 팝업 뒤에 그대로 남는다).
   */
  readonly isConfirmable?: boolean
}

/**
 * 국가대항전 순위 화면 (나만의리그 상태 134 `0x19f30` · 시즌모드 상태 243 `0xe684`).
 *
 * 그리기는 **팀 순위표 `0x7f070` 그대로**다. 그 함수는 `L+0xac`(국가대항전 진행 플래그)가 서 있으면
 * `7f1d2` 에서 **4줄** 만 그린다 — 정규 10줄 대신 참가 4국이다 (P5·P6 확정).
 * 줄 차례는 `0xb7f0c` 순위(승 내림차순 → 패 오름차순 → 한·일·쿠·미)이고,
 * 팀 이름표는 `img_text 65 + 팀번호` 라 10~13 이 75~78 이다.
 *
 * 들어올 때 `0x19f30`/`0xe684` 가 하는 **히든 팀 열기**와 **대한민국 투수 스태미나 회복**은 화면이 아니라
 * 대회 처리 쪽 일이라 여기 없다 — `nationalCupFlow.hiddenTeamsToOpen` 과
 * `nationalCup.NATIONAL_CUP_FULL_STAMINA` 참고.
 */
export function NationalCupStandings({ cup, onConfirm, isConfirmable = true }: NationalCupStandingsProps) {
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')] ?? { width: 0, height: 0 }
  /** 글자 그림을 칸 가운데에 — 세로는 반올림이 위로 가도록 +1 뒤 버림 (순위표와 같은 식) */
  const centered = (frame: number, box: StandingsBox, dy = 0) => {
    const size = sizeOf(frame)
    return {
      left: box.x + Math.trunc((box.width - size.width) / 2),
      top: box.y + dy + Math.trunc((box.height - size.height + 1) / 2),
    }
  }
  const centerRight = (glyphs: readonly Glyph[], box: StandingsBox) => {
    const width = glyphsWidthOf(glyphs)
    return box.x + Math.trunc((box.width - width) / 2) + width
  }

  const ranking = nationalCupRankingOf(cup).slice(0, NATIONAL_CUP_ROW_COUNT)

  return (
    <div role="group" aria-label="국가대항전 순위">
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
        const slot = cup.teams.indexOf(teamId)
        const dy = ROW_STEP * index
        const wins = cup.wins[slot]
        const losses = cup.losses[slot]
        const rankGlyphs = rankGlyphsOf(index + 1)
        const winGlyphs = valueGlyphsOf(wins)
        const lossGlyphs = valueGlyphsOf(losses)
        const percent = ROW_CELLS.winningPercent
        return (
          <div key={teamId} data-team={teamId} data-rank={index + 1}>
            <img className={styles.layer} alt="" src={frameImage(MODE_UI, ROW_FRAME)}
              style={{ left: ROW_FRAME_ORIGIN.x, top: ROW_FRAME_ORIGIN.y + dy }} />
            <SpriteNumber glyphs={rankGlyphs} right={centerRight(rankGlyphs, ROW_CELLS.rank)}
              boxTop={ROW_CELLS.rank.y + dy} boxHeight={ROW_CELLS.rank.height} glyphHeight={RANK_GLYPH_HEIGHT} />
            <img className={styles.layer} alt={TEAMS[teamId].name}
              src={frameImage(IMG_TEXT, TEAM_LABEL_BASE_FRAME + teamId)}
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

      {isConfirmable && <button type="button" className={styles.confirm} aria-label="확인" onClick={onConfirm} />}
    </div>
  )
}
