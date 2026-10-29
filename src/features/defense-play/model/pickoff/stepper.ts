import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView'
import { MAXIMUM_TICKS } from '@/features/defense-play/model/pickoff/constants'
import { contextAt } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import { openPickoffPlay } from '@/features/defense-play/model/pickoff/frame/openPickoffPlay'
import { pickoffResultOf } from '@/features/defense-play/model/pickoff/result/pickoffResult'
import { runPickoffTick } from '@/features/defense-play/model/pickoff/tick/pickoffTick'
import type { PickoffPlayInput, PickoffPlayResult, PickoffPlayStepper } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerPlayTickSound } from '@/features/defense-play/model/runnerPlayEngine'

export function startPickoffPlay(input: PickoffPlayInput): PickoffPlayStepper {
  const ticks: DefensePlayView[] = []
  const sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] }
  const steps = pickoffPlaySteps(input, ticks, sound)
  let current = steps.next(null)
  return {
    get slidingSoundThisTick() {
      return sound.slidingThisTick
    },
    get soundsThisTick() {
      return sound.thisTick
    },
    get tick() {
      return current.done === true ? ticks.length : current.value
    },
    get finished() {
      return current.done === true
    },
    ticks,
    step(press) {
      if (current.done === true) return
      current = steps.next(press)
    },
    result() {
      if (current.done !== true) throw new Error('견제 판이 아직 안 끝났다')
      return current.value
    },
  }
}

export function runPickoffPlay(input: PickoffPlayInput): PickoffPlayResult {
  const stepper = startPickoffPlay(input)
  while (!stepper.finished) stepper.step(input.controls?.keyAt(stepper.tick) ?? null)
  return stepper.result()
}

/**
 * 판 하나의 차례 — 판 시작(`openPickoffPlay` · 0x46766)은 첫 `next()` 에 돌고, 그 뒤 틱마다 키를 받아 `runPickoffTick` 한 번.
 * 제너레이터 모양(틱 머리의 `yield`)이 곧 사람 키를 받는 자리라 그대로 둔다.
 */
function* pickoffPlaySteps(
  input: PickoffPlayInput,
  ticks: DefensePlayView[],
  sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] },
): Generator<number, PickoffPlayResult, DefenseKeyPress | null> {
  const g = openPickoffPlay(input, ticks, sound)
  // ── 0x46766 — 0x17 진입 0x46418 끝: 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 한 번(주루 설정 갈림 없음).
  //    결정마다 +0x128 = 1(afa0e). 목표는 바로 뒤 4677a~467a4 가 종류 4 면 산 주자 넷 모두 vt48(+0x8c) 로 되돌리므로
  //    (2 절 "제 루로 돌아오는 중") 견제 판에서는 남지 않는다 — 여기서도 목표를 안 바꾼다. 굴림 없음.
  if (autoAdvanceDecisions({ ...contextAt(g, 0), force: true }).length > 0) g.play = { ...g.play, wantsThrow: true }
  for (let tick = 0; tick <= MAXIMUM_TICKS && !g.play.finished; tick += 1) {
    const press = yield tick
    runPickoffTick(g, tick, press)
  }
  return pickoffResultOf(g)
}
