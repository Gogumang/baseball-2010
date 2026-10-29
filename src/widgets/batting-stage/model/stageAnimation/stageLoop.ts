/**
 * 타석 루프 하나(`startStageLoop`)가 사는 동안 드는 칸 — 루프를 세울 때 한 번 만들고, 틀마다 갱신 · 그리기 함수가 고친다.
 * 렌더가 아니라 effect 안에서만 산다(그림에서 읽거나 고치지 않는다). 칸마다의 원본 근거는 그 칸의 주석에 있다.
 */
import type { MutableRefObject } from 'react'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import type { SettlementEffect } from '@/entities/batting/model/settlementEffect'
import { createGameSceneDrawGate } from '@/shared/lib/commonWindow/commonWindow'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import { createRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { NO_STAGE_EFFECTS } from '@/widgets/batting-stage/lib/homeRunEffects'
import type { FrozenClock } from '@/widgets/batting-stage/lib/frozenClock'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { createCloudFrameCursor } from '@/widgets/batting-stage/model/sceneCloudClock'
import { sceneResultCodeNow } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { createSkillPanelDriver } from '@/widgets/batting-stage/model/skillPanelDriver'
import type { PendingHit, StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { StageHandlers } from '@/widgets/batting-stage/model/stageAnimation/stageHandlers'

/** 루프가 읽고 쓰는 타석 칸 — `StageRefs` 가운데 이 루프가 쓰는 것과 훅이 든 고리 · 쉬기 풀림 칸 */
export type StageLoopRefs = Pick<
  StageRefs,
  | 'canvasRef'
  | 'pitchRef'
  | 'pitchTypeNumberRef'
  | 'phaseRef'
  | 'phaseStartTickRef'
  | 'phaseEntryRef'
  | 'hitSkipKeyTickRef'
  | 'keyLatch'
  | 'shownTicks'
  | 'resultTextRef'
  | 'homeRunStartTickRef'
  | 'swingStartTickRef'
  | 'pitcherStartTickRef'
  | 'shiftRef'
  | 'buntRef'
  | 'pendingHitRef'
  | 'resultTicksRef'
  | 'isInPlayResultRef'
  | 'isHitByPitchResultRef'
  | 'swingRef'
  | 'pitchJudgedRef'
  | 'heldResultRef'
  | 'particlesRef'
  | 'inPlayEnteredTickRef'
  | 'latestRef'
> & {
  /** 고리는 남은 필살 횟수 같은 props 로 자주 바뀐다 — 루프를 다시 세우면 투구 시작 시각이 지워지므로 ref 로 읽는다 */
  readonly handlersRef: MutableRefObject<StageHandlers>
  /** 쉬기가 풀린 커밋의 장면 틱 (`useStageAnimation` 의 같은 칸) */
  readonly resumeTickRef: MutableRefObject<number | null>
}

/**
 * 이번 0x13('타격') — 0x13 이 선 장면 틱 · 다음 상태가 서는 장면 틱(0x13 갱신이 0x17 을 예약한 틀 + 1, 아직이면 null) · 그때의 스윙
 * 시작 틱. 0x13 을 끝내는 틀(`commitHit`)은 결과를 넘기며 `pendingHitRef` 를 비우지만 그 틀의 그림은 아직 0x13 이라 여기서 든다
 * (그리기 꼬리 `bigHitScreen` · 스윙 멈춤 `bigHitSwingSkipsOf`)
 */
export interface HitInStage {
  readonly pending: PendingHit
  readonly startTick: number
  endTick: number | null
  readonly swingStartTick: number | null
  /** 이 0x13 에서 창이 선 첫 그림([창+0x250])이 든 자리 — 그 앞 마지막 0x13 틱 (`bigHitReleaseTickOf`) */
  readonly frozenDraws: number[]
}

/** 이번 0xf~0x10 의 CPU 투구 굴림 — 대기에 든 장면 틱이 바뀌면(새 공 · 견제 뒤 · 쉼) 새로 센다 */
export interface CpuPitchCycle {
  startTick: number
  typeRolls: number
  typeNumber: number
  target: WorldPoint | null
}

/**
 * 파티클 도구(`widgets/particles` — 설정 표 · 그림 입력 모습 · 파트 그림 받기). 다른 조각이라 루프 파일들은 직접 부르지 않고
 * 훅(`useStageAnimation`)이 넘긴 것을 쓴다
 */
export interface StageParticleKit {
  readonly configOf: (callId: number) => ParticleConfig | null
  readonly signatureOf: (scene: ParticleScene | null | undefined) => readonly number[] | null
  readonly preloadParts: () => void
}

export interface StageLoop {
  readonly refs: StageLoopRefs
  readonly particleKit: StageParticleKit
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  animationHandle: number
  /** 그림 입력이 바뀐 틀에서만 다시 그린다 — 루프를 다시 세우면 새로 그린다 */
  readonly drawMemo: ReturnType<typeof createDrawMemo>
  /** 창이 선 첫 그림([창+0x250], 52efe)을 한 번 다시 그린다 — 마지막으로 그린 장면 그림 입력을 든다 */
  readonly frozenDrawGate: ReturnType<typeof createGameSceneDrawGate>
  lastStageScene: StageScene | null
  /**
   * 루상 주자 애니 시계(장면 +0xf24 의 애니 0~2) — 부르는 쪽이 경기 장면 수명의 칸을 넘기면 그것, 아니면 이 화면이 사는 동안.
   * `runnerTick` 은 이 화면에서 마지막으로 센 틱 — 첫 그림이 0x35b94 첫 부름이다
   */
  readonly localRunnerClock: ReturnType<typeof createRunnerAnimationClock>
  runnerTick: number
  /**
   * 창이 선 첫 그림([창+0x250])이 든 장면 틱 — 그 그림은 그리기 쪽 애니(투수 덧그림 · 필살 스윙 그림 · 판정 글자 · 램프 확대 · 하늘 조명)를
   * 한 칸 더 넘기고 그 앞당김이 남는다. 그림 입력에 실어 `renderBattingStage` 가 센다(`stageRedraws`)
   */
  redrawTicks: readonly number[]
  /** 구름 셈(`sceneCloudClock`)에서 이 루프가 마지막으로 본 그림 */
  readonly cloudCursor: ReturnType<typeof createCloudFrameCursor>
  /** 마구 상태 (`cpuPitchArgs` 의 `magicStateOf`) — 마운드에 선 투수가 바뀌면 새로 만든다 */
  magic: { readonly magicId: number; readonly state: MagicPitchGameState } | null
  /** 투구 순간 소리를 이미 낸 공 — 0x3f378 은 투수 단계가 놓는 칸에 **닿는 틱 한 번만** 낸다(`cmp r6,r4 ; bne`) */
  releaseSoundPitch: object | null
  cpuPitchCycle: CpuPitchCycle | null
  /** 0x11 에 들어서 놓기(틱 10)를 기다리는 공 — 0xf 의 마지막 구질과 0x10 의 목표점 */
  releasePending: { typeNumber: number; target: WorldPoint } | null
  /** 실투로 놓은 공 — 놓기 0x4dc78 이 투구 객체 +8 = 4 (4deae), 투수 그리기 0x38d1c 가 그림마다 1 줄이며 "!" 를 그린다 */
  mistakeMarkPitch: object | null
  /**
   * 0x11 의 마지막 갱신 틱(투수 틱 셈) — 0x4e060 이 0x12 · 0x13 으로 넘긴 그림. 투수 단계 갱신 0x9e004 는 0xf · 0x11 갱신에서만
   * 불리므로(`stageScenery` 투수 그림 객체) 그 뒤 단계가 굳는다. 아직 0x11 이면 null
   */
  pitcherTickEnd: number | null
  /**
   * 결과 코드 [경기+0xfd4] — 경기 장면 객체 칸이라 장면 부품이 바뀌어도 이어 든다(`sceneResultCodeStore`). 0x11 진입(3deea)이 공마다
   * 0 으로 지우고 메시지 0x6aa(스윙 · 번트 판정, 5130e)가 쓴다. 이 부품은 0x11 진입 때의 값(늘 0)과 이 공의 판정 틱 · 값을 든다
   * (`pitcherFatigue` 홈런 갈래). 부품이 새로 서면 장면 객체에 남은 값부터 본다
   */
  resultCodeBeforePitch: number | null
  judgedResultCode: { readonly tick: number; readonly code: number | null } | null
  /** 큰 타구 멈춤을 푼(016 을 쏜) 타구 — 한 번만 */
  hitStopReleased: PendingHit | null
  hitInStage: HitInStage | null
  /** 파티클 틱 — 이 루프의 첫 그림은 세지 않는다(null) (`particleSteps`) */
  particleTick: number | null
  /** 홈런 효과 객체 [0x1400064] — 글자 창(`homeRunText`)이 몬다 (`lib/homeRunEffects`) */
  stageEffects: typeof NO_STAGE_EFFECTS
  /** 경기 정산 효과 — 결과 배경의 첫 그림에서 한 번 깐다(0x4ea0c). 깔기 전이면 undefined, 끈 효과면 null */
  settlementEffect: SettlementEffect | null | undefined
  /**
   * 결과 창 뒤 배경(`isResultBackdrop`)으로 바뀐 시각 — 그때부터 +0x17e2 를 센다. 타석이면 null.
   * 공용 창이 떠 있으면 경기 장면 0x52c50 이 52cc6 에서 갱신 0x4b100 을 건너뛰어 +0x17e2 가 안 오르므로 시계가 선다
   * (`frozenClock`). ⚠️ 정정(r106): 그리기도 52efe 에서 창이 선 첫 그림 말고는 건너뛰어 구름 · 정산 효과도 멈춘다 — 경기 장면이
   * 서 있으면 틀 머리의 `isGameSceneFrozen` 이 그림을 통째로 세우고, 이 시계는 경기 장면 셈 밖에서 히든 오픈 알림 문맥만
   * 선 경우(`isSceneFrozen`)에 남는다
   */
  backdropClock: FrozenClock | null
  /**
   * '대기' 에서 쉬기 시작한 장면 틱 — 쉬는 동안은 단계 시작 틱을 그림마다 되밀어 단계 틱이 늘 0 이라 따로 센다.
   * 0xe 진입 0x50674 가 필살 횟수 표시의 애니(game_ui 애니 5)를 되감아 거는 자리다 (`specialSwingBadge`).
   */
  pausedSince: number | null
  /** 루프가 쉬는 '대기' 를 본 적이 있다 — 풀린 첫 틀에 0xf 시작 틱을 다시 잡는다(`resumeTickRef`) */
  hasSeenPause: boolean
  /**
   * **경기 스킬 표시 판** (`model/skillPanelDriver`) — 사람이 치는 타석의 0xf 는 쉬지 않는 '대기', 0xf 진입은 그 단계에 든 장면 틱
   * (`phaseStartTickRef`)이 바뀔 때, 0x10 · 0x11 은 '투구중'이다.
   */
  readonly stepSkillPanel: ReturnType<typeof createSkillPanelDriver>
}

/** 루프 칸을 세운다 — 만드는 차례(그리기 문 · 파티클 파트 받기 · 결과 코드 읽기)는 옛 루프 머리 그대로 */
export function createStageLoop(
  refs: StageLoopRefs,
  particleKit: StageParticleKit,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): StageLoop {
  const drawMemo = createDrawMemo()
  const frozenDrawGate = createGameSceneDrawGate()
  // 장면의 모든 때는 경기 장면 틱 하나로 센다(`gameSceneTickOf`) — 공용 창이 떠 있는 동안 서고 닫히면 이어 흐른다.
  // 단계 시작은 그 단계가 선 장면 틱이고, 단계 안 틱은 (지금 장면 틱 − 시작 틱)이다
  const localRunnerClock = createRunnerAnimationClock()
  const cloudCursor = createCloudFrameCursor()
  // 파티클 파트 그림은 연출이 뜨기 전에 받아 둬야 첫 연출이 보인다
  particleKit.preloadParts()
  const resultCodeBeforePitch = sceneResultCodeNow()
  return {
    refs,
    particleKit,
    canvas,
    context,
    animationHandle: 0,
    drawMemo,
    frozenDrawGate,
    lastStageScene: null,
    localRunnerClock,
    runnerTick: -1,
    redrawTicks: [],
    cloudCursor,
    magic: null,
    releaseSoundPitch: null,
    cpuPitchCycle: null,
    releasePending: null,
    mistakeMarkPitch: null,
    pitcherTickEnd: null,
    resultCodeBeforePitch,
    judgedResultCode: null,
    hitStopReleased: null,
    hitInStage: null,
    particleTick: null,
    stageEffects: NO_STAGE_EFFECTS,
    settlementEffect: undefined,
    backdropClock: null,
    pausedSince: null,
    hasSeenPause: false,
    stepSkillPanel: createSkillPanelDriver(),
  }
}
