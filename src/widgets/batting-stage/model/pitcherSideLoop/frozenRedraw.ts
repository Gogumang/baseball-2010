/**
 * 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신을, 52efe 가 상태 그리기를 건너뛴다 — 시계도 선다.
 * 창이 선 첫 그림([창+0x250])은 갱신 없이 그리기 표를 한 번 더 돈다(타자편 `useStageAnimation` 과 같다 — r175 · r178):
 * 0x13 그리기 0x4cb1c 의 큰 타구 셈 [+0x10a8](멈춤 갈래면 한 번 더 줄고 옛값이 음수면 016 · 뒤 갈래면 애니 3 한 칸), 그리기에서
 * 0x93d91 로 넘기는 애니(투수 덧그림 · 필살 스윙 그림 · 판정 글자 · 램프 확대 · 하늘 조명 · 주자 — `stageRedraws`), 스킬 판 0x4b5b4,
 * 전광판 글자 [구장+0x8c](`sceneScoreboardTickOf` 가 멈춤 횟수로 센다). 파티클 틱 · 그리기(53048)는 건너뛴다
 */
import { gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'
import { renderBattingStage } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { BIG_HIT_PARTICLE } from '@/widgets/batting-stage/lib/hitParticles'
import { bigHitScreenOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { withRedrawAt } from '@/widgets/batting-stage/lib/stageRedraws'
import { platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { sceneScoreboardTickOf } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'

/** 창이 서 있는 틀 — 창이 선 첫 그림만 마지막 그림 입력을 고쳐 한 번 다시 그린다 */
export function redrawFrozenFrame(loop: PitcherSideLoop, rawNow: number): void {
  const frozenScene = loop.lastStageScene
  if (!loop.frozenDrawGate.allowsDraw() || frozenScene === null) return
  const bigHitScreen = frozenBigHitScreenOf(loop, frozenScene)
  loop.redrawTicks = withRedrawAt(loop.redrawTicks, frozenScene.tick)
  const redrawn: StageScene = {
    ...frozenScene,
    bigHitScreen,
    scenery: { ...frozenScene.scenery, scoreboardTick: sceneScoreboardTickOf(gameSceneTickOf(gameSceneTimeOf(rawNow))) },
    redrawTicks: loop.redrawTicks,
    skillPanel: frozenSkillPanelOf(loop, frozenScene),
  }
  loop.drawMemo.needsDraw(loop.canvasRef.current, redrawn)
  renderBattingStage(loop.context, redrawn)
  loop.lastStageScene = redrawn
}

/** 큰 타구 0x13 을 그리는 중인가 — 이 장면이 날린 공의 아직 안 끝난 0x13 */
function isDrawingBigHit(loop: PitcherSideLoop, frozenScene: StageScene): boolean {
  const hit = loop.marks.hit
  if (frozenScene.stagePhase?.kind !== '타격' || hit === null || !hit.watchesBigHit) return false
  return !loop.marks.endNotified && loop.releaseTick !== null && loop.shownPitch !== null
}

/** 0x13 이면 그 그림도 0x4cb1c 를 돈다 — 마지막 갱신 0x13 틱 + 1 자리의 그림으로 센다(`bigHitScreenOf` 머리말) */
function frozenBigHitScreenOf(loop: PitcherSideLoop, frozenScene: StageScene): StageScene['bigHitScreen'] {
  const phase = frozenScene.stagePhase
  const pitch = loop.shownPitch
  if (!isDrawingBigHit(loop, frozenScene) || phase === undefined || pitch === null) return frozenScene.bigHitScreen
  const lastHeld = phase.tick
  const contact = platePixelOf(pitch)
  const screen = bigHitScreenOf(true, lastHeld + 1, frozenScene.side ?? 0, contact, loop.marks.frozenDraws)
  // 4ccba — 옛값이 음수면 이 그림이 막음을 풀고 016 을 쏜다(파티클 틱 53048 은 건너뛴다)
  if (screen?.kind === '멈춤' && screen.counter < 0) loop.emitParticle(BIG_HIT_PARTICLE.id, contact.x, contact.y, BIG_HIT_PARTICLE.img)
  loop.marks.frozenDraws = [...loop.marks.frozenDraws, lastHeld]
  return screen
}

/** 0x4c4bc 4cad4 → 0x4b5b4 — 판을 그리던 상태면 한 번 더 돈다(마지막으로 센 틱은 그대로) */
function frozenSkillPanelOf(loop: PitcherSideLoop, frozenScene: StageScene): StageScene['skillPanel'] {
  const last = loop.lastSkillPanelFrame
  if (last === null || frozenScene.skillPanel === null || frozenScene.skillPanel === undefined) return frozenScene.skillPanel
  return loop.stepSkillPanel({ ...last, extraDraw: true })
}
