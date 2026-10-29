import { runnerCountOf } from '@/entities/game/model/baseState'
import { rosterSlotAt, tryQuickCpuPinchHit } from '@/entities/game/model/quickLineup'
import { changePitcherIfNeeded } from '@/entities/game/model/simulateHalfInning/defense/pitcherChange'
import type { HalfInningInput, HalfInningRun } from '@/entities/game/model/simulateHalfInning/engine/inningRun'
import type { HalfInningTick } from '@/entities/game/model/simulateHalfInning/types/tick'

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_SUBSTITUTION_CALLS = 3

/**
 * 타석을 열기 앞의 `0xc1ba4` 부름들 — 안 차례 그대로 **CPU 대타(공격 팀)가 먼저**다 (0xc1c50, 투수 교체 0xc1ce2 보다 앞).
 * 둘 중 하나라도 바뀌면 0xc1ba4 가 1 을 돌려 0xc262c 가 공 없이 돌아가고(c266c), 다음 부름에서 **같은 타석**으로
 * 0xc1ba4 를 다시 지난다 — 바뀐 쪽은 state[0xe]·state[0xd] 로 곧장 빠지고 안 바뀐 쪽은 다시 판정(굴림 포함)한다.
 * 공 없이 돌아간 부름마다 한 틱을 내고, 그 횟수를 돌려준다.
 */
export function* substitutionTicks(run: HalfInningRun, input: HalfInningInput): Generator<HalfInningTick, number, void> {
  let substitutionCalls = 0
  for (let call = 0; call < MAXIMUM_SUBSTITUTION_CALLS; call += 1) {
    const pinchHit = rollCpuPinchHit(run, input)
    const pitcherChanged = rollPitcherChange(run, input)
    if (!pinchHit && !pitcherChanged) break
    substitutionCalls += 1
    // 0xc262c c266c — 이 부름은 공 없이 돌아간다 (한 틱)
    yield {
      kind: 'substitution',
      battingOrderIndex: run.order,
      ...(run.lineup === undefined ? {} : { lineup: run.lineup }),
      ...(run.mound === undefined ? {} : { pitcherSlot: run.mound.pitcherSlot }),
      outs: run.outs,
    }
  }
  return substitutionCalls
}

/** CPU 대타 0xac228 — 바꿨으면 명단 · 막음 칸 · 대타 목록을 고치고 참 */
function rollCpuPinchHit(run: HalfInningRun, input: HalfInningInput): boolean {
  const { lineup, pinchHitUsed, order } = run
  if (lineup === undefined || pinchHitUsed === undefined) return false
  const pinch = tryQuickCpuPinchHit(
    lineup,
    order,
    {
      alreadyUsedThisGame: pinchHitUsed,
      runnerCount: runnerCountOf(run.bases),
      batterIsAce: input.offense?.isAceRosterSlot?.(rosterSlotAt(lineup, order)) ?? false,
    },
    input.random,
  )
  if (pinch === null) return false
  run.lineup = pinch.lineup
  // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
  run.pinchHitUsed = true
  run.pinchHits.push({
    battingOrderIndex: order,
    outgoingRosterSlot: pinch.outgoingRosterSlot,
    incomingRosterSlot: pinch.incomingRosterSlot,
  })
  return true
}

/** 간이 타석 루프 0xc262c 는 **타석마다 먼저** 0xc1ba4 를 불러 수비 팀 투수 교체를 판정한다 — 바꿨으면 참 */
function rollPitcherChange(run: HalfInningRun, input: HalfInningInput): boolean {
  const { defense } = input
  const { mound } = run
  if (defense === undefined || mound === undefined || defense.pitcherChangeBlocked === true) return false
  const changed = changePitcherIfNeeded(defense, mound, {
    inningIndex: input.inning - 1,
    lead: defense.lead - run.runs,
    runnerCount: runnerCountOf(run.bases),
    inningRunsAllowed: run.inningRunsAllowed,
    random: input.random,
  })
  if (changed === mound) return false
  run.pitcherChanges.push({
    pitcherSlot: changed.pitcherSlot,
    outs: run.outs,
    runnerCount: runnerCountOf(run.bases),
    runsBefore: run.runs,
    outgoingPitcherSlot: mound.pitcherSlot,
    outgoingStamina: mound.stamina,
  })
  run.mound = changed
  // 교체 0xaec64 가 +0x27c·+0x280·+0x284 를 한꺼번에 0 으로 민다
  run.inningRunsAllowed = 0
  return true
}
