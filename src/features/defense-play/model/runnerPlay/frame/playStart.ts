import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { contextAt } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { startLeg } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollCpuThrowDecision } from '@/features/defense-play/model/runnerPlay/throw/cpuThrowDecision'

/**
 * **0x46766** — 0x17 진입 0x46418 끝: 판 진행 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 을 **한 번**, 주루 설정
 * 갈림(0xae690) 없이 부른다(타구 진행기 `applyPlayStartAutoAdvance` 와 같은 자리). force = 1 이라 리드 뒤 달리는 주자까지 본다.
 * 결정마다 +0x128 = 1(afa0e), 목표가 바뀌는 주자만 새 구간(vt48 은 같은 목표면 그대로). 굴림 없음.
 * 도루 키 0x583 의 0xafa60 한 번 — 판을 안 연다(`throwDecisionOnly`)
 */
export function runPlayStartDecisions(g: RunnerPlayFrame): void {
  if (g.input.throwDecisionOnly === true) {
    rollCpuThrowDecision(g, 0)
    return
  }
  for (const decision of autoAdvanceDecisions({ ...contextAt(g, 0), force: true })) {
    g.play = { ...g.play, wantsThrow: true }
    const runner = g.runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner === undefined || decision.toBase === runner.state.targetBase) continue
    startLeg(runner, decision.toBase)
    g.log.push(`판 시작 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
  }
}
