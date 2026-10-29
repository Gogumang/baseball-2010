/**
 * 포구 예측기 0xb12d0 (플레이 vt 0x24) 와 추적야수 고르기 0xb3b38 (vt 0x34).
 *
 * 원본은 타구 순간 **궤적 전체를 미리 계산해 두고**(공 +0x74 부터 최대 130 점) 야수 9명을 복제해
 * 틱마다 "종류별 가장 이른 포구 틱" 표를 만든다. 그래서 수비는 "가장 가까운 야수"가 아니라
 * **가장 먼저 잡을 수 있는 야수**를 고른다 (P2 2a·1a, 확정).
 *
 * 궤적 자체(타구 물리 — 세계 0xbfed0 · 공 vtable 0xd7afc)는 `entities/batting/model/ballPhysics` 가 원본대로 깐다.
 * 이 파일은 `BattedBallTrajectory` 인터페이스만 둔다. **투구 궤적은 pitch.zt1 원본 데이터를 그대로 쓴다**(D 결정).
 *
 * 공개 이름 모음 — 하위 폴더 (`catchPrediction/`): `trajectory`(타구 궤적 꼴) · `catchWindow`(포구 종류 · 반경 · 높이 창 0xb12d0) ·
 * `chaser`(추적야수 0xb3b38 · 동작 시작 틱 0xd87c0) · `backup`(외야 백업 0xb4b78 · B-59)
 */
export type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction/trajectory'
export {
  approachedDistanceOf,
  CATCH_KIND,
  catchKindsAt,
  catchRadiusOf,
  DIVE_DISTANCE,
  HEIGHT_WINDOW,
  isDiveCandidate,
  type CatchKind,
  type CatchWindowInput,
} from '@/entities/fielding/model/catchPrediction/catchWindow'
export {
  actionStartTickOf,
  chooseChaser,
  EMPTY_CATCH_TABLE,
  type CatchOpportunity,
  type CatchTable,
  type ChaseChoice,
} from '@/entities/fielding/model/catchPrediction/chaser'
export { backupPointOf } from '@/entities/fielding/model/catchPrediction/backup'
