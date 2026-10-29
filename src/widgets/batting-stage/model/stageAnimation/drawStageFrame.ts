/**
 * 이 틀의 그림 — 위까지가 이 틀의 상태 갱신이다(틱 · 굴림은 틀마다 그대로). 그림은 입력이 앞 틀과 같으면 캔버스에 남은 그림이 곧 이 틀의
 * 그림이라 건너뛴다(`createDrawMemo`) — 파티클 관리자 · 비는 제자리에서 고쳐 쓰므로 그 모습(`particleSignatureOf` · 틱)으로 견준다.
 * 창이 닫힌 앱 틱 동안은 장면 틱이 창 첫 그림의 틱 그대로다 — 원본은 그 틱을 다시 그리지 않는다(창이 닫힌 틀은 갱신이 없고 다음
 * 틀이 다음 틱을 그린다). 창 첫 그림을 그대로 둔다
 */
import type { SceneRain } from '@/entities/batting/model/settlementEffect'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { renderBattingStage, renderSettlementLayer, type StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import type { ParticleFrame } from '@/widgets/batting-stage/model/stageAnimation/particleSteps'

export function drawStageFrame(
  loop: StageLoop,
  stageScene: StageScene,
  frame: { readonly sceneTick: number; readonly particles: ParticleFrame; readonly settlementRain: SceneRain | null },
): void {
  const { particles, settlementRain } = frame
  // 정산 효과 층 — 비는 효과 틱 0x4a452 자리(진 판 덮개 위 · 띠 아래), 파티클은 프레임 끝 0x6dd69 자리(판 맨 위)
  const layers = particles.settlement?.layers
  const isRedrawnTick = loop.redrawTicks.at(-1) === frame.sceneTick
  const shouldDraw = !isRedrawnTick && loop.drawMemo.needsDraw(loop.canvas, drawInputOf(loop, stageScene, layers, particles.isParticleGated))
  if (shouldDraw) renderBattingStage(loop.context, stageScene)
  if (!isRedrawnTick) loop.lastStageScene = stageScene
  if (shouldDraw && layers !== undefined) drawSettlementLayers(loop, layers, particles.isParticleGated, settlementRain)
}

function drawSettlementLayers(loop: StageLoop, layers: SettlementEffectLayers, isParticleGated: boolean, settlementRain: SceneRain | null): void {
  const rainContext = layers.rain.current?.getContext('2d') ?? null
  if (rainContext !== null) renderSettlementLayer(rainContext, { rain: settlementRain })
  const particleContext = effectContextOf(layers.particles.current)
  if (particleContext !== null) renderSettlementLayer(particleContext, { particles: isParticleGated ? null : loop.refs.particlesRef.current })
}

/** 앞 틀과 견줄 그림 입력 — 장면 · 효과 층 파티클 모습 · 층 캔버스와 크기 */
function drawInputOf(loop: StageLoop, stageScene: StageScene, layers: SettlementEffectLayers | undefined, isParticleGated: boolean) {
  const { signatureOf } = loop.particleKit
  const rainLayer = layers?.rain.current ?? null
  const particleLayer = layers?.particles.current ?? null
  return {
    scene: { ...stageScene, particles: signatureOf(stageScene.particles) },
    layerParticles: layers === undefined || isParticleGated ? null : signatureOf(loop.refs.particlesRef.current),
    rainLayer,
    rainLayerSize: canvasSizeOf(rainLayer),
    particleLayer,
    particleLayerSize: canvasSizeOf(particleLayer),
  }
}

function canvasSizeOf(canvas: HTMLCanvasElement | null): readonly [number, number] | null {
  return canvas === null ? null : [canvas.width, canvas.height]
}
