/**
 * 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신(장면 틱 · 키 · 갱신 표)을, 52efe 가 상태 그리기를,
 * 53048 이 파티클 틱 · 그리기를 건너뛴다. 창이 선 첫 그림([창+0x250])은 장면을 한 번 더 그리지만 갱신이 없어 앞 그림과 같은
 * 모습이라, 웹은 그 그림부터 캔버스를 그대로 둔다(굳은 화면). 시계도 서 있다가 창이 닫히면 이어 흐른다 — 따라잡지 않는다.
 * [+0x250] 그림은 갱신 없이 그리기만 한 번 돈다 — 배경 0x41230 이 전광판 글자 자리 [구장+0x8c] 를 한 번 더 줄이고(r170 — 그 셈은
 * `sceneScoreboardTickOf` 가 멈춤 횟수로 센다), 53048 이 파티클 그리기를 건너뛰어 그 그림엔 파티클이 없다. 웹은 마지막 그림 입력에
 * 전광판 셈과 0x13 그리기 0x4cb1c 의 큰 타구 셈 [+0x10a8] · 애니 3 칸(`bigHitReleaseTickOf` — 막음을 푼 그림이면 016 도)만 고쳐
 * 한 번 다시 그린다(r175). 다른 상태의 그리기 쪽 셈은 그 부품이 센다 — 0x10 조준 애니 0 칸(`AimCursor`) · 0x11 커서 0x4d708 /
 * 결과 원 0x4d700(`PitchGradeGauge`) · 점수판 0x36714 목표 줄(`MissionHud`) · 더비 콤보 [+0x19ec](`useHomeRunDerby`).
 * 그리기에서 0x93d91 로 넘기는 애니(r178 — `stageRedraws`): 루상 주자 0x35b94(35c62) 는 주자 시계를 한 번 더 돌리고, 투수 덧그림
 * 0x38d1c(바람 줄 · 실투 "!" · 체력 · 홈런 갈래) · 필살 스윙 그림 0x49aec · 판정 글자 0x393b4 · 램프 확대(0x373d0 안 갈래 0x37828) · 하늘 조명 0x78490
 * 은 이 그림의 틱을 `redrawTicks` 에 실어 그리기가 센다. 경기 스킬 표시 판 0x4b5b4 도 한 번 더 돈다. 타자 · 투수 몸통(스윙 3f320 ·
 * 투수 0x9e004)은 갱신에서 넘어가 그대로다.
 */
import { gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'
import { renderBattingStage, type StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { bigHitScreenOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { stepRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { withRedrawAt } from '@/widgets/batting-stage/lib/stageRedraws'
import { sceneScoreboardTickOf } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { HitInStage, StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { emitHitStopParticle } from '@/widgets/batting-stage/model/stageAnimation/hitStage'
import { stepSkillPanelNow } from '@/widgets/batting-stage/model/stageAnimation/skillPanelNow'

/** 창이 서 있는 틀 — 창이 선 첫 그림만 마지막 그림 입력을 고쳐 한 번 다시 그린다 */
export function drawFrozenFrame(loop: StageLoop, rawNow: number): void {
  const { keyLatch, latestRef } = loop.refs
  // 창이 서 있는 틀은 키 0x498d4 가 안 돌고 다음 틀 0xbca05 머리가 받은 키를 지운다 — 모아 두지 않는다
  keyLatch.clear()
  const frozenScene = loop.lastStageScene
  if (!loop.frozenDrawGate.allowsDraw() || frozenScene === null || latestRef.current.settlement?.layers !== undefined) return
  const frozenTick = gameSceneTickOf(gameSceneTimeOf(rawNow))
  const frozenBigHitScreen = frozenBigHitScreenOf(loop, frozenScene, frozenTick)
  loop.redrawTicks = withRedrawAt(loop.redrawTicks, frozenScene.tick)
  const frozenRunnerSteps = frozenRunnerStepsOf(loop, frozenScene)
  const redrawn: StageScene = {
    ...frozenScene,
    particles: null,
    bigHitScreen: frozenBigHitScreen,
    scenery: { ...frozenScene.scenery, scoreboardTick: sceneScoreboardTickOf(frozenTick) },
    redrawTicks: loop.redrawTicks,
    ...(frozenRunnerSteps === undefined ? {} : { runnerAnimationSteps: frozenRunnerSteps }),
    // 0x4c4bc 4cad4 → 0x4b5b4 — 판을 그리던 상태면 한 번 더 돈다(마지막으로 센 틱은 그대로)
    skillPanel:
      frozenScene.skillPanel === null || frozenScene.skillPanel === undefined
        ? frozenScene.skillPanel
        : stepSkillPanelNow(loop, frozenScene.tick, true),
  }
  // 다음 그림이 이 그림과 견주도록 입력을 남긴다
  loop.drawMemo.needsDraw(loop.canvas, {
    scene: { ...redrawn, particles: loop.particleKit.signatureOf(null) },
    layerParticles: null,
    rainLayer: null,
    rainLayerSize: null,
    particleLayer: null,
    particleLayerSize: null,
  })
  renderBattingStage(loop.context, redrawn)
  loop.lastStageScene = redrawn
}

/** 0x13 이면 그 그림도 0x4cb1c 를 돈다 — 마지막 갱신 틱 + 1 자리의 그림으로 센다 */
function frozenHitOf(loop: StageLoop): HitInStage | null {
  const hit = loop.hitInStage
  const { phaseRef, phaseStartTickRef } = loop.refs
  if (phaseRef.current !== '타격' || hit === null) return null
  return hit.startTick === phaseStartTickRef.current && hit.endTick === null ? hit : null
}

function frozenBigHitScreenOf(loop: StageLoop, frozenScene: StageScene, frozenTick: number): StageScene['bigHitScreen'] {
  const frozenHit = frozenHitOf(loop)
  if (frozenHit === null || !frozenHit.pending.watchesBigHit || loop.refs.latestRef.current.isResultBackdrop === true) return frozenScene.bigHitScreen
  const lastHeld = frozenTick - frozenHit.startTick
  const screen = bigHitScreenOf(true, lastHeld + 1, frozenScene.side ?? 0, frozenHit.pending.bigHitAt, frozenHit.frozenDraws)
  // 4ccba — 옛값이 음수면 이 그림이 막음을 풀고 016 을 쏜다(파티클 틱 53048 은 건너뛴다)
  if (screen?.kind === '멈춤' && screen.counter < 0) emitHitStopParticle(loop, frozenHit.pending)
  frozenHit.frozenDraws.push(lastHeld)
  return screen
}

/** 0x35b94 35c62 — 루에 (숨김 없이) 주자가 선 애니가 한 칸 더 간다(0x13 은 그리지 않고 진행만) */
function frozenRunnerStepsOf(loop: StageLoop, frozenScene: StageScene): StageScene['runnerAnimationSteps'] {
  const frozenHud = frozenScene.hud
  if (frozenScene.runnerAnimationSteps === undefined || frozenHud === null) return frozenScene.runnerAnimationSteps
  return stepRunnerAnimationClock(
    loop.refs.latestRef.current.runnerAnimationClock?.current ?? loop.localRunnerClock,
    frozenHud.bases,
    frozenHud.hiddenRunnerBases ?? [],
    1,
  )
}
