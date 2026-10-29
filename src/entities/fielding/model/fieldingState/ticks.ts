import { basePosition, manhattanDistance, ticksToReach, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState, RunnerState } from '@/entities/fielding/model/fieldingState/types'

/** 목표점까지 남은 틱 — 0xbefec = self.vt1c(self+0x2c) */
export function remainingTicksOf(mover: { position: WorldPoint; target: WorldPoint; speed: number }): number {
  return ticksToReach(mover.position, mover.target, mover.speed)
}

/**
 * 주자의 0xbf01c = 거리(+0x14, +0x2c) ÷ 속도. 주자 +0x14 는 구간 출발점이 아니다 — 주자 틱 0xa01cc 가 부르는 공용 틱 0xbf094 가
 * 목표에 안 닿았으면 이동 vt30(0xbf0dc → 한 걸음 0xbf158) 바로 뒤에 vt28 = 0xbf240 을 부르고, 0xbf240 은 높이 +0x24 ≤ 0 이면
 * `+0x14..+0x1f ← +0x20..+0x2b`(위치)로 베낀다(bf24c~bf25e, r276 직접 뜸). 주자는 땅에서만 달려(한 걸음의 높이 = +0x18 + 0 · t − 0)
 * 움직인 틱마다 +0x14 = 위치다 — 곧 이 값은 남은 틱(0xbefec)과 같다. (`legStart` 는 진행률 · 주자 판 진행기들이 따로 쓰는 웹 칸이다)
 */
export function legTotalTicksOf(runner: RunnerState): number {
  return ticksToReach(runner.position, basePosition(runner.targetBase), runner.speed)
}

/** 주자가 목표 루까지 남은 틱 — 0xbefec(주자) */
export function runnerRemainingTicks(runner: RunnerState): number {
  return ticksToReach(runner.position, basePosition(runner.targetBase), runner.speed)
}

/**
 * 주자 vt0xa0 = 0xa06ec = **한 루 더 갈 때의 총 틱**
 * = 거리(루[(목표루+1)%4], 루[목표루]) ÷ 속도 + 지금 목표까지 남은 틱 (S7 5절, 확정).
 * 거리는 **맨해튼 0xbfa2c**(a0740)다.
 */
export function runnerOneMoreBaseTicks(runner: RunnerState): number {
  const next = basePosition(runner.targetBase + 1)
  const current = basePosition(runner.targetBase)
  const legs = runner.speed === 0 ? 0 : Math.trunc(manhattanDistance(next, current) / runner.speed)
  return legs + runnerRemainingTicks(runner)
}

/** 주자가 목표점에 도착해 멈췄는가 — vt18 = 0xbf3a0 = (위치 == 목표점) (S8 정정 5) */
export function isRunnerStopped(runner: RunnerState): boolean {
  const target = basePosition(runner.targetBase)
  return runner.position.x === target.x && runner.position.z === target.z
}

/** 야수 vtc0 = 0xa1c3c = 목표점까지 남은 틱 + +0xcc */
export function fielderArrivalTicks(fielder: FielderState): number {
  return remainingTicksOf(fielder) + fielder.arrivalSlackTicks
}
