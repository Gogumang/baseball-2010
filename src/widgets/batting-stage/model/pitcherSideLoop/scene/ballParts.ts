/** 그림 입력의 공 · 시계 · 판정 글자 몫 */
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'
import { judgeTextNowOf } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/judgeResult'

type BallParts = Pick<
  StageScene,
  | 'pitch'
  | 'frame'
  | 'pitcherTick'
  | 'pitcherTickEnd'
  | 'pitcherIdleTick'
  | 'pitcherIdleTickEnd'
  | 'tick'
  | 'redrawTicks'
  | 'resultTick'
  | 'resultText'
  | 'isHomeRun'
  | 'homeRunTick'
  | 'isEagleEyeEnabled'
  | 'shift'
>

export function ballSceneParts(loop: PitcherSideLoop, frame: PitcherSideFrame): BallParts {
  const { stage, nowTick } = frame
  const resultTick = stage.phase.kind === '결과' ? stage.phase.tick : 0
  return {
    pitch: stage.phase.kind === '대기' ? null : frame.pitch,
    frame: stage.ballFrame,
    pitcherTick: stage.pitcherTick,
    pitcherTickEnd: stage.pitcherTickEnd,
    ...idleTickParts(loop, nowTick),
    tick: nowTick,
    redrawTicks: loop.redrawTicks,
    resultTick,
    resultText: resultTextOf(frame),
    isHomeRun: isHomeRunResultOf(frame),
    homeRunTick: resultTick,
    isEagleEyeEnabled: false,
    shift: 0,
  }
}

/** 대기 동작 틱 — 빈 칸 키 뒤 흐른 틱 · 0xf 를 떠나 굳은 틱 */
function idleTickParts(loop: PitcherSideLoop, nowTick: number): Pick<StageScene, 'pitcherIdleTick' | 'pitcherIdleTickEnd'> {
  const { idleStartTick, idleEndTick } = loop
  if (idleStartTick === null) return { pitcherIdleTick: null, pitcherIdleTickEnd: null }
  return { pitcherIdleTick: nowTick - idleStartTick, pitcherIdleTickEnd: idleEndTick === null ? null : idleEndTick - idleStartTick }
}

function resultTextOf(frame: PitcherSideFrame): string {
  const { resolution } = frame
  return frame.stage.phase.kind === '결과' && resolution !== null ? judgeTextNowOf(frame, resolution) : ''
}

/**
 * CPU 홈런도 판정 v = 8 · 12 → 0x51cd8 이 +0x1960 을 켜 HOMERUN 글자(0x40b18)가 나간다 — 판정 글자는 없다 (타자편 `BattingStage` 와 같은 길).
 * ⚠️ 맞은 공은 0x12 를 안 지나(`passesHeldResult`) 이 장면에서는 '결과' 가 서지 않는다 — 원본도 0x13 → 0x17(수비 판)이라
 *    글자는 수비 판 그리기 0x46c88 이 띄운다(`pages/defense` 의 `DefenseHomeRunText`). 여기서는 같은 판정이 '결과' 로 들어올 때만 탄다
 */
function isHomeRunResultOf(frame: PitcherSideFrame): boolean {
  const { resolution } = frame
  return frame.stage.phase.kind === '결과' && resolution?.kind === '타구' && resolution.outcome.kind === '홈런'
}
