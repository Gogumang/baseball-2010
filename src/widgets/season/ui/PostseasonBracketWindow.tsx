import { FrameSprite, OriginalScaledImage, SpriteNumber } from '@/shared/ui'
import { TEAM_LOGO_BOX } from '@/shared/lib/sprite/originalScale'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { blackStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import {
  BRACKET_BACKDROP, DARK_CELL_STEP, LINE_COLOR, LINE_FRAMES, LOGO_INSET, RANK_GLYPH_HEIGHT, RANK_TAGS, RANK_UNIT,
  TEAM_CELLS, WON_LINE_COLOR, bracketViewOf, darkCellBoxOf, lineFrameOfCell, rankDigitBoxTopOf, rankDigitRightOf,
  rankGlyphsOf, rankLabelOfCell, rankUnitPositionOf,
} from '@/widgets/season/lib/postseasonBracketLayout'
import type { BracketBox } from '@/widgets/season/lib/postseasonBracketLayout'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

export interface PostseasonBracketWindowProps {
  /** 진행 중인 포스트시즌. 아직 없으면 빈 대진표를 그린다 */
  readonly series: PostseasonSeries | null
}

const placeOf = (box: BracketBox) => ({ left: box.x, top: box.y, width: box.width, height: box.height })

/**
 * 포스트시즌 대진표 (그리기 **0x853ac** — 직접 떴다. 부르는 곳 0xb7b8 시즌 0xef · 0x168e8 나리 128).
 *
 * 1. mode_ui 프레임 53(195×210) 계단 그림을 앵커 (0,0) 에 통째로 (0x853f6).
 * 2. 칸 k = 0..3 마다 (0x8540e~0x85532): 선 프레임 54 + k 의 박스를 모두 **#08044A** 로 채우고, 칸 k(프레임 53 박스 k)
 *    + 3 에 로고(35×34), 딱지(박스 4 + k)에 숫자 4 − k 와 "위".
 * 3. 이긴 길을 **빨강 RGB(255,0,0)** 으로 다시 채운다(0x85536~0x857f6 — `bracketViewOf`).
 * 4. 진 팀 칸을 [0x15605d4] 검정 단계 7 로 덮는다(0x8580e~0x85858 — 프레임 53 박스 k 를 (x, y, w, h + 1)).
 * 5. 끝(0x8585c)의 머리띠·바닥 0x7f4ec 는 부르는 화면이 ScreenFrame 으로 그린다.
 * 우승/탈락 문구(0x85e6c)는 공용 팝업 몫이다(P6 4a-3).
 */
export function PostseasonBracketWindow({ series }: PostseasonBracketWindowProps) {
  const origins = useFrameOrigins(BRACKET_BACKDROP.folder)
  const view = bracketViewOf(series)
  const darkOpacity = blackStepCoverOpacityOf(DARK_CELL_STEP)

  return (
    <div role="group" aria-label="포스트시즌 대진표">
      <FrameSprite
        folder={BRACKET_BACKDROP.folder}
        frame={BRACKET_BACKDROP.frame}
        origins={origins}
        x={BRACKET_BACKDROP.anchorX}
        y={BRACKET_BACKDROP.anchorY}
      />

      {TEAM_CELLS.map((cell, k) => {
        const frame = lineFrameOfCell(k)
        const tag = RANK_TAGS[k]
        const rank = rankLabelOfCell(k)
        const teamId = view.cellTeams[k]
        const team = teamId === null || teamId === undefined ? undefined : TEAMS[teamId]
        const logoBox = {
          left: cell.x + LOGO_INSET,
          top: cell.y + LOGO_INSET,
          width: cell.width - LOGO_INSET * 2,
          height: cell.height - LOGO_INSET * 2,
        }
        return (
          <div key={k} data-cell={k}>
            {LINE_FRAMES[frame].map((box, index) => (
              <div key={index} className={styles.segment} data-frame={frame} data-box={index}
                style={{ ...placeOf(box), background: LINE_COLOR }} />
            ))}
            {team === undefined ? (
              // 아직 자리가 안 정해진 칸 — 원본은 빈 칸을 그냥 비워 둔다
              <div className={styles.emptyCell} style={logoBox} />
            ) : (
              // 0x66431 — 0x663c4 가 원본 식으로 미리 줄인 35×34 버퍼를 (칸 + 3) 에 제 크기로
              <OriginalScaledImage className={styles.logo} src={team.logoUrl} alt={team.name}
                boxWidth={TEAM_LOGO_BOX.width} boxHeight={TEAM_LOGO_BOX.height}
                style={{ left: logoBox.left, top: logoBox.top }} />
            )}
            {/* 순위 딱지 = num 0~9 숫자 (x + 8 왼쪽 붙임) + img_text 307 "위" 오른쪽 정렬 ox −6 — `rankGlyphsOf` 주석 */}
            <div className={styles.rankTag} data-rank={rank} style={placeOf(tag)} />
            <SpriteNumber glyphs={rankGlyphsOf(rank)} right={rankDigitRightOf(tag, rank)}
              boxTop={rankDigitBoxTopOf(tag)} boxHeight={tag.height} glyphHeight={RANK_GLYPH_HEIGHT} />
            <img className={styles.rankUnit} alt="위"
              src={`${RANK_UNIT.folder}/${String(RANK_UNIT.frame).padStart(3, '0')}.png`}
              style={{ left: rankUnitPositionOf(tag).x, top: rankUnitPositionOf(tag).y }} />
          </div>
        )
      })}

      {view.redBoxes.map(({ frame, box }, index) => (
        <div key={`red-${index}`} className={styles.segment} data-frame={frame} data-box={box} data-won="true"
          style={{ ...placeOf(LINE_FRAMES[frame][box]), background: WON_LINE_COLOR }} />
      ))}

      {view.darkCells.map((dark, k) => dark && (
        <div key={`dark-${k}`} className={styles.segment} data-dark-cell={k}
          style={{ ...placeOf(darkCellBoxOf(k)), background: '#000', opacity: darkOpacity }} />
      ))}
    </div>
  )
}
