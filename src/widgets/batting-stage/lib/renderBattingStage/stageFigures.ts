/**
 * 타석의 선수 · 공 — 그리기 목록 0xbe810 · 0xbe6a1 에 넣은 그림을 깊이 오름차순(같은 깊이는 넣은 차례, be864 `bge`)으로 한꺼번에 그린다.
 * 아래 그림들은 원본이 넣는 차례 그대로 넣고, 공(깊이 = 경로 점의 월드 z, `ballDepthAt`)만 깊이에 따라 앞뒤가 갈린다(Q-02, r271).
 * 카메라 (+0xff4, +0xff8) 을 더해 그리는 것들(그리기 목록 · 투구 판 · 투구 기계 · 마투수 덧그림)은 0x13 카메라만큼 옮긴다
 */
import { recordStageEntryPoints } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { pitcherAnimationAt, pitcherPoseOf } from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery'
import { showsBaseRunners } from '@/widgets/batting-stage/lib/baseRunners'
import { drawDerbyPitchingMachine } from '@/widgets/batting-stage/lib/derbyPitchingMachine'
import { drawPitchInputUnderlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { DRAW_DEPTH, StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage/drawList'
import { drawBaseRunners } from '@/widgets/batting-stage/lib/renderBattingStage/runners/drawBaseRunners'
import { drawPitcher } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/drawPitcher'
import { drawPitcherFatigue, drawPitcherMistakeMark, drawPitchWind } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherMarks'
import { drawPitcherHomeRunMarks } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherHomeRunMarks'
import {
  acePitcherEffectInputOf,
  addLeonyEffectDraws,
  drawAceMagicAnimation,
  drawAceMagicScaled,
  drawEffectPitcher,
} from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/acePitcherDraws'
import { addBatterDraws } from '@/widgets/batting-stage/lib/renderBattingStage/batter/batterDraws'
import { addStageBallDraws } from '@/widgets/batting-stage/lib/renderBattingStage/ball/ballDraws'
import type { StageView } from '@/widgets/batting-stage/lib/renderBattingStage/stageBackdrop'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'
import type { AcePitcherEffectInput } from '@/widgets/batting-stage/lib/acePitcherEffect'

/**
 * 주루 칸을 그리는 상태 0xe — 웹은 쉬는 '대기'(0xe 확인 대기 · 그 위 메뉴)로 본다. 앞 두 그림 0xd 는 확인 대기가 적은 상태 경계로
 * 뺀다(`isSceneD`, `softKeyLabels` 와 같은 갈래)
 */
function isRunPipState(phase: StagePhaseSnapshot | undefined): boolean {
  return phase?.kind === '대기' && phase.isPaused && phase.isSceneD !== true
}

/** 마투수 순번 0xb63a0 — 평범한 투수면 null */
function aceOrderOf(scene: StageScene): number | null {
  return scene.acePitcher?.order ?? null
}

/** 투수 그림 객체의 상태 · 단계 (0x11 투구 · 대기 동작 · 선 자세) */
function pitcherAnimationOf(scene: StageScene): PitcherAnimation {
  return pitcherAnimationAt(
    {
      pitchTick: scene.pitcherTick,
      pitchEndTick: scene.pitcherTickEnd ?? null,
      idleTick: scene.pitcherIdleTick ?? null,
      idleEndTick: scene.pitcherIdleTickEnd ?? null,
    },
    aceOrderOf(scene),
  )
}

export function drawStageFigures(context: CanvasRenderingContext2D, scene: StageScene, view: StageView): void {
  const { side, cameraShift } = view
  const pitchInput = scene.pitchInput ?? null
  context.save()
  context.translate(cameraShift.dx, cameraShift.dy)
  // 0x4d780 이 바로 그리는 판 · 덮개 — 그리기 목록(선수)보다 먼저
  drawPitchInputUnderlay(context, pitchInput, side)
  const aceEffect = acePitcherEffectInputOf(scene)
  const pitcherAnimation = pitcherAnimationOf(scene)
  const pose = pitcherPoseOf(pitcherAnimation, scene.pitcherForm ?? 0, aceOrderOf(scene))
  const drawList = new StageDrawList()
  addPitcherSideDraws(context, drawList, scene, view, { aceEffect, pitcherAnimation })
  addBatterDraws(context, drawList, scene, side)
  addStageBallDraws(context, drawList, scene, side)
  // 0x46fa8(장면, 1) 레오니 0x4703a — 원본은 목록 비우기 뒤에 넣어 버려진다(B-82). 고친 길만 목록에 든다(`leonyEffectDrawsOf`)
  addLeonyEffectDraws(context, drawList, aceEffect, side, pose)
  drawList.flush()
  // 그리기 목록을 비운 뒤(0xbe6a1) · HUD(0x4c4bc) 앞 — 홈런더비 투구 기계 0x42f2c (`derbyPitchingMachine`). 0x1b · 0x23 은 안 부른다(`omitsHud`)
  if (scene.omitsHud !== true) drawDerbyPitchingMachine(context, scene.scenery.gameMode, side, scene.pitcherHand ?? 0)
  // 0x46fa8(장면, 1) 싸이커 · 드래고나 — 목록 비우기(0x4d744) 뒤 · HUD(0x4c4bc) 앞에 화면에 바로 섞어 그린다
  drawAceMagicScaled(context, aceEffect, side, pose)
  context.restore()
}

/** 투수 쪽 그림 — 마투수 효과 · 루상 주자 · 바람 줄 · 투수 · 덧그림 · 마투수 마법 (0x38d1c · 0x35b94 · 0x46fa8) */
function addPitcherSideDraws(
  context: CanvasRenderingContext2D,
  drawList: StageDrawList,
  scene: StageScene,
  view: StageView,
  pitcher: { readonly aceEffect: AcePitcherEffectInput; readonly pitcherAnimation: PitcherAnimation },
): void {
  const { side } = view
  const { aceEffect, pitcherAnimation } = pitcher
  // 마투수 effect_pitcher(+0x1044) — 0x38d1c 꼬리 39258 이 깊이 24499 로 넣는다. 같은 깊이의 루상 주자(0x35b94)보다 먼저 넣어 그 밑이다
  drawList.add(DRAW_DEPTH.주자, () => drawEffectPitcher(context, aceEffect, side))
  // 루상 주자 0x35b94 — 그리기 목록에 깊이 24499([0xcfa8c+8] − 1, 35bfe~35c08)로 들어가 투수보다 먼저(뒤에) 그려진다 (확정 r205:
  // 넣기 0xbe810 은 깊이 오름차순(be864 `cmp 새, 칸 / bge`) · 비우기 0xbe6a0 은 칸 0 부터 그린다 · 투수 그림 0x79525 깊이 [0xd3cf8+8] = 24500
  // — 곧 주자는 투수 밑이다, U-122)
  if (scene.hud !== null && showsBaseRunners(scene.stagePhase)) {
    // 주자 시계를 안 넘기는 옛 길(`tick`)도 창 첫 그림(0x35b94 35c62 한 칸)을 센다 — 시계를 넘기면 부르는 쪽이 이미 셌다
    const runners = {
      hud: scene.hud,
      side,
      tick: scene.tick + view.redrawsSoFar,
      showsRunPips: isRunPipState(scene.stagePhase),
      runnerAnimationSteps: scene.runnerAnimationSteps,
      runnerAces: scene.runnerAces,
    }
    drawList.add(DRAW_DEPTH.주자, () => drawBaseRunners(context, runners))
  }
  // 0x38dc6 바람 줄(애니 11) — 투수와 같은 깊이 24500 이지만 먼저 넣어 투수 밑에 그려진다
  drawList.add(DRAW_DEPTH.투수, () => drawPitchWind(context, scene, side, pitcherAnimation))
  // 0x38d1c(38dc2) · 0x49e64(49f76)가 0x38b64 에 넘기는 그림 자리 — 교체 등판 파티클이 쓴다(`substitutionEntryParticle`)
  recordStageEntryPoints(side, scene.pitcherHand ?? 0, scene.shift)
  drawList.add(DRAW_DEPTH.투수, () => drawPitcher(context, scene, pitcherAnimation, side))
  // 0x38d1c 의 실투 "!"(38ee0) · 체력 그림(38f42) · 홈런 갈래(0x3908a) — 같은 깊이(24500)로 투수 다음에 이 차례로 들어간다
  drawList.add(DRAW_DEPTH.투수, () => {
    drawPitcherMistakeMark(context, scene, side)
    drawPitcherFatigue(context, scene, side, pitcherAnimation)
    drawPitcherHomeRunMarks(context, scene, side, pitcherAnimation)
  })
  // 0x46fa8(장면, 0) 붕붕머신 · 발렌타인 — 깊이 24501 이라 투수 덧그림(24500)들 다음 · 타자(29705) 앞이다
  drawList.add(DRAW_DEPTH.마투수마법, () => drawAceMagicAnimation(context, aceEffect, side))
}
