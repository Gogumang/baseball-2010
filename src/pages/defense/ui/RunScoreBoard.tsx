import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { RUN_SCORE_BOARD_FRAME_AT, RUN_SCORE_SLOTS, runScoreGlyphsOf } from '@/pages/defense/lib/runScoreBoard'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

const NUM = './sprites/num'

export interface RunScoreBoardProps {
  /** 점수판 틀 0x41440 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21) */
  readonly sides: readonly [ScoreboardSide, ScoreboardSide]
  /** 판에 보이는 두 점수 (측 0 · 측 1) — `runScoreBoardScoresOf` 로 이미 1 을 뺀 값 */
  readonly scores: readonly [number, number]
}

/** **수비 장면 득점 점수판 0x41a64** — 틀 (0, 0x32) 와 두 점수. 머리말은 `lib/runScoreBoard` */
export function RunScoreBoard({ sides, scores }: RunScoreBoardProps) {
  return (
    <div className={styles.runScoreBoard} data-testid="수비-득점판">
      <ScoreboardFrame {...RUN_SCORE_BOARD_FRAME_AT} side0={sides[0]} side1={sides[1]} />
      {RUN_SCORE_SLOTS.map((slot, side) => (
        <span key={side} data-testid={`수비-득점판-점수-${side}`} data-value={scores[side]}>
          {runScoreGlyphsOf(scores[side]!, slot).map((glyph, index) => (
            <img key={index} className={styles.runScoreDigit} alt="" src={`${NUM}/${String(glyph.image).padStart(3, '0')}.png`}
              style={{ left: glyph.x, top: glyph.y }} />
          ))}
        </span>
      ))}
    </div>
  )
}
