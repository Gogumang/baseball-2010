import { runScoreBoardHiddenScoresOf } from '@/pages/defense/lib/runScoreBoard'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

/** 수비 장면 득점 점수판 0x41a64 의 재료 — 플레이가 시작될 때의 경기 (`lib/runScoreBoard`) */
export interface RunScoreBoardSource {
  /** 점수판 틀 0x41440 의 두 측 */
  readonly sides: readonly [ScoreboardSide, ScoreboardSide]
  /** 플레이 시작 때 두 점수 0xb69b0(st, 0/1) */
  readonly scores: readonly [number, number]
  /** st[9] — 지금 공격하는 측. 이 플레이의 득점(`held.scoreboardRuns`)이 이 측에 붙는다 */
  readonly battingSide: number
}

/** 점수판에 적을 두 점수 — 공격 쪽에 이 판의 득점을 더하고, 그 갈래가 숨기는 만큼(`hidden`) 뺀다 */
export function runScoreBoardScoresOf(source: RunScoreBoardSource, runs: number, hidden: number): readonly [number, number] {
  const scores: readonly [number, number] = [
    source.scores[0] + (source.battingSide === 0 ? runs : 0),
    source.scores[1] + (source.battingSide === 1 ? runs : 0),
  ]
  return runScoreBoardHiddenScoresOf(scores, source.battingSide, hidden)
}

/** 재생 · 주자 판 셈의 점수판 — 판이 서 있고 아직 안 끝났을 때만 */
export function tallyBoardScoresOf(
  source: RunScoreBoardSource | undefined,
  tally: { readonly visible: boolean; readonly ended: boolean; readonly runs: number; readonly hidden: number },
): readonly [number, number] | null {
  if (source === undefined || !tally.visible || tally.ended) return null
  return runScoreBoardScoresOf(source, tally.runs, tally.hidden)
}
