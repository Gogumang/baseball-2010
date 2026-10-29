/**
 * 루상 주자 0x35b94 — 루마다 창(game_ui 22) 또는 주자 애니(defender · 마선수 ace/defender), 쉬는 대기(0xe)면 주루 칸까지.
 * 그리기 목록에 깊이 24499 로 들어간다(`DRAW_DEPTH.주자`).
 */
import { frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  BASE_WINDOW_IMAGE,
  RUNNER_FRAMES,
  RUN_PIP_IMAGE,
  aceRunnerFramesOf,
  baseRunnerDrawsOf,
  loopingAnimationStepAt,
  runPipDrawsOf,
  runnerBoxAnchorOf,
  type BaseKey,
  type BaseRunnerDraw,
} from '@/widgets/batting-stage/lib/baseRunners'
import { loadedRunnerAceOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { DRAW_EFFECT, recoloredImageOf } from '@/shared/lib/pixelEffect/pixelEffect'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import {
  RUNNER_BASE_OF_ANIMATION,
  offenseTeamIdOf,
  runnerPaletteIndexOf,
  warmRunnerRecolors,
} from '@/widgets/batting-stage/lib/renderBattingStage/runners/runnerPalette'

/** 루상 주자 한 그림의 재료 */
export interface BaseRunnerScene {
  readonly hud: HudState
  readonly side: number
  /** 주자 시계를 안 넘길 때 쓰는 그림 틱 */
  readonly tick: number
  readonly showsRunPips: boolean
  readonly runnerAnimationSteps?: readonly (number | null)[]
  readonly runnerAces?: RunnerAces
}

/** 주자 그림 하나를 그릴 때 루와 상관없이 같은 값 — 공격 팀 벌 · 실린 마선수 */
interface RunnerLook {
  readonly scene: BaseRunnerScene
  readonly paletteIndex: number | null
  readonly loadedAce: number | null
}

type WindowDraw = Extract<BaseRunnerDraw, { readonly kind: 'window' }>
type RunnerDraw = Extract<BaseRunnerDraw, { readonly kind: 'runner' }>
type RunnerStep = NonNullable<ReturnType<typeof loopingAnimationStepAt>>

export function drawBaseRunners(context: CanvasRenderingContext2D, scene: BaseRunnerScene): void {
  const { hud, side, runnerAces } = scene
  const paletteIndex = runnerPaletteIndexOf(offenseTeamIdOf(hud))
  warmRunnerRecolors(paletteIndex)
  const look = { scene, paletteIndex, loadedAce: runnerAces === undefined ? null : loadedRunnerAceOf(runnerAces, hud.bases) }
  // st[0x15 + i] — 도루를 출발한 주자의 루는 창도 주자도 안 그린다 (35c4a 가 그 루의 몸통을 통째로 건너뛴다)
  const hidden = hud.hiddenRunnerBases ?? []
  const shownBases = {
    first: hud.bases.first && !hidden.includes(1),
    second: hud.bases.second && !hidden.includes(2),
    third: hud.bases.third && !hidden.includes(3),
  }
  for (const draw of baseRunnerDrawsOf(shownBases, side)) {
    if (draw.kind === 'window') drawBaseWindow(context, draw)
    else drawRunner(context, draw, look)
  }
}

function drawBaseWindow(context: CanvasRenderingContext2D, draw: WindowDraw): void {
  const image = sprite(BASE_WINDOW_IMAGE)
  if (image === null) return
  if (!draw.isMirrored) {
    context.drawImage(image, draw.x, draw.y)
    return
  }
  // 효과 0x11 · 인자 0 — 제 상자 안에서 좌우 뒤집기
  context.save()
  context.translate(draw.x * 2 + image.width, 0)
  context.scale(-1, 1)
  context.drawImage(image, draw.x, draw.y)
  context.restore()
}

/** 마선수 주자면 실린 ace/defender 그림 폴더, 아니면 null(defender) */
function aceRunnerFolderOf(base: BaseKey | undefined, look: RunnerLook): string | null {
  const aceOfBase = base === undefined ? undefined : look.scene.runnerAces?.[base]
  return aceRunnerFramesOf(aceOfBase !== undefined && aceOfBase !== null && aceOfBase >= 0, look.loadedAce)
}

/** 이 애니의 지금 칸 — 주자 시계(`runnerAnimationSteps`)를 안 넘기면 그림 틱. 표 · 시계가 없으면 null */
function runnerStepOf(folder: string, animation: number, scene: BaseRunnerScene): RunnerStep | null {
  const entries = frameAnimations(folder)?.[animation]
  const clockStep = scene.runnerAnimationSteps === undefined ? scene.tick : scene.runnerAnimationSteps[animation]
  if (entries === undefined || clockStep === null || clockStep === undefined) return null
  return loopingAnimationStepAt(entries, clockStep)
}

function drawRunner(context: CanvasRenderingContext2D, draw: RunnerDraw, look: RunnerLook): void {
  const base = RUNNER_BASE_OF_ANIMATION[draw.animation]
  const aceFolder = aceRunnerFolderOf(base, look)
  const folder = aceFolder ?? RUNNER_FRAMES
  const step = runnerStepOf(folder, draw.animation, look.scene)
  if (step === null) return
  // 0x79da9 — 마선수 그림(+0x1c)은 팔레트 없이, defender(+0xc)는 공격 팀 팔레트(+0x10)로
  const placed = placedFrame(folder, step.frame, aceFolder === null ? look.paletteIndex : null)
  if (placed === null) return
  const x = draw.x + step.dx + placed.offsetX
  const y = draw.y + step.dy + placed.offsetY
  if (draw.isSilhouette) drawHalfShaded(context, placed.image, x, y)
  else context.drawImage(placed.image, x, y)
  if (base !== undefined) drawRunnerPips(context, base, step, placed, look.scene)
}

/** 35f4e~3604c — 같은 애니 칸의 상자(0x93e7d)를 상자 점에서 잡아 주루 칸을 잇따라 넣는다 */
function drawRunnerPips(context: CanvasRenderingContext2D, base: BaseKey, step: RunnerStep, placed: PlacedFrame, scene: BaseRunnerScene): void {
  const runAbility = scene.hud.runnerRunAbilities?.[base]
  if (!scene.showsRunPips || runAbility === undefined) return
  const anchor = runnerBoxAnchorOf(base, scene.side)
  const box = {
    x: anchor.x + step.dx + placed.offsetX,
    y: anchor.y + step.dy + placed.offsetY,
    width: placed.image.width,
    height: placed.image.height,
  }
  drawRunPips(context, runPipDrawsOf(base, box, runAbility))
}

function drawRunPips(context: CanvasRenderingContext2D, pips: ReturnType<typeof runPipDrawsOf>): void {
  const image = sprite(RUN_PIP_IMAGE)
  if (image === null) return
  for (const pip of pips) {
    if (!pip.isEmpty) context.drawImage(image, pip.x, pip.y)
    else drawGrayed(context, image, pip.x, pip.y)
  }
}

/** 효과 0xa — 그림을 픽셀마다 원본 회색 식(0x97f01)으로 바꿔 그린다 (공용 `pixelEffect`) */
function drawGrayed(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  context.drawImage(recoloredImageOf(image, DRAW_EFFECT.GRAY, 0), x, y)
}

/** 효과 0xc · 인자 0 — 픽셀마다 원본 반반 섞기(0x98351)로 채널을 반으로 (공용 `pixelEffect`) */
function drawHalfShaded(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  context.drawImage(recoloredImageOf(image, DRAW_EFFECT.HALF_MIX, 0), x, y)
}
