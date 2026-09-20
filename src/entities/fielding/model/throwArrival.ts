import {
  basePosition,
  BASE_DEFAULT_FIELDER,
  horizontalDistance,
  isOutfieldSlot,
  ticksToReach,
} from '@/entities/fielding/model/fieldGeometry'
import {
  fielderArrivalTicks,
  NONE,
  type DefenseContext,
  type FielderState,
} from '@/entities/fielding/model/fieldingState'
import {
  RELAY_DISTANCE,
  readyTicksOf,
  relayTicksToBase,
  throwTicksTo,
  throwTicksToFielder,
} from '@/entities/fielding/model/throwPlan'

/**
 * 0xaf284(제어기, 루 b) = **수비가 공을 루 b 에 보내는 데 드는 틱**.
 * 자동 주루(0xaf918)와 CPU 송구 목표 점수식(0xafb24)이 둘 다 이 값을 기준으로 판단한다.
 *
 * 두 갈래로 갈리는 기준은 **커버 야수 유무**다 (S7 5절, 확정 — P2 가 "세부 분기 유력" 으로 남겼던 곳).
 */
export function defenseArrivalTicks(context: DefenseContext, base: number): number {
  const { play, fielders } = context
  const holder = fielders[play.ballHolderSlot]
  const catcher = fielders[play.catchFielderSlot] ?? holder
  const basePoint = basePosition(base)
  const coverSlot = play.coverOfBase[((base % 4) + 4) % 4] ?? NONE
  const cover = coverSlot === NONE ? undefined : fielders[coverSlot]

  // ── (A) 커버가 없다: 직접 뛰는 것과 루 담당 기본 야수가 닿는 것 중 빠른 쪽 ──
  if (cover === undefined) {
    const carryTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const defaultFielder = fielders[BASE_DEFAULT_FIELDER[((base % 4) + 4) % 4]]
    let defaultTicks = fielderArrivalTicks(defaultFielder)
    if (defaultFielder.targetBase !== base) {
      defaultTicks += ticksToReach(defaultFielder.position, basePoint, defaultFielder.speed)
    }
    return Math.min(carryTicks, defaultTicks)
  }

  // ── (B) 커버가 있다 ──
  const relayed =
    holder.slot === catcher.slot &&
    isOutfieldSlot(holder.slot) &&
    horizontalDistance(holder.position, basePoint) >= RELAY_DISTANCE

  // 원본은 중계가 아니면 두 갈래가 완전히 같은 코드다(0xaf532 / 0xaf53e) — "언제나 잡을야수.vtb4(커버야수)"
  let ticks = relayed
    ? relayTicksToBase(fielders, holder, cover, base)
    : throwTicksToFielder(catcher, cover)

  let remaining = 0
  if (!catcher.holdingBall) {
    // 아직 공을 안 잡았다 → 잡기까지 남은 틱 + 잡고 던지기까지의 준비 틱(내야 3 / 외야 6)
    remaining = play.catchTick - context.currentTick
    ticks += readyTicksOf(catcher.slot)
  } else {
    ticks += catcher.actionRemainingTicks
  }

  // 커버 야수가 루에 못 가 있으면 그만큼 늦어진다
  ticks = Math.max(ticks, ticksToReach(cover.position, basePoint, cover.speed) - remaining)
  return remaining + ticks
}

/**
 * AI 상태 9 = **송구 타이밍 게이트** (0xb4838, S8 2절).
 * 받을 야수가 루에 닿는 시각 `t1` 이 송구 도착 시각 `t2` 보다 늦으면 이번 틱에는 던지지 않는다.
 *
 * `t1 = 받을야수.vtc0()` (목표점까지 남은 틱 + +0xcc) · `t2 = 공가진야수.vtb8(루 좌표)`
 */
export function shouldReleaseThrow(receiver: FielderState, holder: FielderState, base: number): boolean {
  const t1 = fielderArrivalTicks(receiver)
  const t2 = throwTicksTo(holder, basePosition(base))
  return t1 <= t2
}

/**
 * 사람이 방향키를 안 눌렀을 때의 자동 송구 목표 0xb1c90 (I-controls 2b).
 * **앞선 주자부터(인덱스 큰 쪽) 거꾸로** 보며 `주자 도착 틱 ≥ 송구 시간` 인 첫 루를 고른다.
 * CPU 수비는 이 함수 대신 점수식 0xafb24 를 쓴다 (플레이+0x160 이 늘 −1 이라 사람 쪽 전용).
 */
export function autoThrowTargetBase(context: DefenseContext): number {
  const { play, fielders, runners } = context
  if (play.manualThrowBase !== NONE) return play.manualThrowBase
  const holder = fielders[play.ballHolderSlot]
  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner.isOut) continue
    const base = runner.targetBase
    const coverSlot = play.coverOfBase[((base % 4) + 4) % 4] ?? NONE
    if (coverSlot === NONE) continue
    const runnerTicks = ticksToReach(runner.position, basePosition(base), runner.speed)
    const throwTicks = fielderArrivalTicks(holder) + throwTicksTo(fielders[coverSlot], basePosition(base))
    if (runnerTicks >= throwTicks) return base
  }
  return NONE
}

/**
 * 2루 커버 규칙 (0xb1e24): 공이 1루 쪽으로 간 타구면 유격수(5), 아니면 2루수(3).
 * 잡은 야수가 그 둘 중 하나면 다른 쪽이 커버한다.
 */
export function secondBaseCoverSlot(ballHeadingToFirstSide: boolean, catchFielderSlot: number): number {
  const preferred = ballHeadingToFirstSide ? 5 : 3
  if (catchFielderSlot !== preferred) return preferred
  return preferred === 5 ? 3 : 5
}
