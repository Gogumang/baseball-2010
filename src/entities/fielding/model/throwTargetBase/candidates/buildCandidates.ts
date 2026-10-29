import { NONE, runnerOneMoreBaseTicks, runnerRemainingTicks, type RunnerState } from '@/entities/fielding/model/fieldingState'
import { isForcedRunner } from '@/entities/fielding/model/throwTargetBase/forcedRunner'
import { wrapBase, type BaseCandidate, type ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

const emptyCandidate = (): BaseCandidate => ({ runTick: NONE, force: false, forced: false, defTick: 0, rethrow: [0, 0, 0, 0] })

/** afbd0: 판정끝 · 요구 루가 있음 · 타자주자 아님 — 요구 루 칸에 의무 표시를 단다 */
const owesRequiredBase = (runner: RunnerState) => runner.settled && runner.requiredBase >= 0 && !runner.isBatterRunner

/**
 * 후보표를 채운다 (S7 2절). 주자 칸은 **+0x7c(달려가는 루)** 다 — 직접 뜬 것:
 * ```
 * afbae: 칸 = [R+0x78+4] & 3                       ; +0x7c
 * afbc6: +0x96(아웃) → 건너뜀
 * afbd0: +0x94 && +0x88 ≥ 0 && !+0x98 이면          ; 판정끝 · 요구 루 · 타자주자 아님
 * afbe6:   표[+0x88 & 3].force = 1
 * afbf4:   +0x7c > +0x88 → 표[+0x88 & 3].runTick = vt0xa0 (한 루 더) , 아니면 0xbefec (남은 틱)
 * afc36: 아니면 표[칸].runTick = 0xbefec
 * afc40: 표[칸].forced = 플레이.vt0x80(i)            ; ★ +0x88 갈래여도 forced 는 +0x7c 칸에 적는다
 * ```
 */
export function buildCandidates(input: ThrowTargetInput): BaseCandidate[] {
  const { play, runners } = input
  const table = Array.from({ length: 4 }, emptyCandidate)
  runners.forEach((runner, index) => {
    if (runner.isOut) return
    const slot = wrapBase(runner.targetBase)
    if (owesRequiredBase(runner)) {
      const required = table[wrapBase(runner.requiredBase)]
      required.force = true
      // 되돌아가야 하면 "한 루 더 가는 총 틱"(vt0xa0), 앞으로 가면 남은 틱(0xbefec)
      required.runTick = runner.targetBase > runner.requiredBase ? runnerOneMoreBaseTicks(runner) : runnerRemainingTicks(runner)
    } else {
      table[slot].runTick = runnerRemainingTicks(runner)
    }
    table[slot].forced = isForcedRunner(play, runners, index)
  })
  return table
}
