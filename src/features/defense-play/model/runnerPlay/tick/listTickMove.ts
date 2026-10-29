import { clearsRequirement, requiredBasePinOf } from '@/entities/fielding/model/autoAdvance'
import { basePosition, isSamePoint, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { canStepNextListTick } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { isAtTarget } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import type { PlayRunner } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/** **6. 움직이기** — 다음 그림의 목록 틱(0x3f060)의 야수 · 주자 걸음 */
export function moveRunnerPlayListTick(g: RunnerPlayFrame): void {
  const beforeMove = g.fielders
  g.fielders = g.fielders.map(stepFielderOnListTick)
  // 야수 +0x3b — 이번 갱신에 목표점에 막 닿았나 (0xbf0dc). 다음 판 틱 3c 절 AI 2~5(b47f2)가 본다
  g.fielderArrivals = g.fielders.map(
    (fielder, slot) => !isSamePoint(beforeMove[slot]?.position ?? fielder.position, fielder.target) && isSamePoint(fielder.position, fielder.target),
  )
  for (const runner of g.runners) stepRunnerOnListTick(runner)
}

/**
 * 목표: AI 1(b4aca 포구 지점 · r190) · AI 0(b476a 시작 자리 · r180)은 AI 고리가 고쳤다 — 여기서는 그 목표로 걷는다.
 * 걸음: 다음 야수 틱의 이동 관문 a1346~a1376 — 0xa0f7c(+0xb0 바이트면 프레임 1 · 2 만) && vtc8(+0xb1 — 던진 뒤 한 틱) &&
 * +0xb4 ≤ 0 (`canStepNextListTick`). 걸음 a1376(0xbf094)은 AI · 공 쥠을 안 본다 — 쥔 야수도 목표로 마저 걷는다
 */
function stepFielderOnListTick(fielder: FielderState): FielderState {
  const target = fielder.target
  if (isSamePoint(fielder.position, target) || !canStepNextListTick(fielder)) return { ...fielder, target }
  return { ...fielder, target, position: stepToward(fielder.position, target, fielder.speed) }
}

/**
 * 주자 틱 — 주자 +0x3b 는 목록 틱마다 지우고(0xbf094 bf0a2) 막 닿은 갱신에서만 세운다. 다음 판 틱 2e 절 득점이 본다.
 * 주자 틱 a028c — 요구 루를 밟아 풀리기 전에는 그 너머로 못 간다 (`requiredBasePinOf`)
 */
function stepRunnerOnListTick(runner: PlayRunner): void {
  runner.arrivedThisListTick = false
  if (runner.state.isOut || runner.state.scored) return
  const pinned = requiredBasePinOf(runner.state)
  if (pinned !== runner.state.targetBase) {
    runner.state = { ...runner.state, legStart: runner.state.position, targetBase: pinned, settled: false }
  }
  runner.state = { ...runner.state, position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed) }
  if (!isAtTarget(runner.state) || runner.state.settled) return
  // 0xa040c 도착 — +0x84 = +0x8c = +0x7c, 요구 루를 밟았으면 푼다
  const touched = runner.state.targetBase
  runner.previousTarget = touched
  const cleared = clearsRequirement({ ...runner.state, settled: true, startBase: touched })
  runner.state = { ...runner.state, settled: true, startBase: touched, requiredBase: cleared ? NONE : runner.state.requiredBase }
  runner.arrivedThisListTick = true
}
