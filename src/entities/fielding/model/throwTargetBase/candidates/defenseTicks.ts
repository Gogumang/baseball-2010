import { BASE_POSITIONS, horizontalDistance } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { defenseArrivalTicks } from '@/entities/fielding/model/throwArrival'
import { integerSquareRoot } from '@/shared/lib/math/originalTrigonometry'
import type { BaseCandidate, ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

/** 가장 빠른 수비 루 찾기 시작값 = 1000 (afc7e: `movs r6,#0xfa ; lsls r6,#2 ; str r6,[sp,#0x50]`) */
const MINIMUM_DEF_TICK_START = 1000
/** 태그 거리와 같은 값 — 1루선에서 이만큼 안쪽이어야 "직접 밟을 수 있다" 로 친다 (0xafd5a) */
const FIRST_BASE_LINE_DISTANCE = 499
const FIRST_BASE = 1

/** 공 가진 야수와 홈–1루 선 사이 거리 (afd5a 의 기울기 · isqrt 식) */
function firstBaseLineDistanceOf(input: ThrowTargetInput): number {
  const holder = input.fielders[input.play.ballHolderSlot]
  const home = BASE_POSITIONS[0]
  const first = BASE_POSITIONS[1]
  const slope = Math.trunc((100 * (home.z - first.z)) / (home.x - first.x))
  const numerator = Math.abs(slope * (holder.position.x - home.x) - 100 * (holder.position.z - home.z))
  const denominator = integerSquareRoot(slope * slope + 100 * 100)
  return Math.trunc(Math.trunc(numerator / denominator) / 10)
}

/**
 * 1루에 커버가 없을 때의 예외 (S7 2-6).
 * 공 가진 야수가 1루선에서 499 이내에 있고 1루까지 타자주자보다 가까우면
 * **수비 틱 = 주자 틱** 으로 적어 "보낼 수 있는 루" 로 친다(= 직접 밟는다).
 * 견주는 값은 틱이 아니라 **평면 거리**다 — afda4 · afdc0 이 둘 다 0xbed30(= 0xbf9f0) 으로 1루 좌표까지 재고 afdc4 에서 비교한다.
 * 속도를 안 보니 빠른 타자주자라도 1루에서 더 멀면 예외가 걸린다(원본 그대로).
 */
function applyFirstBaseException(input: ThrowTargetInput, candidate: BaseCandidate): void {
  if (firstBaseLineDistanceOf(input) > FIRST_BASE_LINE_DISTANCE) return
  const batterRunner = input.runners[0]
  if (batterRunner === undefined) return
  const holder = input.fielders[input.play.ballHolderSlot]
  const first = BASE_POSITIONS[1]
  if (horizontalDistance(batterRunner.position, first) > horizontalDistance(holder.position, first)) {
    candidate.defTick = candidate.runTick
  }
}

/** 루마다 수비 틱을 적고(1루 예외 포함) 가장 빠른 수비 루를 돌려준다 (S7 2-4) */
export function fillDefenseTicks(input: ThrowTargetInput, table: readonly BaseCandidate[]): number {
  let minimumDefTick = MINIMUM_DEF_TICK_START
  let minimumBase = 0
  table.forEach((candidate, base) => {
    candidate.defTick = defenseArrivalTicks(input, base)
    if (base === FIRST_BASE && (input.play.coverOfBase[base] ?? NONE) === NONE) applyFirstBaseException(input, candidate)
    if (candidate.defTick < minimumDefTick) {
      minimumDefTick = candidate.defTick
      minimumBase = base
    }
  })
  return minimumBase
}
