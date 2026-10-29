import { isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { canStepNextListTick } from '@/entities/fielding/model/fielderPose'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { moveFielder } from '@/features/defense-play/model/defensePlay/fielders/moveFielder'
import { stepRunnerOnListTick } from '@/features/defense-play/model/defensePlay/listTick/listTickRunners'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **6. 한 틱 움직이기** — 다음 그림 목록 틱(0x3f060)의 야수 · 주자 걸음. 키 건너뛰기가 풀린 그림 다음 그림의 목록 틱
 * (9 절 `passFastForwardGates`)도 같은 이동이다. 추적야수 AI 1(0xb4afe)의 목표(+0x127 && 낙구 틱 ≥ 공+0x68 이면 낙구 지점,
 * 아니면 포구 지점)는 AI 고리 1c 절이 고쳤다(r190)
 */
export function listTickMove(s: DefensePlayState, t: TickFrame): void {
  const beforeMove = s.fielders
  s.fielders = s.fielders.map((fielder) => stepFielderOnListTick(s, t, fielder))
  // 야수+0x3b — 이번 갱신에 목표점에 막 닿았나 (0xbf0dc: 머리에서 지우고 닿은 갱신에서만 1). 다음 판 틱 6c 절이 본다
  s.fielderArrivals = s.fielders.map(
    (fielder, slot) => !isSamePoint(beforeMove[slot]?.position ?? fielder.position, fielder.target) && isSamePoint(fielder.position, fielder.target),
  )
  for (const runner of s.runners) stepRunnerOnListTick(runner)
}

/**
 * 이 걸음은 원본의 **다음** 야수 틱 0xa1284 몫이다(0x3f060 목록 틱이 슬롯 2 플레이 틱보다 먼저 — 9 · 10 절).
 * 그 틱은 a12b4 에서 +0xb4 > 0 이면 −1 만 하고 a12c6/a12d6 에서 끝나 a1376 이동(0xbf094)까지 못 간다 — 곧 막는 값은
 * **지금(이 틱 플레이 갈래 뒤)의 +0xb4** 다. 머리 0' 절의 `lockedThisTick` 은 원본 이 틱 몫이라 한 틱 이르다(r155):
 * 포구 틱 b4588 vt74 가 +0xb4 = 15 를 세운 그 틱의 걸음부터 15번을 막고, 잠금이 0 이 된 틱(머리 1 → 0)의 걸음은 걷는다.
 * a1346~a1376 — 그 야수 틱의 이동 관문: 0xa0f7c(+0xb0 바이트 == 0 || 프레임 ∈ {1, 2}) && vtc8(+0xb1 · +0xcc) (r171).
 * 점프 · 가슴 높이 포구 동작은 프레임 1 · 2 만 걷고, 던진 야수(+0xb1)는 한 번 쉰다. 목표는 AI 가 그대로 고른다
 */
function stepFielderOnListTick(s: DefensePlayState, t: TickFrame, fielder: FielderState): FielderState {
  if (fielder.actionLockTicks > 0) return fielder
  return moveFielder(fielder, { chaserSlot: s.chaserSlot, tick: t.tick, catchTick: s.catchTick, canStep: canStepNextListTick(fielder) })
}
