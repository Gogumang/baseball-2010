/** 판정 글자(game_judge) · HOMERUN 글자 — 0x12 그리기 0x4ce9c 의 0x39504 · 홈런 연출 0x40b18 */
import { frameAnimations, JUDGE_FRAMES, drawFrameAt } from '@/widgets/batting-stage/lib/spriteLoader'
import { judgeAnimationOf, judgeFrameAt } from '@/widgets/batting-stage/lib/stageScenery'
import { drawHomeRunBanner, drawHomeRunTextFrame } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { redrawsBetween } from '@/widgets/batting-stage/lib/stageRedraws'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** 홈런은 판정 글자(game_judge)가 없고 HOMERUN 글자 연출이 대신 나간다 (R2 3-2, 7절 표의 v = 8·12) */
export function drawStageResult(context: CanvasRenderingContext2D, scene: StageScene, side: number): void {
  if (scene.homeRunFrame !== undefined) {
    drawHeldHomeRunFrame(context, scene, scene.homeRunFrame, side)
    return
  }
  if (scene.isHomeRun) {
    drawHomeRunBanner(context, scene.homeRunTick)
    return
  }
  if (scene.resultText !== '') drawResultText(context, scene.resultText, resultDrawTickOf(scene), side)
}

/** 부르는 쪽이 모는 HOMERUN 글자 칸 — 이 그림에 글자가 없으면(null) 홈런이 아닌 판정 글자만 */
function drawHeldHomeRunFrame(context: CanvasRenderingContext2D, scene: StageScene, frame: HomeRunTextFrame | null, side: number): void {
  if (frame !== null) {
    drawHomeRunTextFrame(context, frame)
    return
  }
  if (!scene.isHomeRun && scene.resultText !== '') drawResultText(context, scene.resultText, resultDrawTickOf(scene), side)
}

/**
 * 판정 글자 애니(0x393b4 3946c — 0x12 그리기 0x4ce9c 의 0x39504)의 칸 셈 — 판정 글자가 뜬 뒤 틱에 그 사이 창 첫 그림 수를 더한다
 * (`stageRedraws`)
 */
function resultDrawTickOf(scene: StageScene): number {
  return scene.resultTick + redrawsBetween(scene.redrawTicks, scene.tick - scene.resultTick, scene.tick)
}

/**
 * 판정 글자 — game_judge 애니를 존 표 0xcfb7c[+0x17e1] 에서 잡은 원점(우타 (122,224) · 좌타 (117,224))에 재생한다
 * (0x39504 → 0x393b4). 애니가 없는 판정은 그리지 않는다 — 0x393b4 의 표 0xcfe90 은 v = 6 · 8 · 12 를 0x394d6 으로 건너뛰고
 * 원본 타석 화면에는 웹 글꼴 같은 큰 결과 글자가 없다 (F 노트 587~589). 홈런은 HOMERUN 연출(`isHomeRun`)이 대신 나간다.
 */
function drawResultText(context: CanvasRenderingContext2D, text: string, resultTick: number, side: number): void {
  const { x: centerX, y: centerY } = stageLayoutOf(side).judgeCenter
  const animation = judgeAnimationOf(text)
  if (animation === null) return
  const entries = frameAnimations(JUDGE_FRAMES)?.[animation]
  const frameIndex = entries === undefined ? null : judgeFrameAt(entries, resultTick)
  // 0x39474 0xba759(그림, 애니, 종류 2, x, y, 효과 0, …) — 애니 0 · 9 의 칸 20~29 에 든 0x67 파트는 화면에 더한다(0xc9f98 ca198)
  if (frameIndex !== null) drawFrameAt(context, JUDGE_FRAMES, frameIndex, centerX, centerY)
}
