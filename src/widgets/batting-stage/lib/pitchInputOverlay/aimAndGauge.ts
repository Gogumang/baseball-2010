/** 0x10 조준(0x4d780) · 0x11 게이지(0x4d2ac) 그리기 — 선수 아래 판 · 덮개, 선수 위 애니 · 이름 · 게이지 */
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { DRAW_EFFECT, drawImageWithEffect } from '@/shared/lib/pixelEffect/pixelEffect'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { EFFECT_LEVELS, GAUGE_TARGET_FRAME, gaugeDrawsOf, type GaugeDraw } from '@/widgets/batting-stage/lib/pitchInputOverlay/gaugeDraws'
import { MAGIC_TYPE_NUMBER, SLT_FRAMES } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayAssets'
import { drawFrame } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayFrames'
import type { PitchAimOverlay, PitchGaugeOverlay, PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayTypes'
import { frameAnimations, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 선수 **아래** — 0x10 의 바로 그리는 것: 마구면 화면 덮개 단계 5, 이름 뒤 반투명 판.
 * 덮개 [0x15605d4] = 0x9b234 는 검정 덮기로 화면을 **단계/16 남긴다**(CORRECTIONS 3절 — 색 덮기 [0x15605d0] = 0x9b3f4 의
 * (단계 + 1)/16 과 다른 몸통) → 단계 5 는 화면 5/16 · 검정 11/16.
 */
export function drawPitchInputUnderlay(context: CanvasRenderingContext2D, overlay: PitchInputOverlay | null, side: number): void {
  if (overlay === null || overlay.kind !== '조준') return
  if (overlay.typeNumber === MAGIC_TYPE_NUMBER) {
    context.fillStyle = `rgba(0, 0, 0, ${1 - 5 / 16})`
    context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    return
  }
  const label = aimLabelPlacement(overlay.typeNumber, side)
  if (label === null) return
  context.fillStyle = `rgba(0, 0, 0, ${0x28 / 0xff})`
  context.fillRect(label.x - 5, label.y6 - 5, label.width + 10, label.height + 2)
}

function aimLabelPlacement(typeNumber: number, side: number): { x: number; y6: number; width: number; height: number } | null {
  if (typeNumber < 1 || typeNumber > 21) return null
  const placed = placedFrame(SLT_FRAMES, typeNumber - 1)
  if (placed === null) return null
  const { zoneLeft, zoneTop } = stageLayoutOf(side)
  const width = placed.image.width
  const height = placed.image.height
  return { x: zoneLeft + ((33 - width) >> 1), y6: zoneTop - height, width, height }
}

/** 선수 **위** — 0x10 의 애니 0 · 이름, 0x11 의 프레임 35 · 게이지 */
export function drawPitchInputSprites(context: CanvasRenderingContext2D, overlay: PitchInputOverlay | null, side: number): void {
  if (overlay === null || overlay.kind === '구질') return
  const point = projectToScreen(overlay.aim, overlay.aimSide)
  if (overlay.kind === '조준') drawAimSprites(context, overlay, side, point)
  else drawGaugeSprites(context, overlay, point)
}

type ScreenPoint = { readonly x: number; readonly y: number }

/** 0x10 — 애니 0 을 조준점에, 이름 프레임을 존 위에 */
function drawAimSprites(context: CanvasRenderingContext2D, overlay: PitchAimOverlay, side: number, point: ScreenPoint): void {
  const entries = frameAnimations(SLT_FRAMES)?.[0]
  const step = entries === undefined ? null : animationStepAt(entries, overlay.tick)
  if (step !== null) drawFrame(context, SLT_FRAMES, step.frame, point.x, point.y)
  const label = aimLabelPlacement(overlay.typeNumber, side)
  if (label !== null) drawFrame(context, SLT_FRAMES, overlay.typeNumber - 1, label.x, label.y6 - 4)
}

/** 0x11 — 목표 표시 프레임 0x23, 게이지가 켜졌으면 게이지 그림 목록 */
function drawGaugeSprites(context: CanvasRenderingContext2D, overlay: PitchGaugeOverlay, point: ScreenPoint): void {
  if (overlay.showsTargetFrame ?? !overlay.gaugeSettingOn) drawFrame(context, SLT_FRAMES, GAUGE_TARGET_FRAME, point.x, point.y)
  if (!overlay.showsGauge) return
  for (const draw of gaugeDrawsOf(overlay)) drawGaugeItem(context, draw, point)
}

function drawGaugeItem(context: CanvasRenderingContext2D, draw: GaugeDraw, point: ScreenPoint): void {
  if (draw.alpha === undefined) {
    drawFrame(context, draw.folder, draw.frame, point.x, point.y + draw.dy)
    return
  }
  // 효과 1 · 단계 L — 화면 칸을 읽어 원본 표 0xd5e58 · 0xd5de0 식으로 섞는다(공용 `drawImageWithEffect`)
  const placed = placedFrame(draw.folder, draw.frame)
  if (placed === null) return
  drawImageWithEffect(
    context,
    placed.image,
    Math.round(point.x) + placed.offsetX,
    Math.round(point.y + draw.dy) + placed.offsetY,
    DRAW_EFFECT.TRANSLUCENT,
    Math.round(draw.alpha * EFFECT_LEVELS),
  )
}
