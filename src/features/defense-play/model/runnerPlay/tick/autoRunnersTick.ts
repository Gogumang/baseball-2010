import { SLIDING_SOUND_EFFECT, SLIDING_SPEED_BONUS, autoSlideRunnerIndexes } from '@/entities/defense-controls/model/sliding'
import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { HOME_BASE } from '@/features/defense-play/model/runnerPlay/constants'
import { contextAt } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { slidingRunnerOf, startLeg } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import type { PlayRunner } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **4. 자동 추가 진루 0xaf918 · 자동 슬라이딩 0xb030c** — 결과 코드(9·13)가 선 뒤에도 돈다: 슬롯 2 의 52660 은 판 진행 관문 0xb0d28 이
 * 열려 있으면 매 틱 부르고 결과 코드를 안 본다
 */
export function runRunnerPlayAutoRunners(g: RunnerPlayFrame, tick: number): void {
  if (g.play.finished) return
  if (g.autoBaserunningEnabled) runAutoAdvance(g, tick)
  runAutoSlide(g, tick)
}

/** 52660 `0xaf8c0(제어기, 0)` — force = 0: 멈춘 주자(제 목표 루에 선 주자)만 본다. force = 1 은 판 시작 0x46766 한 번 */
function runAutoAdvance(g: RunnerPlayFrame, tick: number): void {
  const decisions = autoAdvanceDecisions({ ...contextAt(g, tick), force: false })
  for (const decision of decisions) {
    const runner = g.runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner !== undefined) applyAutoAdvance(g, tick, runner, decision.toBase)
  }
}

/**
 * afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다.
 * 한 루 더 보내면 플레이+0x128 = 1
 */
function applyAutoAdvance(g: RunnerPlayFrame, tick: number, runner: PlayRunner, toBase: number): void {
  const finished = runner.state.isOut || runner.state.scored
  if (!finished && toBase > HOME_BASE) return
  if (!finished) startLeg(runner, toBase)
  g.play = { ...g.play, wantsThrow: true }
  if (!finished) pushPlayLog(g.log, () => `${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${toBase}루`)
}

/** 자동 슬라이딩 0xb030c — 0x52670: 슬라이딩시킨 수 > 0 이면 그 자리에서 효과음 10 (0x5268c, 잠금 없음) */
function runAutoSlide(g: RunnerPlayFrame, tick: number): void {
  const slid = autoSlideRunnerIndexes({ ...throwInFlightOf(g, tick), runners: g.runners.map((runner) => slidingRunnerOf(runner.state)) })
  for (const index of slid) {
    const runner = g.runners[index]
    if (runner === undefined) continue
    runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
    pushPlayLog(g.log, () => `${tick}틱 ${runner.state.index}번 주자 자동 슬라이딩`)
  }
  if (slid.length === 0) return
  g.sound.slidingThisTick = true
  g.sound.thisTick.push(SLIDING_SOUND_EFFECT)
}

/** 날아가는 송구 — 받는 틱 전이면 그 목표 루와 남은 틱 */
function throwInFlightOf(g: RunnerPlayFrame, tick: number) {
  const flight = g.flight
  const chase = g.chase
  if (flight === null || chase === null) return { isThrowInFlight: false, throwTargetBase: NONE, throwArrivalTicks: -1 }
  const throwing = tick < chase.catchTick
  return { isThrowInFlight: throwing, throwTargetBase: throwing ? flight.base : NONE, throwArrivalTicks: chase.catchTick - tick }
}
