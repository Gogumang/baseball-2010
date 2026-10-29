/**
 * 사람이 던지는 타석의 캔버스 루프 — rAF 틀마다 그리기 앞 갱신 → props 지켜보기 → 키 → 0x13 연출 → 파티클 → 상태 경계 → 그림 차례로
 * 한 번 돈다 (경기 장면 0x52c50). 공 판정 · 스윙 키는 받지 않는다 — 진행기가 이미 정한 공을 그림으로만 다시 날린다(굴림 없음)
 */
import { flushSync } from 'react-dom'
import { appTickOfGameSceneTick, gameSceneTickOf, gameSceneTimeOf, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { hasDueSceneFrameUpdate, runDueSceneFrameUpdates } from '@/entities/particle/model/sceneParticleManager'
import { gameSceneShownTicks } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { renderBattingStage } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createPitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideLoop, PitcherSideLoopInput } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import { pitcherSideFrameOf } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'
import { applyHitSkipOffer, createHitSkipKeyHandler } from '@/widgets/batting-stage/model/pitcherSideLoop/hitSkipKey'
import { redrawFrozenFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/frozenRedraw'
import { emitWindUpMagicOfGauge } from '@/widgets/batting-stage/model/pitcherSideLoop/windUpMagic'
import {
  advanceFrozenTicks,
  applyHitSceneProps,
  applyReleasedPitch,
  applySceneEntryProps,
} from '@/widgets/batting-stage/model/pitcherSideLoop/pitchWatch'
import { applyHitEffects } from '@/widgets/batting-stage/model/pitcherSideLoop/hitEffects'
import { emitFlightMagicParticles } from '@/widgets/batting-stage/model/pitcherSideLoop/flightMagic'
import { markPitchStateEntries } from '@/widgets/batting-stage/model/pitcherSideLoop/pitchStateEntries'
import { pitcherSideSceneNow } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/pitcherSideScene'

/** 캔버스 루프를 세운다 — 그릴 캔버스가 없으면 안 세운다(undefined). 돌려준 함수가 루프를 거둔다 */
export function startPitcherSideLoop(input: PitcherSideLoopInput): (() => void) | undefined {
  const context = effectContextOf(input.canvasRef.current)
  if (!context) return undefined
  const loop = createPitcherSideLoop(input, context)
  const onKeyDown = createHitSkipKeyHandler(loop)
  window.addEventListener('keydown', onKeyDown)
  const frame = (rawNow: number) => {
    if (!runPitcherSideFrame(loop, rawNow)) return
    loop.handle = requestAnimationFrame(frame)
  }
  loop.handle = requestAnimationFrame(frame)
  return () => {
    loop.isDisposed = true
    cancelAnimationFrame(loop.handle)
    gameSceneShownTicks.clear()
    window.removeEventListener('keydown', onKeyDown)
  }
}

/** 한 틀 — 장면이 이 틀에 내려갔으면 거짓(다음 틀을 걸지 않는다) */
function runPitcherSideFrame(loop: PitcherSideLoop, rawNow: number): boolean {
  if (isGameSceneFrozen()) {
    redrawFrozenFrame(loop, rawNow)
    return true
  }
  const sceneTick = gameSceneTickOf(gameSceneTimeOf(rawNow))
  if (!runDueUpdatesBeforeDraw(loop, sceneTick)) return false
  const current = loop.latestRef.current
  const nowTick = advanceFrozenTicks(loop, current, sceneTick)
  emitWindUpMagicOfGauge(loop, current)
  applyReleasedPitch(loop, current, nowTick)
  applyHitSceneProps(loop, current)
  applySceneEntryProps(loop, current, nowTick)
  const frame = pitcherSideFrameOf(loop, current, { rawNow, sceneTick, nowTick })
  applyHitEffects(loop, frame)
  applyHitSkipOffer(loop, frame)
  emitFlightMagicParticles(loop, frame)
  markPitchStateEntries(loop, frame)
  drawPitcherSideScene(loop, pitcherSideSceneNow(loop, frame), nowTick)
  // 이 틱의 그림이 화면에 섰다 — 이 뒤에 난 게이지 · 조준 키는 이 틱 그림을 보고 누른 것이다(`gameSceneShownTicks`, r217 —
  // 원본은 키를 받은 틀 = 마지막으로 그린 틀. 타자편 `useStageAnimation` 의 `shownTicks` 와 같은 셈)
  gameSceneShownTicks.mark(sceneTick, performance.now())
  return true
}

/**
 * 이 틀의 갱신이 아직이면 그리기 앞에서 먼저 — 원본 틀 차례 갱신 52e14 → 그리기 52efe → 관리자 틱 53048. 사람이 던진 못 맞힌 공의
 * 0x12 진입 0x3dfac(`scheduleSceneFrameUpdate` — 판정 칸 지움 3e0aa · 판 시작)은 장면 틱 시계에 걸려 그림 시계보다 늦게 울릴 수 있다.
 * 그 갱신이 고친 진행이 이 그림의 재료(`latestRef`)에 들도록 React 를 곧바로 커밋한다 — 0x12 틱 0 의 판정 글자 · 삼진 양끝 파티클
 * (0x393b4)이 판정 칸 지움을 본다(r295, r293 의 남은 근사). 그 갱신이 이 장면을 내렸으면(수비 판 · 벤치 클리어링으로 넘어감) 거짓
 */
function runDueUpdatesBeforeDraw(loop: PitcherSideLoop, sceneTick: number): boolean {
  const appTick = appTickOfGameSceneTick(sceneTick)
  if (!hasDueSceneFrameUpdate(appTick)) return true
  flushSync(() => runDueSceneFrameUpdates(appTick))
  return !loop.isDisposed
}

/**
 * 창이 닫힌 앱 틱 동안은 장면 틱이 창 첫 그림의 틱 그대로다 — 원본은 그 틱을 다시 그리지 않으므로(창이 닫힌 틀은 갱신이 없고
 * 다음 틀이 다음 틱을 그린다) 창 첫 그림을 그대로 둔다. 갱신(위)은 틀마다 그대로 돈다
 */
function drawPitcherSideScene(loop: PitcherSideLoop, scene: StageScene, nowTick: number): void {
  if (loop.redrawTicks.at(-1) === nowTick) return
  if (loop.drawMemo.needsDraw(loop.canvasRef.current, scene)) renderBattingStage(loop.context, scene)
  loop.lastStageScene = scene
}
