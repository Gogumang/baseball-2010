import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'
import { openRunnerPlay } from '@/features/defense-play/model/runnerPlay/frame/openRunnerPlay'
import { runPlayStartDecisions } from '@/features/defense-play/model/runnerPlay/frame/playStart'
import { runnerPlayResultOf } from '@/features/defense-play/model/runnerPlay/result/runnerPlayResult'
import { runRunnerPlayTick } from '@/features/defense-play/model/runnerPlay/tick/runnerPlayTick'
import type {
  RunnerPlayEngineInput,
  RunnerPlayEngineResult,
  RunnerPlayStepper,
  RunnerPlayTickSound,
} from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

export function startRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayStepper {
  const ticks: DefensePlayView[] = []
  const sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] }
  const steps = runnerPlaySteps(input, ticks, sound)
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
      if (current.done !== true) throw new Error('주자 판이 아직 안 끝났다')
      return current.value
    },
  }
}

/** 판 하나를 끝까지 돌린다 — 키는 `controls.keyAt(틱)` 으로 묻는다 */
export function runRunnerPlay(input: RunnerPlayEngineInput): RunnerPlayEngineResult {
  const stepper = startRunnerPlay(input)
  while (!stepper.finished) stepper.step(input.controls?.keyAt(stepper.tick) ?? null)
  return stepper.result()
}

/**
 * 판 하나의 차례 — 판 시작(`openRunnerPlay` · 0x46766 의 자동 진루 한 번)은 첫 `next()` 에 돌고, 그 뒤 틱마다 키를 받아
 * `runRunnerPlayTick` 한 번. 제너레이터 모양(틱 머리의 `yield`)이 곧 사람 키를 받는 자리라 그대로 둔다.
 */
function* runnerPlaySteps(
  input: RunnerPlayEngineInput,
  ticks: DefensePlayView[],
  sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] },
): Generator<number, RunnerPlayEngineResult, DefenseKeyPress | null> {
  const g = openRunnerPlay(input, ticks, sound)
  runPlayStartDecisions(g)
  for (let tick = 0; g.input.throwDecisionOnly !== true && tick <= g.maximumTicks && !g.play.finished; tick += 1) {
    const press = yield tick
    runRunnerPlayTick(g, tick, press)
  }
  return runnerPlayResultOf(g)
}
