/** 마투수 덧그림 — effect_pitcher(0x38d1c 꼬리 39258) · 0x46fa8 의 마투수 마법(붕붕머신 · 발렌타인 · 레오니 · 싸이커 · 드래고나) */
import { drawFrameAt, frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  ACE_EFFECT_BLEND_WEIGHT,
  EFFECT_PITCHER_FRAMES,
  aceMagicAnimationDrawOf,
  aceMagicScaledDrawOf,
  leonyEffectDrawsOf,
  LEONY_EFFECT_FRAMES,
  aceMagicScaledOriginOf,
  effectPitcherFrameAt,
  type AcePitcherEffectInput,
} from '@/widgets/batting-stage/lib/acePitcherEffect'
import { drawImageScaledBlend } from '@/shared/lib/pixelEffect/pixelEffect'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage/drawList'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** 마투수 이펙트 재료 — 0x11 그림 수는 0x11 진입 뒤 그림 수가 그 마지막 갱신 틱을 넘지 않을 때만(0x12 · 0x13 은 0x11 이 아니다) */
export function acePitcherEffectInputOf(scene: StageScene): AcePitcherEffectInput {
  const tick = scene.pitcherTick
  const end = scene.pitcherTickEnd ?? null
  return {
    aceOrder: scene.acePitcher?.order ?? null,
    pitch: scene.pitch,
    pitchStateDraw: tick !== null && tick >= 0 && (end === null || tick <= end) ? tick : null,
  }
}

/** effect_pitcher 애니 0 — 투수 앵커(뒤집기 · 좌투 +1 없음, 0x391c4) */
export function drawEffectPitcher(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number): void {
  const entries = frameAnimations(EFFECT_PITCHER_FRAMES)?.[0]
  if (entries === undefined) return
  const frame = effectPitcherFrameAt(input, entries)
  const placed = frame === null ? null : placedFrame(EFFECT_PITCHER_FRAMES, frame)
  if (placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  context.drawImage(placed.image, anchor.x + placed.offsetX, anchor.y + placed.offsetY)
}

/** 0x47250 붕붕머신 · 발렌타인 애니 0 — 투수 앵커 */
export function drawAceMagicAnimation(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number): void {
  const draw = aceMagicAnimationDrawOf(input, (folder) => frameAnimations(folder)?.[0] ?? null)
  const placed = draw === null ? null : placedFrame(draw.framesFolder, draw.frame)
  if (placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  context.drawImage(placed.image, anchor.x + placed.offsetX, anchor.y + placed.offsetY)
}

/** 0x4703a 레오니 — 고친 길(B-82)의 0xbe8d5 몫을 투수 앵커 기준으로 목록에 넣는다 */
export function addLeonyEffectDraws(
  context: CanvasRenderingContext2D,
  drawList: StageDrawList,
  input: AcePitcherEffectInput,
  side: number,
  pose: number,
): void {
  const boxOf = (frame: number) => {
    const placed = placedFrame(LEONY_EFFECT_FRAMES, frame)
    return placed === null ? null : { width: placed.image.width, height: placed.image.height }
  }
  const anchor = stageLayoutOf(side).pitcherAnchor
  for (const draw of leonyEffectDrawsOf(input, pose, boxOf)) {
    drawList.add(draw.depth, () => drawFrameAt(context, LEONY_EFFECT_FRAMES, draw.frame, anchor.x + draw.dx, anchor.y + draw.dy))
  }
}

/** 0x472ba · 0x47368 — 그림 0번 이미지를 s 배로 키워 투수 앵커 가운데에 반반 섞기 (0xbb91d 종류 0x12) */
export function drawAceMagicScaled(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number, pose: number): void {
  const draw = aceMagicScaledDrawOf(input, pose)
  const image = draw === null ? null : sprite(draw.imageUrl)
  if (draw === null || image === null) return
  const origin = aceMagicScaledOriginOf(stageLayoutOf(side).pitcherAnchor, draw.scale, image.width, image.height)
  drawImageScaledBlend(context, image, origin.x, origin.y, draw.scale * 10, ACE_EFFECT_BLEND_WEIGHT)
}
