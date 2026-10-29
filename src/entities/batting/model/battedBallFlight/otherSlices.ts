/**
 * 타구 궤적이 쓰는 **다른 조각**(수비의 궤적 꼴 · 월드 좌표 · 루 자리)의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다
 * (`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나).
 */
export type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
export { BASE_POSITIONS, horizontalDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
