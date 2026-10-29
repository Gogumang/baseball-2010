import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { type DefenseContext, NONE, type PlayView } from '@/entities/fielding/model/fieldingState'
import { startLeg } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **판 시작의 자동 진루 `0xaf8c0(제어기, 1)`** (0x46766, 0x46418 의 리드 고리 0x3d7b8 뒤). 결정마다 플레이+0x128 = 1 (afa0e) ·
 * 목표가 바뀌는 주자만 새 구간을 연다(vt48 a07b0 은 같은 목표면 +0x84 = 옛 +0x7c 로 같은 값을 적을 뿐이다).
 * ⚠️ 이 줄의 `startLeg` 는 출발 루(+0x8c)를 옛 목표로 적는다 — 목표가 바뀌는 주자는 멈춰 섰거나(+0x7c == +0x8c) 리드 뒤
 * 제 루로 돌아오는 중(+0x7c == +0x8c)이라 같은 값이다.
 */
export function applyPlayStartAutoAdvance(context: DefenseContext, runners: readonly MutableRunner[]): PlayView {
  let play = context.play
  const decisions = autoAdvanceDecisions({
    ...context,
    force: true,
    previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
  })
  for (const decision of decisions) {
    play = { ...play, wantsThrow: true }
    const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner === undefined || decision.toBase === runner.state.targetBase) continue
    startLeg(runner, decision.toBase)
  }
  return play
}
