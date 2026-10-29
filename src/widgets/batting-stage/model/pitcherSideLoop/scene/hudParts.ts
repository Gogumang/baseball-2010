/** 그림 입력의 HUD · 배경 몫 — 단계 · 입력 UI · "#TIME" · 스킬 판 · 미션 띠 · 구름 · 전광판 */
import { SCENE_STATE, sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import { observeSceneCloudFrame, sceneCloudFrameOf, sceneScoreboardTickOf } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'
import type { PitchInputNow } from '@/widgets/batting-stage/model/pitcherSideLoop/idleMotion'

type HudParts = Pick<
  StageScene,
  'stagePhase' | 'pitchInput' | 'timeKeyCount' | 'isSubstitutionState' | 'specialSwingRemaining' | 'skillPanel' | 'missionStrips' | 'omitsHud'
>

export function hudSceneParts(frame: PitcherSideFrame, input: PitchInputNow, skillPanel: SkillPanelView | null): HudParts {
  const { current, stage } = frame
  const isSceneD = isSceneDOf(frame)
  return {
    stagePhase: isSceneD ? { ...stage.phase, isSceneD } : stage.phase,
    pitchInput: input.pitchInput,
    timeKeyCount: timeKeyCountOf(frame, input, isSceneD),
    isSubstitutionState: current.isSubstitutionWindowOpen === true,
    // 필살 남은 횟수 0x38a30 은 38a42 에서 0x33fe4(수비 조작 사람)면 바로 끝 — 사람이 던지는 장면엔 없다
    specialSwingRemaining: null,
    // 0x4cad4 → 0x4b5b4 — 경기 스킬 표시 판
    skillPanel,
    // 0x373d0 끝의 미션 HUD 띠 (모드 5 — `MissionHud`)
    missionStrips: current.missionStrips ?? null,
    omitsHud: current.isHudOmitted === true,
  }
}

/** 쉬는 대기의 앞 두 그림은 0xd(타석 준비) — 확인 대기가 적은 상태 경계로 가른다(`sceneStateEntries`) */
function isSceneDOf(frame: PitcherSideFrame): boolean {
  if (frame.stage.phase.kind !== '대기' || !frame.current.isPaused) return false
  return sceneStateEntryAt(frame.sceneTick)?.state === SCENE_STATE.준비
}

/** 0x4c92e — "#TIME" 은 상태 0xe · 0xf 만 */
function timeKeyCountOf(frame: PitcherSideFrame, input: PitchInputNow, isSceneD: boolean): number | null {
  const { current } = frame
  if (frame.stage.phase.kind !== '대기') return null
  const isTimeState = (current.isPaused && !isSceneD) || input.pitchInput?.kind === '구질'
  return isTimeState ? (current.timeKeyCount ?? null) : null
}

/** 배경 — 구름 셈 · 전광판 셈이 이 그림을 센다(그림마다 한 번, 이 차례로) */
export function scenerySceneOf(loop: PitcherSideLoop, frame: PitcherSideFrame): StageScene['scenery'] {
  const { current } = frame
  const isIdle = frame.stage.phase.kind === '대기'
  return {
    // 구름 0x78448 — 0x3f060 은 '대기'(0xd~0x10)에서만 센다. 팝업으로 장면이 선 동안(`isFrozen`)은 안 센다
    cloudCalls: observeSceneCloudFrame(sceneCloudFrameOf(frame.rawNow), isIdle && current.isFrozen !== true, loop.cloudCursor),
    // 전광판 글자 [구장+0x8c] — 이 장면에서 배경을 처음 그린 틱이 0 (`sceneScoreboardTickOf`)
    scoreboardTick: sceneScoreboardTickOf(frame.sceneTick),
    skyRow: current.skyRow,
    stadium: current.stadium,
    fieldPalette: current.fieldPalette,
    gameMode: current.gameMode,
    isScoreboardOn: current.isScoreboardOn,
    ...(current.seasonStadium === undefined ? {} : { seasonStadium: current.seasonStadium }),
  }
}
