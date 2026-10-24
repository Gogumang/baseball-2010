import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { SCENE_STATE } from '@/shared/lib/commonWindow/sceneStateEntries'
import type { SceneStateEntry } from '@/shared/lib/commonWindow/sceneStateEntries'
import type { BattedContact } from '@/entities/batting/model/battedContact'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { earlyPassPatternOf } from '@/entities/batting/model/earlyPassBall'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { earlyHitPauseTickOf, hitPauseTicksOf, isBigHit } from '@/widgets/batting-stage/lib/hitPause'
import type { HitPauseInput } from '@/widgets/batting-stage/lib/hitPause'
import { HIT_PARTICLE_IMAGE, hitParticleIdOf, hitParticleInputOf, specialSwingParticlesOf } from '@/widgets/batting-stage/lib/hitParticles'
import { specialSwingStageEffectOf } from '@/widgets/batting-stage/lib/specialSwingEffect'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'

/**
 * **사람이 던지는 타석의 장면** — 투수편(모드 3) · 투수 미션(모드 5) · 팀 경기 수비 반 이닝.
 *
 * 원본은 누가 던지든 같은 경기 장면 프레임 0x52c50 이 같은 그리기 표 0xd05a0 을 부른다(R10 2절 — 표에 모드 갈래가 없다).
 * 상태 그리기 머리가 모두 같은 장면 부품을 같은 차례로 부른다 (2026-10-09 직접 뜸):
 * ```
 * 0xd  0x4db2c   0x38d1c(투수) · 0x49e64(타자) · 0x35b94(주자) · 0x42f2c · 0x4c4bc(HUD)
 * 0xe  0x4d9ec   0x38d1c · 0x49e64 · 0x35b94 · 0x42f2c · 0x4c4bc · 0x44944(소개 판)
 * 0xf  0x4d9b0   0x38d1c · 0x35b94 · 0x49e64 · 0x42f2c · 0x4c4bc            ; 구질 목록은 그 위
 * 0x10 0x4d780   0x38d1c · 0x35b94 · 0x49e64 · 0x33fe4 …                      ; 조준 그림은 그 위
 * 0x11 0x4d2ac   0x38d1c · 0x42f2c · 0x35b94 · 0x49e64 …                      ; 게이지 0x4d3f8 은 그 위
 * 0x12 0x4ce9c   0x38d1c · 0x35b94 · 0x49e64 · 0x3b2f4(공)
 * ```
 * 그 앞에 상태가 7·8·9 가 아니면 공용 0x41230(배경)을 그린다. 곧 투수편 화면도 타자편 타석과 **같은 캔버스 장면**이고,
 * 구질 고르기 · 조준 · 게이지는 그 장면 위에 얹힌 UI 다. 마운드 투수는 장면 셋업 0x108f8 이 모드 ≠ 4 면 세우는
 * 투수 그림 객체(0x79368)라 장비 겹(0x79790)을 입는다 (`batterLayers.pitcherEquipmentOf`).
 *
 * 이 파일은 웹 투수 화면의 "던진 공 하나"를 장면 단계로 바꾼다. 웹 진행기는 공을 놓는 그 순간(0x11 틱 10, 0x4e060) 판정까지
 * 한 번에 내므로, 장면은 그 시각에서 거꾸로 0x11 진입을 잡아 투수 동작 · 공 비행 · 0x12 를 그림으로만 다시 돈다(굴림 없음).
 */

/** 0x4e060 `[+0x2c] > 9` — 사람 공은 0x11 의 틱 10 에 놓는다 (`PitchGradeGauge`) */
export const HUMAN_PITCH_RELEASE_STATE_TICK = 10

export interface PitcherSideStageClock {
  /** 지금 장면 틱 */
  readonly nowTick: number
  /** 마지막 공을 놓은 장면 틱 (0x11 틱 10). 이 화면에서 던진 공이 없으면 null */
  readonly releaseTick: number | null
  /** 그 공의 경로 점 수 N */
  readonly frameCount: number
  /**
   * 0x12 대기 문턱 (0x4e6d4 — 15, 타석이 끝났으면 31). 0 이면 0x12 를 안 지난다(맞은 공).
   * 0x12 는 상태 틱 0 ~ 문턱의 **문턱 + 1 그림**이다(4e72c `틱 < 문턱` 이면 기다리고, 문턱 틱의 갱신이 다음 상태를 예약한다 — 타자편
   * `resultPhaseTicksOf` 와 같은 셈)
   */
  readonly resultTicks: number
  /** 0xd · 0xe 확인 대기 따위 — 쉬는 '대기' */
  readonly isPaused: boolean
  /** 쉬기 시작한 장면 틱 (쉬지 않으면 무시) */
  readonly pausedSinceTick: number
  /** 마운드 마투수 순번 (0~4) — 공 틱이 오르는 단계가 0xcfbe4[순번]이다(0x3f378). 없으면 평범한 투수(단계 6) */
  readonly aceOrder?: number | null
  /**
   * 그 공이 맞은 공(0x13 → 0x17)이면 판정 공 틱 · 0x13 길이 (`pitcherHitSceneOf`). 없으면 맞은 공도 예전처럼 공 틱 N + 1 에서 대기다
   */
  readonly hit?: PitcherHitClock | null
}

/** 맞은 공의 0x11 끝 · 0x13 — `PitcherSideStageClock.hit` */
export interface PitcherHitClock {
  /** 판정(0x6aa) 공 틱 J — 이 틀의 갱신이 0x13 을 예약한다(`PitcherHitScene.judgeBallTick`) */
  readonly judgeBallTick: number
  /** 0x13 이 0x17 을 예약하는 상태 틱 (`hitPause.hitPauseTicksOf`) */
  readonly ticks: number
  /** OK · '5' 건너뛰기(0x406e8 40708)를 읽은 0x13 상태 틱 — 없으면 null (큰 타구만) */
  readonly skipTick?: number | null
}

export interface PitcherSideStageFrame {
  readonly phase: StagePhaseSnapshot
  /** 공 경로 번호 F (0 = 릴리스). 공이 날지 않으면 −1 */
  readonly ballFrame: number
  /**
   * 0x11 진입(투수 그림 객체 상태 1) 뒤 틱 — 투수 단계 표가 본다. 0x12 에도 이어져 마지막 자세에 머문다.
   * '대기'(다음 0xf 진입이 상태 0 으로 되돌린 뒤)면 null
   */
  readonly pitcherTick: number | null
  /**
   * 0x11 의 마지막 갱신 틱(`pitcherTick` 셈) — 공 틱 N + 1 의 0x4e060 이 0x12 를 예약한 그림. 그 뒤로는 투수 갱신 0x9e004 가
   * 안 불려 단계가 굳는다(0x9e004 는 0xf · 0x11 갱신에서만). 0x11 이거나 '대기' 면 null
   */
  readonly pitcherTickEnd: number | null
}

/**
 * 지금 그림의 장면 단계.
 * - 0x11: 공을 놓은 틱 − 10 에서 들어선다. 투수 단계가 릴리스(`pitcherReleaseTicksOf`)에 닿은 틱부터 공 틱이 오르고(0x3f378),
 *   공 틱 N + 1 의 갱신이 0x12 를 예약한다(0x4e24e → 4e26c 0xbcb49). 예약한 틀은 아직 0x11 이고 다음 틀(공 틱 N + 2)이 0x12 틱 0 이다
 *   (0xbc9c8 — 예약은 다음 틀 머리에서 선다).
 * - 0x12: 상태 틱 0 ~ `resultTicks`(문턱)의 문턱 + 1 그림 — 공은 마지막 점(`heldBall`).
 * - 그 밖은 '대기'(0xd~0xf · 0x10 조준 — 장면은 대기 동작이다).
 * 게이지(`PitchGradeGauge`)도 경기 장면 틱 머리마다 센다(`setGameSceneTickInterval`) — 놓은 틱은 게이지가 놓은 그 장면 틱이다.
 * 게이지는 0x10 이 0x11 을 예약한 틀에 선 것으로 보고 다음 틀 머리를 0x11 틱 0 으로 센다(0xbc9c8 bc9ec — 예약 다음 틀이 틱 0).
 * 그 "예약한 틀" 은 조준 OK 키를 읽는 틀이다 — 조준(`AimCursor`)은 키를 받은 다음 틀 머리에서 꺼내므로(`sceneKeyLatch`, 0x498d4)
 * 게이지가 그 틀에 서고 다음 틀 머리가 0x11 틱 0 이다.
 */
export function pitcherSideStageFrameOf(clock: PitcherSideStageClock): PitcherSideStageFrame {
  const idle: PitcherSideStageFrame = {
    phase: {
      kind: '대기',
      tick: clock.isPaused ? Math.max(0, clock.nowTick - clock.pausedSinceTick) : 0,
      isPaused: clock.isPaused,
    },
    ballFrame: -1,
    pitcherTick: null,
    pitcherTickEnd: null,
  }
  if (clock.releaseTick === null) return idle
  const stateTick = clock.nowTick - clock.releaseTick + HUMAN_PITCH_RELEASE_STATE_TICK
  if (stateTick < 0) return idle
  const ballFrame = stateTick - pitcherReleaseTicksOf(clock.aceOrder)
  /**
   * 0x12 틱 0 의 공 틱 — 공 틱 N + 1 이 예약한 다음 틀. 맞은 공인데 `hit` 을 안 받았으면(0x13 을 안 그리는 화면) 예전처럼 공 틱 N + 1
   * 에서 대기로 둔다.
   */
  const hit = clock.hit ?? null
  if (hit !== null) {
    // 맞은 공 — 판정 틀 J(공 틱 judgeBallTick)까지 0x11, 다음 틀이 0x13 틱 0, `hitEndTickOf` 틱의 갱신이 0x17 을 예약한다
    const judgeStateTick = pitcherReleaseTicksOf(clock.aceOrder) + hit.judgeBallTick
    if (stateTick <= judgeStateTick) {
      return { phase: { kind: '투구중', tick: stateTick, isPaused: false }, ballFrame, pitcherTick: stateTick, pitcherTickEnd: null }
    }
    // 0x17 이 선 뒤(부르는 화면이 수비 판으로 넘어가기 전 그림)도 0x13 의 마지막 그림에 둔다 — 대기 동작으로 깜빡이지 않게
    const hitTick = Math.min(stateTick - judgeStateTick - 1, hitEndTickOf(hit))
    return {
      phase: { kind: '타격', tick: hitTick, isPaused: false },
      // 0x13 그리기 0x4cb1c 의 공은 타구 쪽이다 — 투구 공은 안 그린다(타자편 `useStageAnimation` 의 '타격' 과 같다)
      ballFrame: -1,
      pitcherTick: stateTick,
      // 투수 갱신 0x9e004 는 0xf · 0x11 갱신에서만 — 판정 틀 J 가 마지막이다(타자편 판정 틀의 `pitcherTickEnd` 와 같다)
      pitcherTickEnd: judgeStateTick,
    }
  }
  const flightEndFrame = clock.frameCount + (clock.resultTicks > 0 ? 2 : 1)
  if (ballFrame < flightEndFrame) {
    return { phase: { kind: '투구중', tick: stateTick, isPaused: false }, ballFrame, pitcherTick: stateTick, pitcherTickEnd: null }
  }
  const resultTick = ballFrame - flightEndFrame
  if (clock.resultTicks > 0 && resultTick <= clock.resultTicks) {
    return {
      phase: { kind: '결과', tick: resultTick, isPaused: false, isInPlay: false },
      ballFrame: -1,
      pitcherTick: stateTick,
      // 0x11 의 마지막 갱신(공 틱 N + 1 — 예약한 틀)
      pitcherTickEnd: stateTick - resultTick - 1,
    }
  }
  return idle
}

/** 0x4e6e2 — 타석을 안 끝낸 공의 0x12 문턱 */
const NOT_AT_BAT_END_RESULT_THRESHOLD = 0xf

/**
 * 공 하나의 원본 상태 경계(장면 틱) — `pitcherSideStageFrameOf` 와 같은 셈이다.
 * 0x11 은 놓은 틱 − 10 이 틱 0, 0x12 는 0x11 의 상태 틱 `pitcherReleaseTicksOf + N + 2` 가 틱 0(공 틱 N + 1 의 갱신이 예약한 다음 틀),
 * 0x12 문턱 갱신(0x4e6d4)이 예약한 다음 상태는 `resultTicks + 1` 틀 뒤에 선다 — 타석을 끝낸 공(문턱 0x1f)이면 0xd, 아니면 0xf.
 * 맞은 공(`resultTicks` 0)은 이 장면이 0x13 을 따로 세우지 않아 0x11 만 적는다.
 */
export function pitcherSideStateEntriesOf(
  releaseTick: number,
  frameCount: number,
  resultTicks: number,
  aceOrder?: number | null,
  /** 맞은 공이면 0x13 · 0x17 경계도 적는다 (`PitcherSideStageClock.hit`) */
  hit?: PitcherHitClock | null,
): SceneStateEntry[] {
  const flightEntry = releaseTick - HUMAN_PITCH_RELEASE_STATE_TICK
  const entries: SceneStateEntry[] = [{ tick: flightEntry, state: SCENE_STATE.투구 }]
  if (hit !== undefined && hit !== null) {
    // 판정 틀 J 의 메시지 0x6aa(0x51408)가 0x13 을 예약 — 다음 틀이 0x13 틱 0. 0x13 틱 `hitEndTickOf` 의 갱신 0x406e8 이 0x17 을 예약
    const hitEntry = flightEntry + pitcherReleaseTicksOf(aceOrder) + hit.judgeBallTick + 1
    entries.push(
      { tick: hitEntry, state: SCENE_STATE.타격 },
      { tick: hitEntry + hitEndTickOf(hit) + 1, state: SCENE_STATE.인플레이 },
    )
    return entries
  }
  if (resultTicks <= 0) return entries
  const resultEntry = flightEntry + pitcherReleaseTicksOf(aceOrder) + frameCount + 2
  entries.push(
    { tick: resultEntry, state: SCENE_STATE.결과 },
    { tick: resultEntry + resultTicks + 1, state: resultTicks > NOT_AT_BAT_END_RESULT_THRESHOLD ? SCENE_STATE.준비 : SCENE_STATE.선택 },
  )
  return entries
}

/**
 * 공을 놓은 틱(0x11 틱 10)에서 0x12 틱 0 까지 — 0x11 의 상태 틱 `pitcherReleaseTicksOf + N + 2` 가 0x12 틱 0 이다
 * (`pitcherSideStageFrameOf` 와 같은 셈). 0x12 진입 틀의 그리기(0x4ce9c — 삼진 진동 4d0ba)가 이 틱에 돈다.
 */
export function pitchResultEntryDelayTicksOf(frameCount: number, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + frameCount + 2
}

/**
 * 0x12 를 지나는 판정인가 — 맞히지 못한 공(볼 · 스트라이크 · 헛스윙 · 사구)만. 맞은 공(파울 포함)은 0x13 → 0x17 로 간다.
 */
export function passesHeldResult(resolution: PitchResolution): boolean {
  return resolution.kind !== '타구' && resolution.kind !== '파울'
}

/**
 * 공을 놓은 틱(0x11 틱 10)부터 장면이 다시 '대기' 로 돌아올 때까지의 틱 — 남은 0x11(공 틱 N + 1 — 0x12 를 예약한 틀 — 까지) + 0x12
 * (문턱 + 1 그림 — 정정: 예전엔 문턱 그림만 세어 0x12 의 마지막 틀(문턱 틱, 4e72c 가 다음 상태를 예약한 틀)을 빠뜨렸다).
 * 원본은 그동안 상태가 0x11 · 0x12 라 구질 키(0xf) · 견제 · '#' · 0xe 의 OK 를 받지 않는다 (키 갈래 0x53580 은 상태별 표).
 */
export function pitchSceneBusyTicksOf(frameCount: number, resultTicks: number, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + frameCount + (resultTicks > 0 ? 2 + resultTicks + 1 : 1)
}

/**
 * CPU 타자가 스윙을 거는 장면 틱 — 0x11 갱신 0x4e0dc: 공 틱 [+0x1098] ≥ 스윙 프레임 F(+0xfd8) 인 틱에 스윙 객체의
 * vtable +0x14 · +0x18 을 부른다. 공 틱은 놓은 틱(상태 틱 10)에서 `pitcherReleaseTicksOf(순번) − 10` 지난 뒤 0 이다
 * (`pitcherSideStageFrameOf` 와 같은 셈). ⚠️ 근사: 한 틱 안의 갱신 차례(공 틱 +1 과 스윙 검사)는 공 틱 0 이 그려지는 틱으로 맞췄다.
 */
export function cpuSwingTickOf(releaseTick: number, swingFrame: number, aceOrder?: number | null): number {
  return releaseTick - HUMAN_PITCH_RELEASE_STATE_TICK + pitcherReleaseTicksOf(aceOrder) + Math.max(0, swingFrame)
}

/**
 * 0x13 이 0x17 을 예약하는 상태 틱 — 0x406e8: 큰 타구면 `문턱 ≤ 공 틱`(멈춤 포함 `hitPauseTicksOf`), 아니면 틱 8 · 이른 넘김.
 * 큰 타구는 OK(−5) · '5' 를 읽은 틱(40708~40712)에도 넘긴다 — 그 틱이 더 이르면 그 틱. 0 아래는 진입 틀(0)이다.
 */
export function hitEndTickOf(hit: PitcherHitClock): number {
  const skip = hit.skipTick ?? null
  const end = skip === null ? hit.ticks : Math.min(hit.ticks, skip)
  return Math.max(0, end)
}

/**
 * 공을 놓은 틱(0x11 틱 10)에서 0x17 틱 0 까지 — 남은 0x11(판정 틀 J 까지) + 0x13(`hitEndTickOf` + 1 그림). 부르는 화면이 수비 판을
 * 띄우는 틱이다 (`pitcherSideStageFrameOf` 와 같은 셈)
 */
export function pitchHitSceneTicksOf(hit: PitcherHitClock, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + hit.judgeBallTick + 1 + hitEndTickOf(hit) + 1
}

/** 사람이 던진 공을 CPU 타자가 맞힌 장면 — 0x11 끝 · 0x13 그리기 재료 */
export interface PitcherHitScene extends PitcherHitClock {
  /** 감상 플래그 +0x199a (0x392ac) — 큰 타구 멈춤 · 016 · OK 건너뛰기 */
  readonly watchesBigHit: boolean
  /**
   * 판정 틀에 타격점에 쏘는 보통 불꽃 `.ptc` id (`hitParticles.hitParticleIdOf`) — 안 쏘면 null. 필살 스윙이 0x49aec 의 그림 갈래를 타면
   * 장면이 이 불꽃 대신 필살 파티클을 쏜다(`specialSwing`)
   */
  readonly particleId: number | null
  /** 타격점으로 보는 공 경로 번호 — 불꽃 · 016 자리 */
  readonly contactFrame: number
  /**
   * 판정 0x6aa 가 [경기+0xfd4] 에 쓴 결과 코드 — 투수 그리기의 홈런 갈래(0x3908a, `pitcherFatigue.pitcherHomeRunMarksOf`)가 본다
   */
  readonly resultCode: number
  /**
   * CPU 필살 스윙(S+0x10 ≠ 0)으로 맞은 공이면 그 번호(레코드 +0x18) · 마타자인가(0xb633d) — 스윙 그리기 0x49e64 49f7c 가 맞은 틀 ·
   * 0x13 에 부르는 0x49aec 의 재료(`specialSwingEffect` · `hitParticles.specialSwingParticlesOf`). 공격 측을 안 가린다. 아니면 null
   */
  readonly specialSwing: { readonly number: number; readonly isAceBatter: boolean } | null
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
 * ⚠️ 근사: 불꽃 자리는 타자편처럼 공 경로 F(번트는 N − 1)의 화면 점이다(타자편 `ballPixelAt(pitch, swing.frame)`).
 */
export function pitcherHitSceneOf(
  contact: BattedContact,
  cpuSwing: CpuSwingPose | null,
  frameCount: number,
  /** 친 타자의 손 — 이른 넘김 공의 수평각 d 를 고른다(0x51408). 판 입력의 `contact.batterHand` 가 없을 때 쓴다 */
  batterHand: number,
): PitcherHitScene {
  const { pattern, resultCode } = contact
  const trajectory = battedBallTrajectory(pattern)
  const pauseInput: HitPauseInput = {
    resultCode,
    angle: pattern[0],
    landingTick: trajectory.landingTick,
    poleTick: trajectory.poleTick,
    carryScale: trajectory.carryScale,
    // 이른 넘김은 [경기+0xf2c] 공 — 판 공과 수평각이 d 다른 공 (0x5174c, `hitPause.pauseInputOf` 와 같다)
    earlyTick: earlyHitPauseTickOf(resultCode, battedBallTrajectory(earlyPassPatternOf(pattern, contact.batterHand ?? batterHand))),
  }
  const watchesBigHit = isBigHit(pauseInput)
  const isBunt = cpuSwing !== null && cpuSwing.buntKind !== 0
  const judgeBallTick = cpuSwing === null || isBunt ? frameCount - 1 : cpuSwing.frame + 1
  return {
    judgeBallTick,
    ticks: hitPauseTicksOf(pauseInput),
    skipTick: null,
    watchesBigHit,
    particleId: hitParticleIdOf(hitParticleInputOf(pattern, resultCode, watchesBigHit)),
    contactFrame: cpuSwing === null || isBunt ? frameCount - 1 : cpuSwing.frame,
    resultCode,
    specialSwing: contact.specialSwing ?? null,
  }
}

/** 판정 틀에 타격점에 쏘는 파티클 하나 — 0xbbc84(x, y + `offsetY`, id, img, …) */
export interface PitcherHitParticle {
  readonly id: number
  readonly img: number
  readonly offsetY: number
}

/**
 * **판정 틀의 타격점 그림 · 파티클** — 스윙 그리기 0x49e64 49f7c(상태 0x13 이거나 맞음 +0xfd2 ∧ 0xb9271 == 0)가 0x49aec 를 부르고,
 * 필살 스윙이 그림 갈래를 타면(`specialSwingStageEffectOf` ≠ null) [sp+0x60] = 1 이라 49fa2 가 보통 불꽃(49faa~4a0ce)을 건너뛰고
 * 0x49aec 가 필살 파티클(49dbc · 49de0, `specialSwingParticlesOf`)을 쏜다. 아니면 보통 불꽃(`particleId`)이다 — 타자편 `BattingStage`
 * 의 판정과 같은 갈래다. `aceBatterOrder` 는 0xb63a0(마타자 순번, 없으면 null), `side` 는 0xb63c1(타자 손).
 */
export function pitcherHitContactOf(
  hit: Pick<PitcherHitScene, 'particleId' | 'specialSwing'>,
  batterForm: number,
  aceBatterOrder: number | null,
  side: number,
): { readonly effect: SpecialSwingStageEffect | null; readonly particles: readonly PitcherHitParticle[] } {
  const special = hit.specialSwing
  const aceIndex = special !== null && special.isAceBatter ? (aceBatterOrder ?? -1) : -1
  const effect = special === null ? null : specialSwingStageEffectOf(special.number, batterForm, aceIndex, side)
  if (special !== null && effect !== null) {
    return { effect, particles: specialSwingParticlesOf(special.number, batterForm, aceIndex) }
  }
  return { effect: null, particles: hit.particleId === null ? [] : [{ id: hit.particleId, img: HIT_PARTICLE_IMAGE, offsetY: 0 }] }
}
