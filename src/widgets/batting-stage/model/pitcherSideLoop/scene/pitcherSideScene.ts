/**
 * 이 틀의 그림 입력 — 타자편과 같은 그리기(`renderBattingStage`) 재료. 판정 글자 파티클 · 대기 동작 · 스킬 판 · 구름 · 전광판처럼
 * 그림이 세는 칸은 이 차례로 한 번씩 센다
 */
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'
import { applyIdleMotion, pitchInputNowOf } from '@/widgets/batting-stage/model/pitcherSideLoop/idleMotion'
import { stepSkillPanelNow } from '@/widgets/batting-stage/model/pitcherSideLoop/skillPanelNow'
import { emitStrikeoutJudgeParticles } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/judgeResult'
import { ballSceneParts } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/ballParts'
import { hitSceneParts } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/hitParts'
import { batterSceneParts, pitcherSceneParts } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/figureParts'
import { hudSceneParts, scenerySceneOf } from '@/widgets/batting-stage/model/pitcherSideLoop/scene/hudParts'

export function pitcherSideSceneNow(loop: PitcherSideLoop, frame: PitcherSideFrame): StageScene {
  const input = pitchInputNowOf(loop, frame)
  applyIdleMotion(loop, frame, input)
  emitStrikeoutJudgeParticles(loop, frame)
  const skillPanel = stepSkillPanelNow(loop, frame, input)
  return {
    ...ballSceneParts(loop, frame),
    ...hitSceneParts(loop, frame),
    ...batterSceneParts(loop, frame),
    ...pitcherSceneParts(frame),
    ...hudSceneParts(frame, input, skillPanel),
    scenery: scenerySceneOf(loop, frame),
  }
}
