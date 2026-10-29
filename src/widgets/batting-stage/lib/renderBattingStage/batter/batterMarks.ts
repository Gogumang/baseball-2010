/** 타자 그리기 0x49e64 곁의 그림 — 필살 스윙 그림(0x49aec) · 보통 타격 불꽃 · 사구 표시 (`batterOverlayMarks`) */
import { drawFrameAt, frameAnimations, GAME_EFFECT_FRAMES, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { specialSwingEffectFrameAt } from '@/widgets/batting-stage/lib/specialSwingEffect'
import { drawCallWithRedraws } from '@/widgets/batting-stage/lib/stageRedraws'
import { HIT_BY_PITCH_MARK_ANIMATION, HIT_BY_PITCH_MARK_OFFSET_Y, onceAnimationStepAt } from '@/widgets/batting-stage/lib/batterOverlayMarks'
import { PLAYER_EFFECT_FRAMES } from '@/widgets/batting-stage/lib/pitcherFatigue'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/**
 * 필살 그림 애니 0 의 지금 칸 (0xbe8a5 종류 2 → 0x93c45). 효과 0x11 · b 0 은 점 x 를 축으로 거울(R6 3b — x' = X − (dx + 폭))
 */
export function drawSpecialSwingPicture(context: CanvasRenderingContext2D, special: NonNullable<StageScene['specialSwingEffect']>): void {
  const entries = frameAnimations(special.folder)?.[0]
  const frameIndex = entries === undefined ? null : specialSwingEffectFrameAt(entries, special.drawCall)
  if (frameIndex === null) return
  const x = Math.round(special.x)
  const y = Math.round(special.y) + special.offsetY
  // 0xbe8a5(…, 애니 0, 효과 0 | 0x11, …) — 효과 0 이면 medica_effect · effect_power 의 0x67 파트를 화면에 더한다(0xc9f98 ca198).
  // 0x11 이면 ca074 갈래 — 파트 효과 없이 복사
  drawMirroredAt(context, x, special.isMirrored, () => {
    drawFrameAt(context, special.folder, frameIndex, x, y, { partEffects: !special.isMirrored })
  })
}

/** 보통 타격 불꽃 — game_effect 애니 2 · 3 의 지금 칸을 타격점에 (0xbe8a5 효과 0 → 0x93c45) */
export function drawHitFlame(context: CanvasRenderingContext2D, scene: StageScene): void {
  const flame = scene.hitFlame ?? null
  if (flame === null) return
  const drawCall = drawCallWithRedraws(flame.drawCall, scene.tick, scene.redrawTicks)
  const entries = frameAnimations(GAME_EFFECT_FRAMES)?.[flame.animation]
  const step = entries === undefined ? null : onceAnimationStepAt(entries, drawCall)
  // 다 돈 애니는 마지막 칸 21(그림에 없는 칸)에 서 있다 — 아무것도 안 그린다
  if (step === null || placedFrame(GAME_EFFECT_FRAMES, step.frame) === null) return
  drawFrameAt(context, GAME_EFFECT_FRAMES, step.frame, Math.round(flame.x) + step.dx, Math.round(flame.y) + step.dy)
}

/** 사구 표시 — player_effect 애니 14 의 지금 칸을 (타자 x + 좌우 이동, 타자 y − 0x51) 에 효과 0 으로 */
export function drawHitByPitchMark(context: CanvasRenderingContext2D, scene: StageScene, side: number): void {
  const tickDraw = scene.hitByPitchMarkDraw ?? null
  if (tickDraw === null) return
  const drawCall = drawCallWithRedraws(tickDraw, scene.tick, scene.redrawTicks)
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[HIT_BY_PITCH_MARK_ANIMATION]
  const step = entries === undefined ? null : onceAnimationStepAt(entries, drawCall)
  const placed = step === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, step.frame)
  if (step === null || placed === null) return
  const anchor = stageLayoutOf(side).batterAnchor
  // 49f3e r7 = 타자 앵커 x + 카메라 + 좌우 이동(+0xfe4) ± 흔들기(웹은 카메라 · 흔들기 0 — `drawBatter` 와 같다)
  context.drawImage(placed.image, anchor.x + scene.shift + step.dx + placed.offsetX, anchor.y + HIT_BY_PITCH_MARK_OFFSET_Y + step.dy + placed.offsetY)
}
