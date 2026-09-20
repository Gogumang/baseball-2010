import { battedBallTrajectory, landingPointOf } from '@/entities/batting/model/battedBallFlight'
import { outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'

/**
 * 홈런더비가 쓰는 타구 한 장.
 *
 * 원본은 타구 순간 공 객체에 궤적 점을 깔아 두고 그 **착지점**으로 비거리를 잰다(0xa600c).
 * 이식판 타석(`features/play-at-bat/resolvePitch`)은 결과 코드까지만 돌려주고 자기가 뽑은
 * 패턴은 밖으로 내보내지 않아서, 여기서 **같은 결과 코드의 원본 패턴을 한 장 골라** 궤적을 만든다.
 * → **고르는 규칙은 근사다.** 값은 원본 `pattern.dat` 에서만 고르고 새로 짓지 않는다
 *   (`features/defense-play/model/representativePattern` 이 쓰는 것과 같은 태도다).
 *
 * 궤적 자체는 `entities/batting/model/battedBallFlight` 를 그대로 불러다 쓴다 —
 * 원본 물리 루프(0xb3b38 · 0xb401c)는 이 저장소의 해독 금지 주제라 손대지 않는다.
 */

/** 패턴을 고를 때만 쓰는 고정 난수 — `outcomeOfPattern` 안의 확률 굴림을 늘 같게 만든다 */
const FIXED_RANDOM: RandomPort = {
  next: () => 0.5,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
}

export interface DerbyBattedBall {
  readonly pattern: BattedBallPattern
  readonly trajectory: BattedBallTrajectory
  readonly landing: WorldPoint
  /** 궤적의 최고 높이 — 이벤트 존 판정에 쓴다 */
  readonly apexHeight: number
  /** 홈런일 때만 0 보다 크다 (0xa600c) */
  readonly distance: number
}

function apexHeightOf(trajectory: BattedBallTrajectory): number {
  let apex = 0
  for (let tick = 0; tick < trajectory.length; tick += 1) {
    const point = trajectory.pointAt(tick)
    if (point.y > apex) apex = point.y
  }
  return apex
}

function isHomeRunPattern(code: number, pattern: BattedBallPattern): boolean {
  const result = outcomeOfPattern(code, pattern, FIXED_RANDOM)
  return result.kind === '타구' && result.outcome.kind === '홈런'
}

/**
 * 결과 코드로 이번 타구를 만든다.
 *
 * `isHomeRun` 이 참이면 그 코드에서 **홈런으로 판정되는** 패턴 중 하나를, 아니면 홈런이 아닌
 * 패턴 중 하나를 난수로 고른다. 걸러 낸 것이 없으면 그 코드의 아무 패턴이나 쓴다.
 */
export function derbyBattedBallOf(
  resultCode: number,
  isHomeRun: boolean,
  random: RandomPort,
): DerbyBattedBall | null {
  const patterns = BATTED_BALL_PATTERNS[resultCode]
  if (patterns === undefined || patterns.length === 0) return null

  const matching = patterns.filter((pattern) => isHomeRunPattern(resultCode, pattern) === isHomeRun)
  const candidates = matching.length > 0 ? matching : patterns
  const pattern = candidates[randomIntegerBelow(random, 0, candidates.length)] ?? candidates[0]

  const trajectory = battedBallTrajectory(pattern)
  const landing = landingPointOf(trajectory)
  return {
    pattern,
    trajectory,
    landing,
    apexHeight: apexHeightOf(trajectory),
    // 비거리는 홈런일 때만 센다 (0xa600c: 결과 코드 +0x26 이 8 일 때만)
    distance: isHomeRun ? derbyDistanceOf(landing) : 0,
  }
}
