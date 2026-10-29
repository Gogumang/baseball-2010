import { drawRunScoreBoardScene } from '@/pages/defense/lib/runScoreBoard'
import type { LiveContext, LivePlaybackSlots, RunScoreBoardView } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { runScoreBoardScoresOf } from '@/pages/defense/ui/playback/runScoreBoardView'

/** 득점 점수판 그리기 0x41a64 한 번 — 타이머를 줄이고, 판이 보이면 공격 쪽 점수에서 그 갈래가 숨기는 만큼 뺀 모습을 낸다 */
export function drawLiveBoard(
  slots: LivePlaybackSlots,
  ctx: Pick<LiveContext, 'homeRunHit' | 'runScoreBoard'>,
  runs: number,
): RunScoreBoardView | null {
  const drawn = drawRunScoreBoardScene(slots.board, ctx.homeRunHit)
  slots.board = drawn.next
  if (ctx.runScoreBoard === undefined || !drawn.visible) return null
  return { scores: runScoreBoardScoresOf(ctx.runScoreBoard, runs, drawn.hidden) }
}
