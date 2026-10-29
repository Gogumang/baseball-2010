import type { BattedContact } from '@/entities/batting/model/battedContact'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { type HitBallPath, hitBallPathOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { hitCameraAngleOf } from '@/widgets/batting-stage/lib/hitCamera'
import { hitParticleIdOf, hitParticleInputOf, isHomeRunHitResult, isStrongHit } from '@/widgets/batting-stage/lib/hitParticles'
import {
  type HitPauseInput,
  type LaunchedShot,
  hitBallTrajectoryOf,
  hitPauseTicksOf,
  isBigHit,
  launchedPauseInputOf,
} from '@/widgets/batting-stage/lib/hitPause'
import type { PitcherHitClock } from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'

/** 사람이 던진 공을 CPU 타자가 맞힌 장면 — 0x11 끝 · 0x13 그리기 재료 */
export interface PitcherHitScene extends PitcherHitClock {
  /** 감상 플래그 +0x199a (0x392ac) — 큰 타구 멈춤 · 016 · OK 건너뛰기 */
  readonly watchesBigHit: boolean
  /**
   * 판정 틀에 타격점에 쏘는 보통 불꽃 `.ptc` id (`hitParticles.hitParticleIdOf`) — 안 쏘면 null. 필살 스윙이 0x49aec 의 그림 갈래를 타면
   * 장면이 이 불꽃 대신 필살 파티클을 쏜다(`specialSwing`)
   */
  readonly particleId: number | null
  /**
   * 판정 0x6aa 가 [경기+0xfd4] 에 쓴 결과 코드 — 투수 그리기의 홈런 갈래(0x3908a, `pitcherFatigue.pitcherHomeRunMarksOf`)가 본다
   */
  readonly resultCode: number
  /**
   * CPU 필살 스윙(S+0x10 ≠ 0)으로 맞은 공이면 그 번호(레코드 +0x18) · 마타자인가(0xb633d) — 스윙 그리기 0x49e64 49f7c 가 맞은 틀 ·
   * 0x13 에 부르는 0x49aec 의 재료(`specialSwingEffect` · `hitParticles.specialSwingParticlesOf`). 공격 측을 안 가린다. 아니면 null
   */
  readonly specialSwing: { readonly number: number; readonly isAceBatter: boolean } | null
  /**
   * 번트로 맞은 공인가 — CPU 번트도 0x34334 가 예약 +0xfe0 · 종류 +0xfdc = rand(1, 4)(3445e)를 세워 4e0ce 의 0xb93a8 로 번트 자세
   * S+8 = 종류를 선다. 스윙 그리기 49faa 는 S+8 ≠ 0 이면 보통 불꽃 · ptc 를 건너뛴다(직접 뜸, r215). 없으면 거짓
   */
  readonly isBuntStance?: boolean
  /** 0x13 의 타구 공 경로 — 0x33e34 가 [경기+0xf2c] 공으로 다시 채운 +0x1140 (`hitBallPath`, 타자편 `BattingStage` 와 같다) */
  readonly hitPath?: HitBallPath | null
  /** 판정 각 s16 [+0xfcc] — 0x13 카메라 따라가기(0x3f060 3f23e, `hitCamera`) */
  readonly hitAngle?: number
  /** 0x13 꼬리선 0x3b188 — 0x35988(강한 타구, 번트 자세 아님) || 0x357e0(결과 24~26) */
  readonly showsHitTrail?: boolean
}

/**
 * **CPU 타자가 맞힌 공의 0x11 끝 · 0x13** (2026-10-24 직접 떴다, 0x4e060):
 * ```
 * 4e0ce  예약 +0xfe0 이 서 있고 공 틱 [+0x1098] ≥ +0xfd8(스윙 프레임 F) · S+4 면 스윙 객체 vtable +0x14(스윙) · +0x18(번트)
 * 4e15c  r7 = 번트 자세 S+8 ≠ 0 이고 공 틱 == N − 1
 * 4e192  0xb9271(S) == 0(상태 3 · 프레임 1) 이거나 r7 → 깊이 ≤ 0xbb8(또는 r7) 이면 4e206 메시지 0x6aa — 판정 0x51408 이 맞은 공이면 0x13 예약
 * ```
 * 스윙 객체는 틀 머리(0x3f060 3f320)에서 한 칸 넘어가므로 스윙이 나간 틀(공 틱 F) 다음 틀(F + 1)이 판정 틀이다 — 사람 타자의 키 틱 F 가
 * 다음 틀(F + 1)에 나가 F + 2 에 판정하는 것(`swingWindow.swingJudgeTickOf`)과 같은 셈이고, CPU 는 갱신 안에서 바로 나가 한 틀 이르다.
 * 번트는 자세가 선 뒤 공 틱 N − 1 에 판정한다. 키를 받아 판정하는 길(0x4e060)은 공격 측이 누구든 같다.
 * 0x13 길이 · 큰 타구 멈춤은 타자편과 같은 0x406e8 · 0x3f378 이다(`hitPause`). 판정 틀의 그리기 0x49e64 가 타격 불꽃을 쏘는 것도 같다
 * (`hitParticles` — 타자편 `BattingStage` 와 같은 근사로 판정 틀에 쏜다).
 * 필살 스윙(S+0x10)으로 맞은 공은 스윙 그리기 0x49e64 49f7c → 0x49aec 가 그림 갈래를 타면 [sp+0x60] = 1 로 보통 불꽃(49faa~4a0ce)을
 * 건너뛰고 같은 타격점에 필살 파티클(49dbc · 49de0)을 쏜다 — 0x49aec 는 타자를 0xae89d(공격 팀)로 읽어 공격 측을 안 가린다(r174 직접 떴다).
 * 그 갈래를 고르는 것은 장면이다(`specialSwing` — 그림이 없는 번호면 보통 불꽃).
 * 불꽃 · 필살 파티클 · 016 · 큰 타구 연출의 자리는 타격점 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라다(49b02 · 4a03a · 4cb80 — r184 직접
 * 떴다). +0x10dc 를 쓰는 곳은 놓기 0x4dc78 하나(4dffa~4e024: 표 0xcfb18[손] + 경로 끝 점 [+0x1134 + 12·N] 의 투영)라 공의 도착점이다 —
 * 웹은 `platePixelOf`(경로 끝 점의 `projectToScreen`). 타자편 `BattingStage` 와 같다.
 */
export function pitcherHitSceneOf(
  contact: BattedContact,
  cpuSwing: CpuSwingPose | null,
  frameCount: number,
  /** 친 타자의 손 — 이른 넘김 공의 수평각 d 를 고른다(0x51408). 판 입력의 `contact.batterHand` 가 없을 때 쓴다 */
  batterHand: number,
  /**
   * 판정 틀에 메시지 0x11 이 굴려 쏜 공(`preRollContactMessage`) — 0x13 의 경로 · 이른 넘김 · 각 · 카메라 · 불꽃은 이 표시 패턴(+0xfcc)과
   * 판 공을 본다(A-37). 아직 안 굴렸으면(판정 틀 앞) 쏜 패턴 그대로다
   */
  shot?: LaunchedShot | null,
): PitcherHitScene {
  const { resultCode } = contact
  const pattern = shot?.launchedPattern ?? contact.pattern
  const hitSide = contact.batterHand ?? batterHand
  const earlyPassTrajectory = hitBallTrajectoryOf(pattern, hitSide)
  // 각 0x406a4 는 +0xfcc · 낙구 · 폴 · 거리는 판 공 · 이른 넘김은 [경기+0xf2c] 공 (`hitPause.launchedPauseInputOf` — 타자편과 같다)
  const pauseInput: HitPauseInput = launchedPauseInputOf(resultCode, pattern, hitSide, shot?.trajectory)
  const watchesBigHit = isBigHit(pauseInput)
  const isBunt = isCpuBuntOf(cpuSwing)
  return {
    judgeBallTick: judgeBallTickOf(cpuSwing, isBunt, frameCount),
    ticks: hitPauseTicksOf(pauseInput),
    skipTick: null,
    watchesBigHit,
    particleId: hitParticleIdOf(hitParticleInputOf(pattern, resultCode, watchesBigHit)),
    resultCode,
    specialSwing: contact.specialSwing ?? null,
    isBuntStance: isBunt,
    // 0x13 진입 0x33e34 — 같은 [경기+0xf2c] 공의 점으로 타석 공 경로를 다시 채운다 (+0x17e1 = 친 타자의 손)
    hitPath: hitBallPathOf(earlyPassTrajectory, hitSide),
    hitAngle: hitCameraAngleOf(pattern[0]),
    showsHitTrail: isHomeRunHitResult(resultCode) || (!isBunt && isStrongHit(hitParticleInputOf(pattern, resultCode, watchesBigHit))),
  }
}

/** CPU 번트 — 0x34334 가 세운 번트 종류 +0xfdc ≠ 0 */
function isCpuBuntOf(cpuSwing: CpuSwingPose | null): boolean {
  return cpuSwing !== null && cpuSwing.buntKind !== 0
}

/** 판정 틀의 공 틱 — 스윙은 나간 다음 틀(F + 1), 번트 · 스윙 없음은 N − 1 (4e15c) */
function judgeBallTickOf(cpuSwing: CpuSwingPose | null, isBunt: boolean, frameCount: number): number {
  return cpuSwing === null || isBunt ? frameCount - 1 : cpuSwing.frame + 1
}
