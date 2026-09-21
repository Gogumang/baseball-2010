import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import type { PostseasonSeries } from '@/entities/league/model/league'
import {
  BRACKET_BACKDROP, LEG_ORDER, LINE_COLOR, LINE_SEGMENTS, LOGO_INSET, RANK_TAGS, TEAM_CELLS,
  WON_LINE_COLOR, bracketViewOf, cellIndexOfRank,
} from '@/widgets/season/lib/postseasonBracketLayout'
import * as styles from '@/widgets/season/ui/SeasonEndWindow.css'

export interface PostseasonBracketWindowProps {
  /** 진행 중인 포스트시즌. 아직 없으면 빈 대진표를 그린다 */
  readonly series: PostseasonSeries | null
}

/**
 * 포스트시즌 대진표 (그리기 **0x853ac** — P6 4a-1 **확정**).
 *
 * mode_ui 프레임 53(195×210) 계단 그림을 앵커 (0,0) 에 통째로 깔고, 그 프레임 박스 0~3 에 팀 로고를
 * (+3), 박스 4~7 에 "N위" 딱지를 얹는다. 대진 선은 그림 없는 프레임 54~57 의 2px 박스를 먼저
 * **#08044A** 로 모두 채운 뒤, **이긴 길만 빨강 RGB(255,0,0)** 으로 다시 채운다 (0x855b4~0x857ec).
 *
 * 안 옮긴 것 (원본에 있으나 문서가 '유력'·'다른 몫'이라 뺐다):
 *  - "프레임 54 박스 0 영역을 단계 7 로 어둡게"(0x7f4ed) — P6 도 '유력'
 *  - 우승/탈락 문구(0x85e6c)는 공용 팝업 몫이다 (P6 4a-3) → `SeasonSummaryScreen` 이 띄운다
 *
 * ⚠️ 타자편 `src/pages/season-end/ui/PostseasonBracket.tsx` 와 **같은 그림**이다.
 * 페이지끼리는 못 쓰므로 위젯으로 따로 두었고, 좌표는 `postseasonBracketLayout.ts` 에 옮겨 적었다.
 */
export function PostseasonBracketWindow({ series }: PostseasonBracketWindowProps) {
  const origins = useFrameOrigins(BRACKET_BACKDROP.folder)
  const view = bracketViewOf(series)
  const wonLegs = new Set(view.wonLegs)

  return (
    <div role="group" aria-label="포스트시즌 대진표">
      <FrameSprite
        folder={BRACKET_BACKDROP.folder}
        frame={BRACKET_BACKDROP.frame}
        origins={origins}
        x={BRACKET_BACKDROP.anchorX}
        y={BRACKET_BACKDROP.anchorY}
      />

      {LEG_ORDER.flatMap((leg) =>
        LINE_SEGMENTS[leg].map((box, index) => (
          <div
            key={`${leg}-${index}`}
            className={styles.segment}
            data-leg={leg}
            data-won={wonLegs.has(leg) ? 'true' : 'false'}
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              background: wonLegs.has(leg) ? WON_LINE_COLOR : LINE_COLOR,
            }}
          />
        )),
      )}

      {[1, 2, 3, 4].map((rank) => {
        const cell = TEAM_CELLS[cellIndexOfRank(rank)]
        const tag = RANK_TAGS[cellIndexOfRank(rank)]
        const teamId = view.seeds[rank - 1]
        const team = teamId === null || teamId === undefined ? undefined : TEAMS[teamId]
        const box = {
          left: cell.x + LOGO_INSET,
          top: cell.y + LOGO_INSET,
          width: cell.width - LOGO_INSET * 2,
          height: cell.height - LOGO_INSET * 2,
        }
        return (
          <div key={rank}>
            {team === undefined ? (
              // 아직 자리가 안 정해진 칸 — 원본은 빈 칸을 그냥 비워 둔다
              <div className={styles.emptyCell} style={box} />
            ) : (
              <img className={styles.logo} src={team.logoUrl} alt={team.name} style={box} />
            )}
            {/*
              ⚠️ 순위 딱지 글이 아직 **글자**다. 타자편 `pages/season-end` 쪽은 원본대로
              숫자 그림 + img_text 307 "위" 로 바꿨고, 여기 쓸 값도 `postseasonBracketLayout.ts`
              에 다 넣어 두었다(`RANK_UNIT` · `rankGlyphsOf` · `rankUnitPositionOf`).
              이 위젯만 못 바꾼 이유: 쓰는 쪽 시험이 `src/pages/season/ui/PostseasonStartScreen.test.tsx`
              (다른 담당 폴더) 에 있어 "N위" 글자와 `img` 개수를 못박고 있다. 그 시험을 같이 고쳐야 한다.
            */}
            <div
              className={styles.rankTag}
              data-rank={rank}
              style={{ left: tag.x, top: tag.y, width: tag.width, height: tag.height }}
            >
              {rank}위
            </div>
          </div>
        )
      })}
    </div>
  )
}
