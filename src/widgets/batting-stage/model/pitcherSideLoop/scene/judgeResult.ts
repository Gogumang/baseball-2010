/** 0x12 판정 글자(0x393b4) — 글자와 삼진 양끝 파티클(394b2 · 394d2) */
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { judgeTextOf } from '@/widgets/batting-stage/lib/stageText'
import { strikeoutJudgeParticlesOf } from '@/widgets/batting-stage/lib/judgeParticles'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

/** 0x12 문턱이 0x1f(타석을 끝낸 공 — `resultWaitTicksOf`)인가 — 판정 글자 삼진 · 볼넷(`judgeTextOf`)을 가른다 */
const AT_BAT_END_RESULT_WAIT_TICKS = 0x1f
const endsAtBatOf = (resultTicks: number): boolean => resultTicks >= AT_BAT_END_RESULT_WAIT_TICKS

/** 판정 글자 — 0x12 진입이 판정 칸을 지웠으면(`isJudgementCleared`) 삼진 글자가 없다 */
export function judgeTextNowOf(frame: PitcherSideFrame, resolution: PitchResolution): string {
  const { current } = frame
  return judgeTextOf(resolution, endsAtBatOf(current.resultTicks), current.isJudgementCleared === true)
}

/** 0x12 틱 0 의 그림 — 판정 글자가 삼진이면 양끝 파티클. 틀이 틱 0 을 건너뛰었으면 그 뒤 첫 그림에서 한 번 */
export function emitStrikeoutJudgeParticles(loop: PitcherSideLoop, frame: PitcherSideFrame): void {
  const { resolution } = frame
  if (frame.stage.phase.kind !== '결과' || resolution === null || loop.marks.strikeoutShot) return
  loop.marks.strikeoutShot = true
  for (const shot of strikeoutJudgeParticlesOf(judgeTextNowOf(frame, resolution), frame.side)) {
    loop.emitParticle(shot.id, shot.x, shot.y, shot.img)
  }
}
