/**
 * 원본 패턴 한 장 → 원본 공 궤적.
 *
 * 타구 순간(장면 메시지 0x11 → 0x50faa):
 * ```
 * 51058 공 = [장면+0x204] ; 0xbef58(공, 0xcfb70 = (20000, 1000, 30000))     위치 · 기준점 · 목표
 * 51090 패턴 덱 0xb0b01 → −a(각) · 0xb0ab9 → b(속도) · 0xb0a51 → ±c(높이, 0xb07b4 가 부호)
 * 51188 공.vt44 = 0xa2870(b, ±c, −a)                                       쏘기
 * 511a4 세계 [장면+0x1e4].vtC(공+0x58) = 0xbfed0                           점 미리 깔기 (`ballPhysics`)
 * 511ea state[0x20] = 공+0xaa4 · state[0x80] = 공+0xab0
 * ```
 * 물리 · 충돌 · 사건 틱은 전부 `ballPhysics` 에 직접 뜬 대로 옮겼다. 좌표계는 `entities/fielding` 의
 * 월드 40000×32500 그대로다 (x 클수록 1루 쪽, z 작을수록 외야, y 가 높이).
 *
 * 공개 이름 모음 — 하위 폴더 (`battedBallFlight/`): `launch`(쏘기 · 송구 공 0xa1620 · 궤적 꼴) · `pattern`(패턴 → 궤적 0x51090 · 폴 굴림 다시 깔기) ·
 * `splice`(다시 쏜 공 잇기 0xb3148 · 공 멈춤 끼우기 · 낙구 지점) · `otherSlices`(다른 조각)
 */
export {
  BATTING_POINT,
  launchTrajectory,
  MAXIMUM_TRAJECTORY_POINTS,
  thrownBallTrajectory,
  type BallTrajectory,
} from '@/entities/batting/model/battedBallFlight/launch'
export { battedBallTrajectory, isBallTrajectory, trajectoryWithRandom } from '@/entities/batting/model/battedBallFlight/pattern'
export { carryDistanceOf, clearedFence, holdTrajectoryAt, landingPointOf, spliceTrajectory } from '@/entities/batting/model/battedBallFlight/splice'
