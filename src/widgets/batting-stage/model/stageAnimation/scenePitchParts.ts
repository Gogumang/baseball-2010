/** 그림 입력의 공 · 타자 몫 — 공 · 판정 글자 · 홈런 글자 · 타자 자세 · 맞은 틀의 곁 그림 · 0x13 연출 */
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { homeRunTextFrameAt } from '@/widgets/batting-stage/lib/homeRunBanner'
import { batterFrameNow } from '@/widgets/batting-stage/lib/stageText'
import { bigHitScreenOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import type { HitInStage, StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import type { StageFrameReads } from '@/widgets/batting-stage/model/stageAnimation/frameReads'
import { hitBallNow, hitCameraNow } from '@/widgets/batting-stage/model/stageAnimation/hitStage'
import { hitByPitchMarkNow, hitFlameNow, specialSwingEffectNow } from '@/widgets/batting-stage/model/stageAnimation/stageMarksNow'

/** 마운드 투수의 폼 · 손 (`stageSceneNow` 가 공 앞에서 고른다) */
export interface PitcherPose {
  readonly pitcherForm: number
  readonly pitcherHand: number
}

/** 부르는 쪽이 모는 글자 창이 있으면 그 칸대로만 그린다 (홈런더비 — `BattingStage` 의 `homeRunText`) */
function homeRunFrameNow(loop: StageLoop, reads: StageFrameReads): StageScene['homeRunFrame'] {
  const window = loop.refs.latestRef.current.homeRunText
  if (window === undefined) return undefined
  return window === null ? null : homeRunTextFrameAt(window, reads.tickTime, reads.tickLength)
}

/** 홈런 연출이 켜진 뒤 흐른 틱 */
function homeRunTickOf(reads: StageFrameReads): number {
  return reads.isHomeRun && reads.homeRunStartTick !== null ? reads.sceneTick - reads.homeRunStartTick : 0
}

export function pitchPartOf(loop: StageLoop, reads: StageFrameReads, pose: PitcherPose, swingStartTick: number | null) {
  const { shiftRef, phaseRef, resultTextRef, buntRef, latestRef } = loop.refs
  const latest = latestRef.current
  return {
    pitcherForm: pose.pitcherForm,
    pitcherHand: pose.pitcherHand,
    pitch: reads.pitch,
    frame: reads.ballFrame,
    shift: shiftRef.current,
    isEagleEyeEnabled: latest.isEagleEyeEnabled && phaseRef.current === '투구중',
    resultText: phaseRef.current === '결과' ? resultTextRef.current : '',
    isHomeRun: reads.isHomeRun,
    homeRunTick: homeRunTickOf(reads),
    homeRunFrame: homeRunFrameNow(loop, reads),
    swingFrame: batterFrameNow(reads.sceneTick, swingStartTick, buntRef.current !== null, reads.bodyType, latest.aceBatterOrder),
  }
}

/** 0x13 그리기 몫 — 결과 창 뒤 배경이거나 이번 0x13 이 아니면 없다 */
function hitPartOf(loop: StageLoop, reads: StageFrameReads, hitNow: HitInStage) {
  const { sceneTick, side } = reads
  return {
    // 큰 타구 0x13 그리기 0x4cb1c 의 꼬리(확대 · 흐리기 · 번쩍임 · 테두리 / 애니 3) — 0x13 틱으로 센다 (`bigHitScreen`)
    bigHitScreen: bigHitScreenOf(hitNow.pending.watchesBigHit, sceneTick - hitNow.startTick, side, hitNow.pending.bigHitAt, hitNow.frozenDraws),
    // 0x13 의 타구 공 — 0x33e34 가 채운 경로를 공 틱 [+0x1098] 로 (`hitBallPath`). 큰 타구는 막음이 풀린 그림부터 공 틱이 오른다
    hitBall: hitBallNow(hitNow, sceneTick),
    // 0x13 타석 카메라 — 틀 머리 0x3f060 이 공을 따라 옮긴 [+0x1ec] (`hitCamera`)
    camera: hitCameraNow(loop, hitNow, sceneTick - hitNow.startTick),
  }
}

const NO_HIT_PART = { bigHitScreen: null, hitBall: null, camera: null } as const

export function contactPartOf(loop: StageLoop, reads: StageFrameReads, hitNow: HitInStage | null) {
  const { sceneTick, isBackdrop } = reads
  return {
    // 필살 스윙 연출 그림 0x49aec — 맞은 틀(0x11)에 처음, 이어 상태 0x13('타격') 그림마다 (k = 단계 틱 + 2, `specialSwingEffect`)
    specialSwingEffect: specialSwingEffectNow(loop, sceneTick),
    // 0x49e64 꼬리 — 보통 타격 불꽃(game_effect 애니 2 · 3) · 사구 표시(player_effect 애니 14) (`batterOverlayMarks`)
    hitFlame: isBackdrop ? null : hitFlameNow(loop, sceneTick),
    hitByPitchMarkDraw: isBackdrop ? null : hitByPitchMarkNow(loop, sceneTick),
    ...(hitNow === null || isBackdrop ? NO_HIT_PART : hitPartOf(loop, reads, hitNow)),
  }
}
