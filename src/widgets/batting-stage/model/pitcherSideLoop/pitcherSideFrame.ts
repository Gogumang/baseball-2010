/** 한 틀의 재료 — 지금 공 · 판정 · 0x13 시계 · 장면 단계. 갱신 · 그림 함수가 같은 값을 읽는다 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { passesHeldResult, pitcherSideStageFrameOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitcherHitClock, PitcherHitScene, PitcherSideStageFrame } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'
import { runHitSkipKeys } from '@/widgets/batting-stage/model/pitcherSideLoop/hitSkipKey'

export interface PitcherSideTicks {
  readonly rawNow: number
  /** 경기 장면 틱 */
  readonly sceneTick: number
  /** 팝업(`isFrozen`)으로 멈춘 틱을 뺀 장면 틱 — 이 장면의 공 · 대기 시계 */
  readonly nowTick: number
}

export interface PitcherSideFrame extends PitcherSideTicks {
  readonly current: PitcherSideStageProps
  /** 이 장면이 날린 공 — 화면이 설 때 이미 있던 공이면 null */
  readonly pitch: Pitch | null
  readonly resolution: PitchResolution | null
  readonly aceOrder: number | null
  /** 타자 손 0xb63c0 — props 가 안 주면 폼의 낮은 비트 */
  readonly side: number
  /** 0x12 문턱 — 0x12 를 안 지나는 판정(타구 · 파울)이면 0 */
  readonly heldResultTicks: number
  /** 맞은 장면 재료 — 판정 틀(`judgeHitAt`)이 다시 만든 재료로 바꾼다 */
  hitBase: PitcherHitScene | null
  /** 이 틀의 0x13 시계 — 판정 틀 앞의 재료에 건너뛰기 키 · 창 첫 그림을 실은 것 */
  readonly hit: PitcherHitClock | null
  readonly stage: PitcherSideStageFrame
}

/**
 * 이 틀의 재료를 모은다 — 52d9e 키 0x498d4 가 앞 틀 뒤에 받은 OK · '5' 를 이 틀의 0x13 갱신 앞에서 꺼낸다(`runHitSkipKeys`),
 * 그 뒤의 0x13 시계로 장면 단계를 센다
 */
export function pitcherSideFrameOf(loop: PitcherSideLoop, current: PitcherSideStageProps, ticks: PitcherSideTicks): PitcherSideFrame {
  const pitch = loop.releaseTick === null ? null : loop.shownPitch
  const resolution = current.resolution
  const aceOrder = current.acePitcher?.order ?? null
  const hitBase = pitch === null ? null : loop.marks.hit
  loop.keyHitTick = keyHitTickOf(loop, ticks.nowTick, pitch, aceOrder, hitBase)
  runHitSkipKeys(loop, current, ticks.sceneTick)
  const hit = hitClockOf(loop, hitBase)
  const heldResultTicks = heldResultTicksOf(resolution, current.resultTicks)
  const stage = pitcherSideStageFrameOf({
    nowTick: ticks.nowTick,
    releaseTick: loop.releaseTick,
    frameCount: pitch?.frameCount ?? 0,
    resultTicks: heldResultTicks,
    isPaused: current.isPaused,
    pausedSinceTick: loop.pausedSinceTick,
    aceOrder,
    hit,
  })
  const side = current.batterSide ?? batterSideOfForm(current.batterForm)
  return { ...ticks, current, pitch, resolution, aceOrder, side, heldResultTicks, hitBase, hit, stage }
}

/** 0x13 시계 — 맞은 장면 재료에 읽은 건너뛰기 키 · 창 첫 그림을 싣는다 */
function hitClockOf(loop: PitcherSideLoop, hitBase: PitcherHitScene | null): PitcherHitClock | null {
  if (hitBase === null) return null
  return { ...hitBase, skipTick: loop.marks.skipTick, frozenDraws: loop.marks.frozenDraws }
}

/** 0x12 문턱 — 0x12 를 지나는 판정만 */
function heldResultTicksOf(resolution: PitchResolution | null, resultTicks: number): number {
  return resolution !== null && passesHeldResult(resolution) ? resultTicks : 0
}

/** 키를 꺼내는 틀의 0x13 상태 틱 — 건너뛰기 키를 읽기 전 재료로 센다. 0x13 이 아니면 null */
function keyHitTickOf(
  loop: PitcherSideLoop,
  nowTick: number,
  pitch: Pitch | null,
  aceOrder: number | null,
  hitBase: PitcherHitScene | null,
): number | null {
  const releaseTick = loop.releaseTick
  if (hitBase === null || releaseTick === null) return null
  const { phase } = pitcherSideStageFrameOf({
    nowTick,
    releaseTick,
    frameCount: pitch?.frameCount ?? 0,
    resultTicks: 0,
    isPaused: false,
    pausedSinceTick: 0,
    aceOrder,
    hit: hitBase,
  })
  return phase.kind === '타격' ? phase.tick : null
}
