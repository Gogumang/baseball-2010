import { basePosition, isSamePoint, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { canStepNextListTick } from '@/entities/fielding/model/fielderPose'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { isAtTarget } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'

/** 이동 절 */
export function movePickoffListTick(g: PickoffFrame): void {
  // ── 한 틱 움직이기 — 커버는 제 루로, 쫓는 야수는 포구 지점(x, 0, z)으로(AI 1), 나머지는 제자리 ──
  const beforeMove = g.fielders
  g.fielders = g.fielders.map((fielder) => {
    // 목표: AI 1(b4aca 포구 지점 · r190) · AI 0(b476a 시작 자리 · r180)은 AI 고리가 고쳤다 — 여기서는 그 목표로 걷는다
    const target = fielder.target
    // 걸음: 다음 야수 틱의 이동 관문 a1346~a1376(`canStepNextListTick`) — 던진 야수(+0xb1)는 한 틱 쉬고, 쥔 야수도 목표로 걷는다
    if (isSamePoint(fielder.position, target) || !canStepNextListTick(fielder)) return { ...fielder, target }
    return { ...fielder, target, position: stepToward(fielder.position, target, fielder.speed) }
  })
  // 야수 +0x3b — 이번 갱신에 목표점에 막 닿았나 (0xbf0dc). 다음 판 틱 AI 2~5(b47f2)가 본다
  g.fielderArrivals = g.fielders.map(
    (fielder, slot) => !isSamePoint(beforeMove[slot]?.position ?? fielder.position, fielder.target) && isSamePoint(fielder.position, fielder.target),
  )
  for (const runner of g.runners) {
    // 주자 +0x3b — 목록 틱마다 지우고(0xbf094 bf0a2) 막 닿은 갱신에서만 세운다. 다음 판 틱 득점 0xaa0a8 이 본다
    runner.arrivedThisListTick = false
    if (runner.state.isOut || runner.state.scored) continue
    runner.state = {
      ...runner.state,
      position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed),
    }
    if (!isAtTarget(runner.state) || runner.state.settled) continue
    // 0xa040c 도착 — +0x84 = +0x8c = +0x7c
    const touched = runner.state.targetBase
    runner.previousTarget = touched
    runner.state = { ...runner.state, settled: true, startBase: touched }
    runner.arrivedThisListTick = true
  }
}
