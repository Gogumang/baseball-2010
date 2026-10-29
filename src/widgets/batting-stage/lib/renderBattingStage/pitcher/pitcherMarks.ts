/** 투수 그리기 0x38d1c 의 덧그림 — 실투 "!"(38ee0) · 체력 그림(38f42) · 투구 바람 줄(0x38dc6) (player_effect) */
import { frameAnimations, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { judgeFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { drawCallWithRedraws } from '@/widgets/batting-stage/lib/stageRedraws'
import {
  MISTAKE_MARK_ANIMATION,
  MISTAKE_MARK_OFFSET_Y,
  PLAYER_EFFECT_FRAMES,
  pitcherFatigueAnimationOf,
  pitcherFatigueFrameAt,
  pitchWindDrawCallOf,
  PITCH_WIND_ANIMATION,
  PITCH_WIND_OFFSET_X,
  showsPitcherFatigue,
  showsPitcherMistakeMark,
} from '@/widgets/batting-stage/lib/pitcherFatigue'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'
import { pitcherMirrorOf } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherLook'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** player_effect 애니 하나의 지금 칸(돌림 애니 `pitcherFatigueFrameAt`)과 그 그림 — 표 · 그림이 아직이면 null */
function playerEffectStepOf(
  animation: number,
  drawCall: number,
): { readonly step: { frame: number; dx: number; dy: number }; readonly placed: PlacedFrame } | null {
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[animation]
  const step = entries === undefined ? null : pitcherFatigueFrameAt(entries, drawCall)
  const placed = step === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, step.frame)
  if (step === null || placed === null) return null
  return { step, placed }
}

export function drawPitcherMistakeMark(context: CanvasRenderingContext2D, scene: StageScene, side: number): void {
  // 38ef6 — 남은 수 +8 을 그림마다 1 준다 · 38f3c 애니 13 한 칸: 창 첫 그림도 센다(`stageRedraws`)
  const tickDraw = scene.pitcherMistakeMarkDraw ?? null
  const drawCall = tickDraw === null ? null : drawCallWithRedraws(tickDraw, scene.tick, scene.redrawTicks)
  if (!showsPitcherMistakeMark(scene.scenery.gameMode, drawCall) || drawCall === null) return
  const effect = playerEffectStepOf(MISTAKE_MARK_ANIMATION, drawCall)
  if (effect === null) return
  const { step, placed } = effect
  // 38f24 x = 투수 x(좌투면 + 1) · 38f22 y = 투수 y − 0x34 · 효과 0 — 좌투도 안 뒤집는다
  const anchor = stageLayoutOf(side).pitcherAnchor
  const { axisX } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  context.drawImage(placed.image, axisX + step.dx + placed.offsetX, anchor.y + MISTAKE_MARK_OFFSET_Y + step.dy + placed.offsetY)
}

/** 이 그림에 그릴 체력 애니(9 · 10) — 체력을 모르거나 안 그리는 장면이면 null */
function fatigueAnimationOf(scene: StageScene, pitcherAnimation: PitcherAnimation): number | null {
  const stamina = scene.pitcherStaminaPercent
  if (stamina === null || stamina === undefined) return null
  const shows = showsPitcherFatigue({
    gameMode: scene.scenery.gameMode,
    isAcePitcher: scene.acePitcher !== null,
    // 38f42 — 투구 객체 +0x14 == 0(선 자세)일 때만. 투구 뒤 마지막 자세(상태 1) · 대기 동작(상태 2)에는 안 그린다
    isThrowing: pitcherAnimation.state !== 0,
  })
  const animation = pitcherFatigueAnimationOf(stamina)
  return shows ? animation : null
}

export function drawPitcherFatigue(context: CanvasRenderingContext2D, scene: StageScene, side: number, pitcherAnimation: PitcherAnimation): void {
  const animation = fatigueAnimationOf(scene, pitcherAnimation)
  if (animation === null) return
  // 체력 애니 9 · 10 은 0xf 진입이 되감은 뒤 그림마다 한 칸 — 창 첫 그림도 센다(`stageRedraws`)
  const fatigueDraw = drawCallWithRedraws((scene.stagePhase?.tick ?? scene.tick) + 1, scene.tick, scene.redrawTicks)
  const effect = playerEffectStepOf(animation, fatigueDraw)
  if (effect === null) return
  const { step, placed } = effect
  const anchor = stageLayoutOf(side).pitcherAnchor
  const { axisX, isMirrored } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  drawMirroredAt(context, axisX, isMirrored, () => {
    context.drawImage(placed.image, axisX + step.dx + placed.offsetX, anchor.y + step.dy + placed.offsetY)
  })
}

/** 바람 줄 애니 11 의 이번 그림 칸 — 안 그리는 그림이면 null */
function pitchWindFrameOf(scene: StageScene, animation: PitcherAnimation): number | null {
  const tickDraw = pitchWindDrawCallOf({
    state: animation.state,
    step: animation.step,
    pitcherTick: scene.pitcherTick,
    aceOrder: scene.acePitcher?.order ?? null,
  })
  if (tickDraw === null) return null
  // 38e5a 애니 11 은 그림마다 한 칸 — 창 첫 그림도 센다(`stageRedraws`)
  const drawCall = drawCallWithRedraws(tickDraw, scene.tick, scene.redrawTicks)
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[PITCH_WIND_ANIMATION]
  return entries === undefined ? null : judgeFrameAt(entries, drawCall)
}

/** 투구 바람 줄(0x38dc6~0x38e5e)을 `pitchWindDrawCallOf` 로 보고 player_effect 애니 11 을 투수 점 옆 8 에 그린다 */
export function drawPitchWind(context: CanvasRenderingContext2D, scene: StageScene, side: number, animation: PitcherAnimation): void {
  const frameIndex = pitchWindFrameOf(scene, animation)
  const anchor = stageLayoutOf(side).pitcherAnchor
  // 38df0 — 좌투면 x − 8 · 효과 0x11: 투수 점(좌투 + 1)을 축으로 한 거울 안에서 x + 8
  const { axisX, isMirrored } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  // 효과 0x11 이면 0xc9f98 ca07c 갈래 — 칸 40 · 41 의 0x66 반투명 파트를 섞지 않고 복사한다(복사판)
  const placed = frameIndex === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, frameIndex, null, isMirrored)
  if (placed === null) return
  drawMirroredAt(context, axisX, isMirrored, () => {
    context.drawImage(placed.image, axisX + PITCH_WIND_OFFSET_X + placed.offsetX, anchor.y + placed.offsetY)
  })
}
