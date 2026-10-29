import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { OUT_KIND, judgeOut, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { contextAt } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

export function runOutJudgement(g: RunnerPlayFrame, tick: number): void {
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
  // state[0x87] — 마지막 판정이 태그였나 (0xb36d0 꼬리)
  g.tagOut = judged.kind === OUT_KIND.TAG
  g.resultCode = RUNNER_PLAY_RESULT.OUT
  g.log.push(`${tick}틱 ${victim.state.index}번 주자 아웃 (0xb36d0 결과 ${judged.kind})`)
  const relaxed = releaseForcesAfterOut(runnerStates(g))
  g.runners.forEach((runner, index) => {
    runner.state = relaxed[index] ?? runner.state
  })
}

/** 공 쥐기 0xb2710 — 쥔 야수 +0xe0 = 1, P+0x130 = 야수, +0x12c = 1, state[0x1e] = 1, 그리고 vt90(0xb36d0) */
export function grab(g: RunnerPlayFrame, tick: number, slot: number, extra: Partial<FielderState> = {}): void {
  g.fielders = g.fielders.map((fielder) => fielderAfterGrab(fielder, slot, extra))
  // 0xb2710: +0x128 = 1 · +0x130 = f · +0x12c = 1 · +0x112 = 1 · state[0x1e] = 1 · 메시지 0x15 → 경기+0x19ac = 1
  g.play = { ...g.play, ballHolderSlot: slot, held: true, everHeld: true, wantsThrow: true }
  g.grabbed = true
  g.ballOnGround = true
  runOutJudgement(g, tick)
}

/** 쥔 야수만 공을 든다 — 다른 야수의 공 칸은 비운다 */
function fielderAfterGrab(fielder: FielderState, slot: number, extra: Partial<FielderState>): FielderState {
  if (fielder.slot === slot) return { ...fielder, ...extra, holdingBall: true }
  return fielder.holdingBall ? { ...fielder, holdingBall: false } : fielder
}
