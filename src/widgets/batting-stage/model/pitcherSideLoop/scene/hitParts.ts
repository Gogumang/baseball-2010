/** 그림 입력의 맞은 공 몫 — 투수 홈런 갈래 · 큰 타구 꼬리 · 타구 공 · 카메라 · 타격 불꽃 · 사구 표시 · 필살 스윙 그림 */
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitcherHitContactOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { hitByPitchMarkDrawCallOf, hitFlameAnimationOf } from '@/widgets/batting-stage/lib/batterOverlayMarks'
import { bigHitReleaseTickOf, bigHitScreenOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { hitBallTickOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { hitCameraAt } from '@/widgets/batting-stage/lib/hitCamera'
import { platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

type HitParts = Pick<StageScene, 'pitcherHitMark' | 'bigHitScreen' | 'hitBall' | 'camera' | 'hitFlame' | 'hitByPitchMarkDraw' | 'specialSwingEffect'>

/** 맞은 공의 0x13 그림 — 0x13 틱 · 큰 타구가 풀린 0x13 틱(이 틱 앞의 창 첫 그림으로 센다) */
interface HitDraw {
  readonly base: PitcherHitScene
  readonly tick: number
  readonly releaseTick: number | null
}

export function hitSceneParts(loop: PitcherSideLoop, frame: PitcherSideFrame): HitParts {
  const { hitBase } = frame
  /** 이 공의 판정 틀 J 의 0x11 상태 틱(= 투수 틱) — 맞은 공이 아니면 null */
  const judgePitcherTick = hitBase === null ? null : pitcherReleaseTicksOf(frame.aceOrder) + hitBase.judgeBallTick
  const drawCall = judgeDrawCallOf(frame, judgePitcherTick)
  const contactPoint = hitBase === null || frame.pitch === null ? null : platePixelOf(frame.pitch)
  const hitDraw = hitDrawOf(loop, frame)
  const effect = loop.marks.specialEffect
  return {
    pitcherHitMark: pitcherHitMarkOf(frame, judgePitcherTick),
    // 큰 타구 0x13 그리기 0x4cb1c 의 꼬리(확대 · 흐리기 · 번쩍임 · 테두리 / 애니 3) — 0x13 틱으로 센다(`bigHitScreen`, 타자편과 같다)
    bigHitScreen:
      hitDraw === null ? null : bigHitScreenOf(hitDraw.base.watchesBigHit, hitDraw.tick, frame.side, contactPoint, loop.marks.frozenDraws),
    hitBall: hitBallOf(hitDraw),
    camera: hitCameraOf(hitDraw, frame.side),
    hitFlame: hitFlameOf(frame, contactPoint, drawCall),
    hitByPitchMarkDraw: hitByPitchMarkDrawOf(frame),
    // 필살 스윙 연출 그림 0x49aec — 판정 틀 J(0x11)에 첫 부름, 이어 0x13 틱 d 의 그림이 d + 2 번째 부름 (`specialSwingEffect`)
    specialSwingEffect: effect === null || drawCall === null ? null : { ...effect, drawCall },
  }
}

/**
 * 투수 그리기 0x38d1c 의 홈런 갈래(0x3908a — 애니 12 · 감상 플래그면 "!" 13)가 결과 코드 [경기+0xfd4] 를 본다. 0x11 진입(3deea)이
 * 0 으로 지우고 판정 0x6aa 가 그 틀에 쓴다 — 투수를 그리는 0x11 · 0x12 · 0x13 에서 (타자편 `useStageAnimation` 과 같은 재료)
 */
function pitcherHitMarkOf(frame: PitcherSideFrame, judgePitcherTick: number | null): StageScene['pitcherHitMark'] {
  const { hitBase } = frame
  if (frame.stage.phase.kind === '대기') return null
  return {
    codeBeforePitch: 0,
    judgedTick: judgePitcherTick,
    judgedCode: hitBase === null ? null : hitBase.resultCode,
    isBigHit: hitBase?.watchesBigHit ?? false,
  }
}

/** 보통 타격 불꽃 0x49e64 49faa~4a0a2 — 필살 그림 갈래가 아니고 큰 타구가 아닌 맞은 공. 필살 그림과 같은 부름 차례 (`batterOverlayMarks`) */
function hitFlameOf(
  frame: PitcherSideFrame,
  contactPoint: { readonly x: number; readonly y: number } | null,
  drawCall: number | null,
): StageScene['hitFlame'] {
  const animation = hitFlameAnimationNowOf(frame)
  if (animation === null || contactPoint === null || drawCall === null) return null
  return { animation, x: contactPoint.x, y: contactPoint.y, drawCall }
}

/** 사구 표시 0x49e64 4a0ce — 사구 0x12 의 틱 0~7 (`batterOverlayMarks`) */
function hitByPitchMarkDrawOf(frame: PitcherSideFrame): StageScene['hitByPitchMarkDraw'] {
  const { phase } = frame.stage
  return phase.kind === '결과' && frame.resolution?.kind === '사구' ? hitByPitchMarkDrawCallOf(phase.tick) : null
}

/** 판정 틀 · 0x13 그림의 0x49aec · 0x49e64 부름 차례 — 판정 틀 J 가 1, 0x13 틱 d 가 d + 2. 그 밖은 null */
function judgeDrawCallOf(frame: PitcherSideFrame, judgePitcherTick: number | null): number | null {
  const { phase } = frame.stage
  if (phase.kind === '타격') return phase.tick + 2
  return phase.kind === '투구중' && judgePitcherTick !== null && phase.tick === judgePitcherTick ? 1 : null
}

/** 0x13 그림이면 그 틱 — 아니면 null */
function hitDrawOf(loop: PitcherSideLoop, frame: PitcherSideFrame): HitDraw | null {
  const { hitBase, stage } = frame
  if (stage.phase.kind !== '타격' || hitBase === null) return null
  const tick = stage.phase.tick
  const releaseTick = hitBase.watchesBigHit ? bigHitReleaseTickOf(loop.marks.frozenDraws.filter((at) => at < tick)) : null
  return { base: hitBase, tick, releaseTick }
}

/** 0x13 의 타구 공 — 0x33e34 가 채운 경로를 공 틱 [+0x1098] 로 (`hitBallPath` — 타자편과 같다) */
function hitBallOf(hitDraw: HitDraw | null): StageScene['hitBall'] {
  const path = hitDraw?.base.hitPath ?? null
  if (hitDraw === null || path === null) return null
  return { path, ballTick: hitBallTickOf(hitDraw.tick, hitDraw.releaseTick), showsTrail: hitDraw.base.showsHitTrail === true }
}

/** 0x13 타석 카메라 — 틀 머리 0x3f060 이 공을 따라 옮긴 [+0x1ec] (`hitCamera` — 타자편과 같다) */
function hitCameraOf(hitDraw: HitDraw | null, side: number): StageScene['camera'] {
  const path = hitDraw?.base.hitPath ?? null
  const angle = hitDraw?.base.hitAngle
  if (hitDraw === null || path === null || angle === undefined) return null
  return hitCameraAt({ path, side, angle, releaseTick: hitDraw.releaseTick }, hitDraw.tick)
}

/** 보통 타격 불꽃의 game_effect 애니 — 번트 자세(49faa S+8) · 필살 그림 갈래(0x49aec 가 [sp+0x57] 을 세운다) · 큰 타구면 null */
function hitFlameAnimationNowOf(frame: PitcherSideFrame): ReturnType<typeof hitFlameAnimationOf> | null {
  const { hitBase, current } = frame
  if (hitBase === null || hitBase.isBuntStance === true) return null
  if (pitcherHitContactOf(hitBase, current.batterForm, current.aceBatterOrder ?? null, frame.side).effect !== null) return null
  return hitFlameAnimationOf(hitBase.particleId, hitBase.watchesBigHit)
}
