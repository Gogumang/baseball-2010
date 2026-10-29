import type { DefenseFielder } from '@/entities/fielding/model/defenseView/defenseFigures'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { recordActionTick, type ActionMemory } from '@/features/defense-play/model/defensePlayView/actionMemory'
import { aceIndexOf } from '@/features/defense-play/model/defensePlayView/aceIndexes'
import { fielderActionOf } from '@/features/defense-play/model/defensePlayView/figureActions'
import type { ViewStateInput } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { DUST_TRAIL_OFF, stepDustTrail, type DustTrailState } from '@/features/defense-play/model/playerEffects'
import { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'

/**
 * 야수마다의 달리기 먼지 자국 상태 — 그리기가 돌리는 칸이라 스냅샷 한 장마다 한 걸음 간다.
 * 진행기마다 판 하나 동안 들고 있는 `previousActions` 에 붙여 둔다(따로 넘길 칸을 늘리지 않으려고).
 */
const dustTrailsOf = new WeakMap<ActionMemory, DustTrailState[]>()

/** 야수 한 명의 그림 칸 — 동작 기억(`previousActions`)과 먼지 자국 칸을 한 걸음 고친다 */
export function recordFielderView(fielder: FielderState, input: ViewStateInput): DefenseFielder {
  const action = fielderActionOf(fielder, input)
  const trail = stepFielderDustTrail(input.previousActions, fielder.slot, action, fielder.position)
  return {
    slot: fielder.slot,
    x: fielder.position.x,
    z: fielder.position.z,
    // 그림 · 결과 판 자리는 (x, z − y) — 야수 높이는 원본에서도 늘 0 이다(`DefenseFielder.y`)
    y: fielder.position.y,
    action,
    actionTick: recordActionTick(input.previousActions, `f${fielder.slot}`, action, input.tick),
    aceIndex: aceIndexOf(input.aceIndexes, fielder.slot),
    teamIndex: input.defenseTeamIndex ?? null,
    ...recordSeatOf(input.fielderRecords, fielder.slot),
    catchFlag: isCatchFlagAction(action),
    lockTicks: fielder.actionLockTicks,
    fumbleTicks: input.fumbleTicks?.[fielder.slot] ?? 0,
    throwErrorTicks: input.throwErrorTicks?.[fielder.slot] ?? 0,
    dustTrail: dustTrailMarkOf(trail),
  }
}

/** 야수 +0xec 선수 레코드 칸 — 표를 안 줬으면 칸째 싣지 않는다 */
function recordSeatOf(records: ViewStateInput['fielderRecords'], slot: number): Pick<DefenseFielder, 'record'> {
  return records === undefined ? {} : { record: records[slot] ?? null }
}

/** +0xb0 — 세우는 곳이 가슴 높이(7) · 점프(0xe) 포구 세터뿐이고 동작이 끝나면 지운다 (근사: 지금 동작이 그 둘이면 선 것으로 본다) */
function isCatchFlagAction(action: number): boolean {
  return action === FIELDER_ACTION.catchChest || action === FIELDER_ACTION.jumpCatch
}

/** 이번 그림에 찍을 먼지 자국 — 바닥 (x, z − y) 와 player_effect 프레임 */
function dustTrailMarkOf(trail: ReturnType<typeof stepDustTrail>): DefenseFielder['dustTrail'] {
  if (trail.mark === null) return null
  return { x: trail.mark.point.x, z: trail.mark.point.z - trail.mark.point.y, frame: trail.mark.frame }
}

/** 이 야수의 먼지 자국을 한 걸음 돌리고 그 걸음을 낸다 */
function stepFielderDustTrail(memory: ActionMemory, slot: number, action: number, position: WorldPoint): ReturnType<typeof stepDustTrail> {
  const trails = dustTrailsOf.get(memory) ?? []
  dustTrailsOf.set(memory, trails)
  const trail = stepDustTrail(trails[slot] ?? DUST_TRAIL_OFF, action, position)
  trails[slot] = trail.state
  return trail
}
