import { battedBallTrajectory, landingPointOf } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'

/**
 * 홈런더비가 쓰는 타구 한 장.
 *
 * 원본은 타구 순간(0x51408) 덱에서 뽑은 패턴의 각·속도·높이로 공 객체에 궤적 점을 깔아 두고 그 **착지점**으로
 * 비거리를 잰다(0xa600c). 이식판 타석(`features/play-at-bat/resolvePitch`)이 그 한 장을 `detail.pattern` 으로
 * 실어 보내므로 여기서는 **그 패턴 그대로** 궤적을 만든다 — 다시 뽑지 않는다(난수도 쓰지 않는다).
 *
 * 궤적 자체는 `entities/batting/model/battedBallFlight` 를 그대로 불러다 쓴다 —
 * 원본 물리 루프(0xb3b38 · 0xb401c)는 이 저장소의 해독 금지 주제라 손대지 않는다.
 */

export interface DerbyBattedBall {
  readonly pattern: BattedBallPattern
  readonly trajectory: BattedBallTrajectory
  readonly landing: WorldPoint
  /** 홈런일 때만 0 보다 크다 (0xa600c) */
  readonly distance: number
}

/** 이번 타구(타석이 뽑은 패턴)로 궤적·비거리를 만든다 */
export function derbyBattedBallOf(pattern: BattedBallPattern, isHomeRun: boolean): DerbyBattedBall {
  const trajectory = battedBallTrajectory(pattern)
  const landing = landingPointOf(trajectory)
  return {
    pattern,
    trajectory,
    landing,
    // 비거리는 홈런일 때만 센다 (0xa600c: 결과 코드 +0x26 이 8 일 때만)
    distance: isHomeRun ? derbyDistanceOf(landing) : 0,
  }
}
