import { lineScorePlacementOf } from '@/widgets/line-score/lib/lineScoreLayout'
import type { LineScoreGlyph, LineScoreState } from '@/widgets/line-score/lib/lineScoreLayout'
import * as styles from '@/widgets/line-score/ui/LineScoreBoard.css'

const GAME_UI_FOLDER = './sprites/game_ui'
const NUM_FOLDER = './sprites/num'
const SMALL_LOGO_FOLDER = './sprites/team_logo_ini'
const pad = (value: number) => String(value).padStart(3, '0')

interface LineScoreBoardProps extends LineScoreState {
  /** 부르는 곳의 (x, y) — `LINE_SCORE_AT` */
  readonly x: number
  readonly y: number
  /** 측 0 · 측 1 팀 — 적재 0x48a38~0x48a74 가 [장면+0x1054]/[+0x1058] 에 team_logo_ini 그림[팀] 을 싣는다 */
  readonly sideTeams: readonly [number, number]
}

function Glyphs({ glyphs, testId }: { readonly glyphs: readonly LineScoreGlyph[]; readonly testId: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img key={index} className={styles.sprite} style={{ left: glyph.x, top: glyph.y }}
          src={`${NUM_FOLDER}/${pad(glyph.image)}.png`} alt="" data-testid={testId} data-image={glyph.image} />
      ))}
    </>
  )
}

/**
 * **이닝별 점수판 0x41c18** — 좌표 · 흐름은 `lib/lineScoreLayout` 머리말. 0x21 중계(0x4258c)와 0x18 경기 끝 판(0x4fe9c)이 부른다.
 * 240×320 원본 좌표에 절대 배치하므로 `RawScreen` 안에 둔다.
 */
export function LineScoreBoard({ x, y, sideTeams, ...state }: LineScoreBoardProps) {
  const placement = lineScorePlacementOf(x, y, state)
  return (
    <div className={styles.group} data-testid="이닝별점수판" data-x={x} data-y={y}>
      {placement.rects.map((rect, index) => (
        <span key={index} className={styles.block}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, background: rect.color }} />
      ))}
      {placement.logos.map((at, side) => (
        <img key={side} className={styles.sprite} style={{ left: at.x, top: at.y }}
          src={`${SMALL_LOGO_FOLDER}/${pad(sideTeams[side] ?? 0)}.png`} alt="" data-testid={`이닝별점수판-로고-${side}`} />
      ))}
      <Glyphs glyphs={placement.inningNumbers} testId="이닝별점수판-이닝" />
      <Glyphs glyphs={placement.runs} testId="이닝별점수판-점수" />
      <Glyphs glyphs={placement.totals} testId="이닝별점수판-합" />
      {placement.images.map((image) => (
        <img key={image.image} className={styles.sprite} style={{ left: image.x, top: image.y }}
          src={`${GAME_UI_FOLDER}/${pad(image.image)}.png`} alt="" data-testid={`이닝별점수판-그림-${image.image}`} />
      ))}
    </div>
  )
}
