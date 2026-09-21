import { Button, FrameSprite, RawScreen, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  BACKDROP, LEG_ORDER, LINE_COLOR, LINE_SEGMENTS, LOGO_INSET, RANK_GLYPH_HEIGHT, RANK_TAGS,
  RANK_UNIT, TEAM_CELLS, WON_LINE_COLOR, cellIndexOfRank, rankDigitRightOf, rankGlyphsOf,
  rankUnitPositionOf,
} from '@/pages/season-end/lib/bracketLayout'
import { bracketViewOf } from '@/pages/season-end/lib/postseasonBracket'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import * as styles from '@/pages/season-end/ui/PostseasonBracket.css'

interface PostseasonBracketProps {
  readonly series: PostseasonSeries | null
  /** 오른쪽 위 단추 — 원본에 없는 웹 전용 길 (시즌 성적 요약으로) */
  readonly onShowStats?: () => void
  readonly onNext?: () => void
  readonly nextLabel?: string
}

/**
 * 포스트시즌 대진표 (0x853ac — P6 4a-1 확정).
 *
 * mode_ui 프레임 53(195×210) 계단 그림을 앵커 (0,0) 에 통째로 깔고,
 * 그 프레임 박스 0~3 에 팀 로고를(+3), 박스 4~7 에 순위 딱지(숫자 + img_text 307 "위")를 얹는다.
 * 대진 선은 그림 없는 프레임 54~57 의 2px 박스를 먼저 #08044A 로 모두 채운 뒤,
 * **이긴 길만 빨강 RGB(255,0,0)** 으로 다시 채운다 (0x855b4~0x857ec).
 *
 * 안 옮긴 것:
 *  - "프레임 54 박스 0 을 단계 7 로 어둡게"(0x7f4ed) 는 P6 도 '유력' 이라 빼 뒀다.
 *  - 우승/탈락 문구(0x85e6c)는 공용 팝업 몫이라 여기서는 안 띄운다 (4a-3).
 */
export function PostseasonBracket({ series, onShowStats, onNext, nextLabel = '다음' }: PostseasonBracketProps) {
  const origins = useFrameOrigins(BACKDROP.folder)
  const view = bracketViewOf(series)
  const wonLegs = new Set(view.wonLegs)

  return (
    <RawScreen>
      <FrameSprite folder={BACKDROP.folder} frame={BACKDROP.frame} origins={origins}
        x={BACKDROP.anchorX} y={BACKDROP.anchorY} />

      {LEG_ORDER.flatMap((leg) =>
        LINE_SEGMENTS[leg].map((box, index) => (
          <div key={`${leg}-${index}`} className={styles.segment}
            data-leg={leg}
            data-won={wonLegs.has(leg) ? 'true' : 'false'}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              background: wonLegs.has(leg) ? WON_LINE_COLOR : LINE_COLOR,
            }} />
        )),
      )}

      {[1, 2, 3, 4].map((rank) => {
        const cell = TEAM_CELLS[cellIndexOfRank(rank)]
        const tag = RANK_TAGS[cellIndexOfRank(rank)]
        const teamId = view.seeds[rank - 1]
        const team = teamId === null ? undefined : TEAMS[teamId]
        return (
          <div key={rank}>
            {team === undefined ? (
              // 아직 자리가 안 정해진 칸 — 원본은 빈 칸(팀 번호 10)을 그냥 비워 둔다
              <div className={styles.emptyCell}
                style={{
                  left: cell.x + LOGO_INSET, top: cell.y + LOGO_INSET,
                  width: cell.width - LOGO_INSET * 2, height: cell.height - LOGO_INSET * 2,
                }} />
            ) : (
              <img className={styles.logo} src={team.logoUrl} alt={team.name}
                style={{
                  left: cell.x + LOGO_INSET, top: cell.y + LOGO_INSET,
                  width: cell.width - LOGO_INSET * 2, height: cell.height - LOGO_INSET * 2,
                }} />
            )}
            {/* 순위 딱지 = 숫자 + img_text 307 "위" 오른쪽 정렬 (0x24) */}
            <div className={styles.rankTag} data-rank={rank}
              style={{ left: tag.x, top: tag.y, width: tag.width, height: tag.height }} />
            <SpriteNumber glyphs={rankGlyphsOf(rank)} right={rankDigitRightOf(tag)}
              boxTop={tag.y} boxHeight={tag.height} glyphHeight={RANK_GLYPH_HEIGHT} />
            <img className={styles.rankUnit} alt="위"
              src={`${RANK_UNIT.folder}/${String(RANK_UNIT.frame).padStart(3, '0')}.png`}
              style={{ left: rankUnitPositionOf(tag).x, top: rankUnitPositionOf(tag).y }} />
          </div>
        )
      })}

      {onNext !== undefined && (
        <Button variant="corner" className={styles.nextButton} onClick={onNext}>
          {nextLabel}
        </Button>
      )}
      {onShowStats !== undefined && (
        <Button variant="corner" className={styles.statsButton} onClick={onShowStats}>
          시즌 성적 ›
        </Button>
      )}
    </RawScreen>
  )
}
