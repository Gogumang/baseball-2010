import type { MutableRefObject, ReactNode } from 'react'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { PitcherSideStage } from '@/widgets/batting-stage/ui/PitcherSideStage'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { PitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import { MISSION_PITCHER_MODE, missionHudLimitsOf } from './missionPitching'
import { missionStageStripsOf } from './otherSlices'
import type { PitchingScreenProps, PitchingStageSource } from './pitchingScreenProps'
import { missionStageHudOf, optionalStageFieldsOf } from './stageHud'

/** 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 */
function skillPanelFieldOf(
  stage: PitchingStageSource,
  sceneConfirmWait: SceneConfirmWait | null | undefined,
  skillPanelScene: MutableRefObject<SkillPanelScene> | undefined,
) {
  if (stage.skillPanel === undefined) return {}
  return {
    skillPanel: {
      ...stage.skillPanel,
      entryKey: sceneConfirmWait ?? null,
      ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
    },
  }
}

/** 마지막 공의 그림 재료 — 공 · 판정 · 결과 틱 · CPU 스윙 (공이 없으면 빈 값) */
function lastThrowFieldsOf({ lastThrow }: PitchingStageSource) {
  if (lastThrow === null) return { pitch: null, resolution: null, resultTicks: 0, cpuSwing: null }
  return { pitch: lastThrow.pitch, resolution: lastThrow.resolution, resultTicks: lastThrow.resultTicks, cpuSwing: lastThrow.cpuSwing ?? null }
}

/** 전광판 설정 — 환경설정이 있을 때만 넘긴다 */
const scoreboardFieldOf = (settings: GameSettings | undefined) => (settings === undefined ? {} : { isScoreboardOn: settings.isScoreboardOn })

/** CPU 타자가 맞힌 공의 판 손잡이 — 있을 때만 넘긴다 */
function hitSceneHandlersOf(stage: PitchingStageSource) {
  return {
    ...(stage.onHitSceneEnd === undefined ? {} : { onHitSceneEnd: stage.onHitSceneEnd }),
    ...(stage.onHitJudged === undefined ? {} : { onHitJudged: stage.onHitJudged }),
  }
}

/**
 * 투수 미션 타석 장면 — 원본은 240×320 경기 장면 한 장이다. 미션 HUD 띠는 점수판 0x373d0 끝이라 타석 캔버스가 원본 식으로 섞는다
 * (Q-03 r301, `missionStageStripsOf`). 소개 판 · "CHANGE" 는 그 위(`children`)
 */
export function PitchingStageView({
  run,
  atBat,
  stage,
  sceneDEntryMark,
  stealDisplay,
  isPitchSceneBusy,
  skyRow,
  settings,
  isAwaitingConfirm,
  isPopupOpen,
  inputOverlayRef,
  sceneConfirmWait,
  skillPanelScene,
  children,
}: {
  readonly run: PitcherRun
  readonly atBat: AtBatState
  readonly stage: PitchingStageSource
  readonly sceneDEntryMark: number
  readonly stealDisplay: PitchingScreenProps['stealDisplay']
  readonly isPitchSceneBusy: boolean
  readonly skyRow: number | undefined
  readonly settings: GameSettings | undefined
  readonly isAwaitingConfirm: boolean
  readonly isPopupOpen: boolean
  readonly inputOverlayRef: PitchInputOverlayRef
  readonly sceneConfirmWait: SceneConfirmWait | null | undefined
  readonly skillPanelScene: MutableRefObject<SkillPanelScene> | undefined
  readonly children: ReactNode
}) {
  return (
    <PitcherSideStage
      missionStrips={missionStageStripsOf(missionHudLimitsOf(run), run.remainingSeconds)}
      // 0xd 진입마다 투수 그림 객체를 상태 0 으로 (48ee4 — '#' 교체 창에서 곧장 선 0xe 는 0xd 가 없다)
      sceneDEntryMark={sceneDEntryMark}
      {...lastThrowFieldsOf(stage)}
      isJudgementCleared={stage.isJudgementCleared === true}
      // CPU 타자가 맞힌 공 — 판정 틀까지 0x11, 이어 0x13 을 그리고 0x17 이 선 틀에 수비 판으로 넘긴다 (투수편과 같다)
      hitScene={stage.hitScene ?? null}
      {...hitSceneHandlersOf(stage)}
      hud={missionStageHudOf(run, atBat, stage, stealDisplay, isPitchSceneBusy)}
      batterForm={stage.batterForm}
      batterSkinIndex={stage.batterSkinIndex}
      batterTeamIndex={stage.batterTeamIndex}
      pitcherForm={stage.pitcherForm}
      {...optionalStageFieldsOf(stage)}
      // 미션은 구장 생성자 값 0 · 바닥 줄 기본 — 타자 미션 화면(`MissionPlayScreen`)과 같다
      stadium={0}
      fieldPalette={null}
      skyRow={skyRow ?? 0}
      gameMode={MISSION_PITCHER_MODE}
      {...scoreboardFieldOf(settings)}
      isPaused={isAwaitingConfirm}
      isFrozen={isPopupOpen}
      inputOverlayRef={inputOverlayRef}
      // "#TIME" 없음 — '#' 교체 검사 0x38984 가 미션(모드 5 · 6)을 막는다(38984~38a20)
      timeKeyCount={null}
      {...skillPanelFieldOf(stage, sceneConfirmWait, skillPanelScene)}
    >
      {children}
    </PitcherSideStage>
  )
}
