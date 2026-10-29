/**
 * 타석 화면 그리기 — 장면 그리기 0x52c50 이 상태 그리기 표(0x4c4bc 공용 묶음 따위)를 부르는 차례대로 한 그림을 그린다.
 * 배경(0x41230) → 그리기 목록(투수 · 타자 · 주자 · 공, 0xbe6a1) → 공용 HUD(0x4c4bc) → 큰 타구 연출 · 판정 글자 → 파티클(53050~53060).
 * 그림마다의 몫은 `renderBattingStage/` 아래 파일이 들고, 여기는 차례와 공개 이름만 둔다.
 */
import { drawParticles } from '@/widgets/particles/lib/renderParticles'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { SceneRain } from '@/entities/batting/model/settlementEffect'
import { drawHomeRunTextFrame } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import { warmStageCast } from '@/widgets/batting-stage/lib/renderBattingStage/warmCast'
import { drawStageBackdrop, stageViewOf } from '@/widgets/batting-stage/lib/renderBattingStage/stageBackdrop'
import { drawStageFigures } from '@/widgets/batting-stage/lib/renderBattingStage/stageFigures'
import { drawStageHud } from '@/widgets/batting-stage/lib/renderBattingStage/stageHud'
import { drawBigHitScreen } from '@/widgets/batting-stage/lib/renderBattingStage/screen/drawBigHitScreen'
import { drawStageResult } from '@/widgets/batting-stage/lib/renderBattingStage/result/drawResultText'
import { drawRain } from '@/widgets/batting-stage/lib/renderBattingStage/settlementRain'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

export { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
export type { StageMissionStrip, StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'
export type { StageBatterLook, StagePitcherLook, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage/warmCast'
export { stageWarmCastOf, warmStageCast } from '@/widgets/batting-stage/lib/renderBattingStage/warmCast'
export { offenseTeamIdOf, runnerRecolorFramesOf } from '@/widgets/batting-stage/lib/renderBattingStage/runners/runnerPalette'
export {
  acePitcherMirrorsOf,
  pitcherMirrorOf,
  pitcherOutfitOf,
  pitcherRecolorFramesOf,
} from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherLook'
export { showsStrikeZone, strikeZoneAnchorOf } from '@/widgets/batting-stage/lib/renderBattingStage/strikeZone'
export { StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage/drawList'

export function renderBattingStage(context: CanvasRenderingContext2D, scene: StageScene): void {
  // 결과 배경만 그리는 때(타석 사이)도 건다 — 다음 타자가 서기 전이 미리 칠할 때다
  warmStageCast(scene.warmCast)
  if (scene.isFieldPlay === true) {
    renderFieldPlayOverlay(context, scene)
    return
  }
  const view = stageViewOf(scene)
  drawStageBackdrop(context, scene, view)
  if (view.backdropOffsetY !== null) {
    // 결과 그림 0x4a384 — 배경 뒤 효과 틱 0x4a452 가 비를 그리고, 프레임 끝 0x6dd69 가 파티클(불꽃)을 그린다
    drawRainAndParticles(context, scene)
    return
  }
  drawStageFigures(context, scene, view)
  if (scene.omitsHud !== true) drawStageHud(context, scene, view)
  // 0x4cb1c 꼬리 — 공용 그림 · HUD(0x4c4bc) 다 그린 화면을 확대 · 흐리기 · 번쩍임 · 테두리 (`bigHitScreen`). 파티클(53048)은 이 위다
  if (scene.bigHitScreen !== undefined && scene.bigHitScreen !== null) drawBigHitScreen(context, scene.bigHitScreen, view.cameraShift)
  drawStageResult(context, scene, view.side)
  // 파티클은 상태 그리기가 다 끝난 뒤 — 장면 그리기 0x52c50 의 53050~53060(0x6de85 · 0x6dd69), 그 뒤 0x4e35c(기록 알림 따위)
  drawSceneParticles(context, scene.particles)
}

/**
 * 홈런더비 판(0x17)의 필드 화면 위 — 0x46c88 은 타석 그림 0x4c4bc 를 안 부르고(필드 · 야수 · 공은 밑의 필드 층), 이 캔버스에는
 * HOMERUN 글자 0x40b18(46e5c)과 프레임 끝 파티클 0x6dd69 만 남는다. 캔버스는 비워 밑의 필드가 비친다
 */
function renderFieldPlayOverlay(context: CanvasRenderingContext2D, scene: StageScene): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  if (scene.homeRunFrame !== undefined && scene.homeRunFrame !== null) drawHomeRunTextFrame(context, scene.homeRunFrame)
  drawSceneParticles(context, scene.particles)
}

/**
 * 정산 효과 층 한 장 — 판이 깐 캔버스(`SettlementEffectLayers`)를 비우고 비 또는 파티클을 그린다.
 * 비 층은 효과 틱 0x4a452 자리(진 판 덮개 위 · 띠 아래), 파티클 층은 프레임 끝 0x6dd69 자리(판 맨 위)다.
 */
export function renderSettlementLayer(
  context: CanvasRenderingContext2D,
  content: { readonly rain?: SceneRain | null; readonly particles?: ParticleScene | null },
): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  drawRainAndParticles(context, content)
}

/** 비 다음 파티클 — 없는 것은 건너뛴다 */
function drawRainAndParticles(
  context: CanvasRenderingContext2D,
  content: { readonly rain?: SceneRain | null; readonly particles?: ParticleScene | null },
): void {
  if (content.rain !== null && content.rain !== undefined) drawRain(context, content.rain)
  drawSceneParticles(context, content.particles)
}

/** 살아 있는 파티클 — 없으면 안 그린다 */
function drawSceneParticles(context: CanvasRenderingContext2D, particles: ParticleScene | null | undefined): void {
  if (particles !== null && particles !== undefined) drawParticles(context, particles)
}
