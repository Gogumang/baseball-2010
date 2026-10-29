import type { BattedBallTrajectory, CatchOpportunity, CatchTable } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, horizontalDistance, isOutfieldSlot, manhattanDistance } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { NO_LOW_TICK } from '@/features/defense-play/model/catchForecast/forecastTypes'

/**
 * 0xb3b38 의 담장 갈래(직접 뜬 것):
 * ```
 * b3e5c  r3 = min(sp38 땅볼, sp3c 가슴, sp40 낮은 공)      ; 없으면 100000(b3b60)
 * b3e6e  W = 공+0xaa4(sp44) ; W == −1 → b3ebe(백업) ; W ≥ r3 → b3ebe
 * b3e7a  0xa25b0(공, W − 2) → (x, y, z) ; b3e8c 고른 야수 AI = 0xb(0xb8dbc) ; b3e96~b3eba 목표 +0x90 = (x, 0, z)
 * ```
 * AI 0xb(분기표 0xd8808 → 0xb4b5c)는 목표 +0x90 으로 걷는다 — 공이 아니라 담장 앞으로 간다.
 */
export function fenceChasePointOf(trajectory: BattedBallTrajectory, table: CatchTable): WorldPoint | null {
  const fenceTick = trajectory.fenceTick
  if (fenceTick === -1) return null
  if (fenceTick >= earliestGroundTickOf(table)) return null
  const point = trajectory.pointAt(fenceTick - 2)
  return { x: point.x, y: 0, z: point.z }
}

/** b3e5c — min(땅볼, 가슴, 낮은 공 틱). 없으면 100000(b3b60) — 점프 · 슬라이딩 틱은 안 든다 */
function earliestGroundTickOf(table: CatchTable): number {
  const tickOf = (entry: CatchOpportunity | null) => entry?.tick ?? NO_LOW_TICK
  return Math.min(tickOf(table.grounder), tickOf(table.chest), tickOf(table.low))
}

/** b3ece — 백업 거리의 처음 최소 0x61a80 */
const BACKUP_DISTANCE_START = 400_000

/** b3ebe~b3f62 — 백업 야수 (`CatchForecast.backupSlot`). 거리는 **맨해튼 0xbfa2c**(b3f2a)다 */
export function backupSlotOf(fielders: readonly FielderState[], chaserSlot: number, lowPoint: WorldPoint): number {
  if (!isOutfieldSlot(chaserSlot)) return -1
  let best = -1
  let bestDistance = BACKUP_DISTANCE_START
  // b3ed2 칸 5 부터 8 까지 — 0xb8da8 이 외야(6~8)만 남긴다
  for (let slot = 5; slot <= 8; slot += 1) {
    const fielder = fielders[slot]
    if (fielder === undefined || !isOutfieldSlot(fielder.slot) || fielder.slot === chaserSlot) continue
    const distance = manhattanDistance(fielder.position, lowPoint)
    if (distance < bestDistance) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}

/**
 * 낮은 공 지점에 가장 가까운 야수 (0xb3b38 이 우선순위 1·8 에서 쓰는 야수) — 0xb3c00~0xb3c6c:
 * 거리 0xbf9f0(isqrt(dx² + dz²)) < 지금 최소(처음 0x40000000) && 진짜 야수의 +0xb4 ≤ 0 && +0xbc == 0 인 야수, 없으면 0.
 * (+0xbc 는 vta0 0xa1e94 가 세우고 다음 야수 틱에 지우는 칸이라 이 웹 모델엔 없다)
 */
export function nearestSlotTo(fielders: readonly FielderState[], point: WorldPoint): number {
  let best = 0
  let bestDistance = 0x40000000
  for (const fielder of fielders) {
    const distance = horizontalDistance(fielder.position, point)
    if (distance < bestDistance && fielder.actionLockTicks <= 0) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}
