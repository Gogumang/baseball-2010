/**
 * 사람이 던지는 타석 루프 하나(`startPitcherSideLoop`)가 사는 동안 드는 칸 — 루프를 세울 때 한 번 만들고, 틀마다 갱신 · 그리기 함수가
 * 고친다. 렌더가 아니라 effect 안에서만 산다(그림에서 읽거나 고치지 않는다). 장면의 때는 경기 장면 틱 하나로 센다(`gameSceneTickOf`) —
 * 공용 창이 떠 있는 동안 서고 닫히면 이어 흐른다. 공을 놓은 틱 · 쉬기 시작한 틱 · 대기 동작 틱이 모두 이 격자 위에 선다.
 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import { createGameSceneDrawGate } from '@/shared/lib/commonWindow/commonWindow'
import { createSceneKeyLatch } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitchGaugeOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'
import { createCloudFrameCursor } from '@/widgets/batting-stage/model/sceneCloudClock'
import { createSkillPanelDriver, type SkillPanelFrame } from '@/widgets/batting-stage/model/skillPanelDriver'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'

/** 장면 파티클 하나를 쏜다 — 파티클 칸 · 설정 표는 다른 조각(`widgets/particles`)이라 부품이 묶어 넘긴다 */
export type EmitSceneParticle = (id: number, x: number, y: number, img: number) => void

export interface PitcherSideLoopInput {
  readonly canvasRef: { readonly current: HTMLCanvasElement | null }
  /** 그림마다 읽는 최신 props */
  readonly latestRef: { readonly current: PitcherSideStageProps }
  /** '넘기기' 상황 버튼을 띄우거나 걷는다 — 바뀔 때만 부른다 */
  readonly offerHitSkip: (offers: boolean) => void
  readonly emitParticle: EmitSceneParticle
}

/**
 * 놓기 전 0x11 그림(틱 0~9)의 마구 공 파티클 — 지금 게이지(0x11)의 상태 틱 칸과 마지막으로 쏜 0x11 틱. 그 게이지가 서 있는 동안만
 * (`windUpMagic`). 놓은 공이 들면 남은 틱(≤ 9)을 마저 쏘고 비운다
 */
export interface WindUpMagic {
  readonly stateTickRef: { readonly current: number }
  readonly overlay: PitchGaugeOverlay
  emittedStateTick: number
}

/** 판정 틀에 고른 0x49aec 그림 갈래(필살 스윙)와 타격점 */
export type HitSpecialEffect = SpecialSwingStageEffect & { readonly x: number; readonly y: number }

/** 공 하나가 사는 동안의 칸 — 새 공(놓은 공)이 들면 새로 만든다 (`pitchMarksOf`) */
export interface PitchMarks {
  /** 0x13 재료 — 지금 공의 맞은 장면(공이 바뀌면 그때 받은 값). 판정 틀이 다시 만든 재료로 바꾼다 */
  hit: PitcherHitScene | null
  /** 불꽃 · 016 · 끝 알림을 공마다 한 번 */
  sparkShot: boolean
  stopShot: boolean
  endNotified: boolean
  /** 0x13 땅 파티클(3b472)을 마지막으로 셈한 0x13 틱 — 공마다 처음부터 */
  groundEmittedTick: number | null
  /** 판정 틀에 고른 필살 스윙 그림 갈래와 타격점 — 맞은 틀 · 0x13 그림마다 그린다. 없으면 null */
  specialEffect: HitSpecialEffect | null
  /** 마구 공 파티클(0x3b2f4 3b496)을 마지막으로 쏜 장면 틱 — 그림(장면 틱) 하나에 한 번 */
  magicEmittedTick: number | null
  /** 이 공의 0x12 첫 그림에서 삼진 양끝 파티클을 쐈나 (`strikeoutJudgeParticlesOf`) */
  strikeoutShot: boolean
  /** OK · '5' 를 읽은 0x13 상태 틱 (0x406e8 40708) */
  skipTick: number | null
  /** 지금 공의 큰 타구 0x13 동안 창 첫 그림이 든 0x13 틱(`PitcherHitClock.frozenDraws`) */
  frozenDraws: readonly number[]
}

export function pitchMarksOf(hit: PitcherHitScene | null): PitchMarks {
  return {
    hit,
    sparkShot: false,
    stopShot: false,
    endNotified: false,
    groundEmittedTick: null,
    specialEffect: null,
    magicEmittedTick: null,
    strikeoutShot: false,
    skipTick: null,
    frozenDraws: [],
  }
}

export interface PitcherSideLoop extends PitcherSideLoopInput {
  readonly context: CanvasRenderingContext2D
  handle: number
  /** 장면이 내려갔다 — 그리기 앞 갱신(`runDueSceneFrameUpdates`)이 그 자리에서 이 장면을 내릴 수 있다 */
  isDisposed: boolean
  /** 화면이 설 때 있던 공 — 수비 화면에서 돌아와 다시 서도 같은 공을 또 날리지 않는다 */
  shownPitch: Pitch | null
  releaseTick: number | null
  /** 지금 공의 CPU 스윙 — 화면이 설 때 있던 공은 다시 날리지 않으므로 그 스윙도 없다 */
  shownSwing: CpuSwingPose | null
  /** 지금 공이 실투인가 — 화면이 설 때 있던 공은 다시 날리지 않으므로 "!" 도 없다 */
  shownMistake: boolean
  pausedSinceTick: number
  wasPaused: boolean
  /** 상태 경계를 마지막으로 적은 공(놓은 장면 틱 · 0x12 문턱) */
  markedStateEntries: string
  /** 빈 구질 칸 키(0x50de8 → 투수 그림 상태 2)를 본 표지와 그 장면 틱 — 새 공(상태 1)이 들면 지운다 */
  seenIdlePress: number
  idleStartTick: number | null
  /** 대기 동작의 마지막 갱신 틱 — 0xf 를 떠나면(0x10 조준 따위) 0x39c1c 가 안 불려 그 단계에 굳는다. 아직 0xf 면 null */
  idleEndTick: number | null
  /** 팝업(`isFrozen`) 동안 멈춘 틱 수 — 장면 틱에서 뺀다 */
  frozenTicks: number
  frozenSinceTick: number | null
  /** 그림 입력이 바뀐 틀에서만 다시 그린다(`createDrawMemo`) — 갱신은 틀마다 그대로 돈다 */
  readonly drawMemo: ReturnType<typeof createDrawMemo>
  /** 창이 선 첫 그림([창+0x250], 52efe)을 한 번 다시 그린다 — 마지막으로 그린 장면 그림 입력과 스킬 판 재료를 든다 */
  readonly frozenDrawGate: ReturnType<typeof createGameSceneDrawGate>
  lastStageScene: StageScene | null
  lastSkillPanelFrame: SkillPanelFrame | null
  /** 창이 선 첫 그림이 든 장면 틱(`nowTick` 격자) — 그리기 쪽 애니를 한 칸 더 넘긴 몫(`stageRedraws`) */
  redrawTicks: readonly number[]
  /** 구름 셈(`sceneCloudClock`)에서 이 루프가 마지막으로 본 그림 */
  readonly cloudCursor: ReturnType<typeof createCloudFrameCursor>
  /** 경기 스킬 표시 판 — 0xf 에 들 때마다 하나씩 올리는 표지(구질 목록이 새로 실리면 새 0xf 진입) */
  readonly stepSkillPanel: ReturnType<typeof createSkillPanelDriver>
  skillPanelStateFSerial: number
  wasSkillPanelStateF: boolean
  /** 마지막으로 본 0xd 진입 표지 */
  seenSceneDEntryMark: number | undefined
  /** '넘기기' 상황 버튼을 알린 상태 — 바뀔 때만 React 에 알린다 */
  hitSkipOffered: boolean
  windUpMagic: WindUpMagic | null
  /** 0x13 동안 받은 OK · '5' — 다음 틀 머리의 키 처리(0x498d4)가 꺼낸다(`sceneKeyLatch`) */
  readonly hitKeyLatch: ReturnType<typeof createSceneKeyLatch>
  /** 키를 꺼내는 틀의 0x13 상태 틱 — 0x13 이 아니면 null */
  keyHitTick: number | null
  marks: PitchMarks
}

export function createPitcherSideLoop(input: PitcherSideLoopInput, context: CanvasRenderingContext2D): PitcherSideLoop {
  const first = input.latestRef.current
  return {
    ...input,
    context,
    handle: 0,
    isDisposed: false,
    shownPitch: first.pitch,
    releaseTick: null,
    shownSwing: null,
    shownMistake: false,
    pausedSinceTick: 0,
    wasPaused: false,
    markedStateEntries: '',
    seenIdlePress: 0,
    idleStartTick: null,
    idleEndTick: null,
    frozenTicks: 0,
    frozenSinceTick: null,
    drawMemo: createDrawMemo(),
    frozenDrawGate: createGameSceneDrawGate(),
    lastStageScene: null,
    lastSkillPanelFrame: null,
    redrawTicks: [],
    cloudCursor: createCloudFrameCursor(),
    stepSkillPanel: createSkillPanelDriver(),
    skillPanelStateFSerial: 0,
    wasSkillPanelStateF: false,
    seenSceneDEntryMark: first.sceneDEntryMark,
    hitSkipOffered: false,
    windUpMagic: null,
    hitKeyLatch: createSceneKeyLatch(),
    keyHitTick: null,
    marks: pitchMarksOf(null),
  }
}
