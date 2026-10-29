import { OUT_KIND, judgeOut, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { contextAt } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runnerStates } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { PICKOFF_RESULT } from '@/features/defense-play/model/pickoff/types/pickoffTypes'

export function runOutJudgement(g: PickoffFrame, tick: number): void {
  if (g.play.finished) return
  const judged = judgeOut(contextAt(g, tick))
  g.lastJudgedKind = judged.kind
  if (judged.kind === OUT_KIND.NONE) return
  const victim = g.runners[judged.runnerIndex]
  if (victim === undefined || victim.state.isOut) return
  victim.state = { ...victim.state, isOut: true, settled: true }
  g.outs += 1
  g.outsAdded += 1
  g.outJudgedThisTick = true
  g.tagOut = judged.kind === OUT_KIND.TAG
  g.resultCode = PICKOFF_RESULT.OUT
  g.log.push(`${tick}틱 ${victim.state.index}번 주자 견제사 (0xb36d0 결과 ${judged.kind})`)
  const relaxed = releaseForcesAfterOut(runnerStates(g))
  g.runners.forEach((runner, index) => {
    runner.state = relaxed[index] ?? runner.state
  })
}
