/** 투수 그리기 0x38d1c 의 홈런 갈래(0x3908a) — 애니 12(평범한 투수) · 13 "!"(감상 플래그)를 투수 점에 */
import { frameAnimations, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { judgeFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import {
  HOME_RUN_PITCHER_ANIMATION,
  MISTAKE_MARK_ANIMATION,
  MISTAKE_MARK_OFFSET_Y,
  PLAYER_EFFECT_FRAMES,
  pitcherFatigueFrameAt,
  pitcherHomeRunMarksOf,
} from '@/widgets/batting-stage/lib/pitcherFatigue'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'
import { pitcherMirrorOf } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherLook'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** 창 첫 그림 자리를 투수 틱 격자로 — 이 그림(투수 틱 `pitcherTick`)까지 든 것만 */
function pitcherRedrawTicksOf(scene: StageScene, pitcherTick: number): readonly number[] {
  const offset = scene.tick - pitcherTick
  return (scene.redrawTicks ?? []).filter((at) => at <= scene.tick).map((at) => at - offset)
}

/** 이 그림의 홈런 갈래 판정 — 투수를 안 그리는 상태(null)면 null */
function homeRunMarksOf(scene: StageScene, animation: PitcherAnimation): ReturnType<typeof pitcherHomeRunMarksOf> {
  const mark = scene.pitcherHitMark ?? null
  if (mark === null || scene.pitcherTick === null) return null
  return pitcherHomeRunMarksOf({
    ...mark,
    pitcherTick: scene.pitcherTick,
    step: animation.step,
    aceOrder: scene.acePitcher?.order ?? null,
    // 창 첫 그림의 투수 틱 — 그 그림도 홈런 갈래(39084 · 3925e 의 0x93d91)를 돈다(`stageRedraws`)
    redrawPitcherTicks: pitcherRedrawTicksOf(scene, scene.pitcherTick),
  })
}

/** 투수 점(좌투면 + 1)과 거울 — 390d4 · 39136 좌투(0xb63c1)면 효과 0x11 로 그 점을 축으로 뒤집는다 */
interface MarkPlace {
  readonly anchor: { readonly x: number; readonly y: number }
  readonly axisX: number
  readonly isMirrored: boolean
}

/** 홈런 갈래(0x3908a)를 `pitcherHomeRunMarksOf` 로 보고 애니 12(평범한 투수) · 13 "!"(감상 플래그)를 그린다 */
export function drawPitcherHomeRunMarks(context: CanvasRenderingContext2D, scene: StageScene, side: number, animation: PitcherAnimation): void {
  const marks = homeRunMarksOf(scene, animation)
  if (marks === null) return
  const animations = frameAnimations(PLAYER_EFFECT_FRAMES)
  if (animations === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  const place = { anchor, ...pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0) }
  if (marks.showsPitcherAnimation) drawHomeRunPitcherAnimation(context, place, animations[HOME_RUN_PITCHER_ANIMATION], marks.drawCall)
  if (marks.showsBang) drawHomeRunBang(context, place, animations[MISTAKE_MARK_ANIMATION], marks.drawCall)
}

/** 애니 12 — 평범한 투수의 홈런 덧그림 */
function drawHomeRunPitcherAnimation(
  context: CanvasRenderingContext2D,
  place: MarkPlace,
  entries: readonly StageAnimationEntry[] | undefined,
  drawCall: number,
): void {
  const frameIndex = entries === undefined ? null : judgeFrameAt(entries, drawCall)
  if (frameIndex !== null) drawMark(context, place, frameIndex, 0, 0)
}

/** 애니 13 "!" — 감상 플래그가 선 타구 */
function drawHomeRunBang(
  context: CanvasRenderingContext2D,
  place: MarkPlace,
  entries: readonly StageAnimationEntry[] | undefined,
  drawCall: number,
): void {
  const step = entries === undefined ? null : pitcherFatigueFrameAt(entries, drawCall)
  if (step !== null) drawMark(context, place, step.frame, step.dx, MISTAKE_MARK_OFFSET_Y + step.dy)
}

function drawMark(context: CanvasRenderingContext2D, place: MarkPlace, frameIndex: number, dx: number, dy: number): void {
  const placed = placedFrame(PLAYER_EFFECT_FRAMES, frameIndex)
  if (placed === null) return
  drawMirroredAt(context, place.axisX, place.isMirrored, () => {
    context.drawImage(placed.image, place.axisX + dx + placed.offsetX, place.anchor.y + dy + placed.offsetY)
  })
}
