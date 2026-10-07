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
 * 궤적 자체는 `entities/batting/model/battedBallFlight`(원본 세계 0xbfed0)를 그대로 불러다 쓴다.
 */

/** 판 진행 관문 0xb0d28 이 닫힌 뒤 장면이 판을 마무리하기까지의 틱 — 슬롯 2 의 529f0 `+0x1094` 10틱 → 메시지 0xbb9 */
export const DERBY_PLAY_CLOSE_TICKS = 10

export interface DerbyBattedBall {
  readonly pattern: BattedBallPattern
  readonly trajectory: BattedBallTrajectory
  readonly landing: WorldPoint
  /** 홈런일 때만 0 보다 크다 (0xa600c) */
  readonly distance: number
  /**
   * 이 공의 판이 끝나는 틱 — 홈런더비 판(종류 8)은 판 시작 b2a10 이 +0x125 를 세워 관문 0xb0d28 이
   * **공.vt18(0xa27f0) 멈춤**에서만 닫는다(주자·포구를 안 본다). 재생 0x3f3c6 은 매 틱 공+0x68 을 올리므로 처음 멈춘 점의 틱에
   * 닫히고, 그 뒤 10틱(`DERBY_PLAY_CLOSE_TICKS`)에 장면이 0xbb9 로 넘긴다.
   */
  readonly endTicks: number
}

/** 공+0x68 이 처음으로 멈춘 점(vt18)에 닿는 틱. 끝까지 안 멈추면 마지막 점의 틱 */
export function derbyBallStopTickOf(trajectory: BattedBallTrajectory): number {
  for (let tick = 0; tick < trajectory.length; tick += 1) {
    if (trajectory.isStoppedAt?.(tick) === true) return tick
  }
  return trajectory.length - 1
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
    endTicks: derbyBallStopTickOf(trajectory) + DERBY_PLAY_CLOSE_TICKS,
  }
}
