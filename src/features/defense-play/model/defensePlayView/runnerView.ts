import type { DefenseRunner } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { recordActionTick } from '@/features/defense-play/model/defensePlayView/actionMemory'
import { runnerActionOf } from '@/features/defense-play/model/defensePlayView/figureActions'
import type { ViewStateInput } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { slideDustDirectionOf } from '@/features/defense-play/model/playerEffects'

/** 주자 한 명의 그림 칸 — 동작 기억(`previousActions`)을 고친다 */
export function recordRunnerView(runner: RunnerState, input: ViewStateInput): DefenseRunner {
  const action = runnerActionOf(runner, input)
  return {
    index: runner.index,
    x: runner.position.x,
    z: runner.position.z,
    action,
    actionTick: recordActionTick(input.previousActions, `r${runner.index}`, action, input.tick),
    base: ((runner.targetBase % 4) + 4) % 4,
    isAdvancing: runner.targetBase > runner.startBase,
    // 아웃된 주자도 걸어 나가는 동안은 그린다 (R3 3-4)
    isVisible: true,
    teamIndex: input.offenseTeamIndex ?? null,
    // +0x96 = 아웃 또는 홈 밟음 (`runnerFates` — 웹 isOut 은 아웃만이라 scored 를 더한다)
    isFinished: runner.isOut || runner.scored,
    // 0x43b0a: 주자 +0xb8(슬라이딩 중)이면 0x9ff40 방향
    slideDirection: runner.sliding ? slideDustDirectionOf(runner, input.previousTargetOf?.(runner.index) ?? runner.startBase) : 0,
    // 0x43aa8 — 주자 +0x9c ≠ −1
    isAce: input.runnerAceIndexes?.[runner.index] != null,
  }
}
