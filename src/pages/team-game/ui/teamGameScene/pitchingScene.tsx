import type { ReactElement } from 'react'
import { PitcherSideStage } from '@/widgets/batting-stage/ui/PitcherSideStage'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { humanDefenseSkillPanelOf, runnerAcesFor } from '@/features/play-team-game/model/teamGameFlow'
import { teamPitcherSideStageOf } from '@/pages/team-game/lib/teamMatchupCards'
import { pitchInputSlotsOf } from './pitchInputs'
import { stageHudOf } from './stageHud'
import { isHudOmittedOf, isStagePausedOf, shownMatchupCardsOf } from './stageOverlays'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 사람 수비 장면의 구장 — 타석과 같은 구장 · 하늘 줄 · 전광판 설정 */
function pitcherSceneryPropsOf(model: TeamGameSceneModel) {
  const { options, settings, seasonStadium } = model.props
  const { sceneStadium, fieldPalette, stadiumSkyRow } = model.backdrop
  return {
    stadium: sceneStadium?.stadium ?? 0,
    fieldPalette,
    skyRow: stadiumSkyRow ?? 0,
    ...(seasonStadium === undefined ? {} : { seasonStadium }),
    gameMode: options.mode,
    ...(settings === undefined ? {} : { isScoreboardOn: settings.isScoreboardOn }),
  }
}

/** 사람 수비 마운드(우리 투수) — 마투수면 0x38d1c 38f56 이 체력 그림을 거른다. 0x38f68 — 체력% 로 지친 표시(player_effect 애니 9 · 10) */
function ourMoundStaminaOf(model: TeamGameSceneModel): number | null {
  const { progress } = model.props.session
  const ourMoundIsAce = (progress.ourPitcherEntry[progress.ourPitcherIndex]?.aceIndex ?? -1) >= 0
  return ourMoundIsAce ? null : staminaPercentOf(progress.stamina)
}

/**
 * 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 사람 타석과 같은 장면 칸 · 0xd 진입마다 새 0xe 대기 객체 ·
 * 공격 측(st[9]) = 상대(CPU) 측
 */
function pitcherSkillPanelOf(model: TeamGameSceneModel) {
  const { progress } = model.props.session
  return {
    entryKey: progress.sceneConfirm ?? null,
    attackSide: progress.game.playerSide === 0 ? 1 : 0,
    scene: model.scoped.skillPanelSceneRef,
    ...humanDefenseSkillPanelOf(progress),
  }
}

/** 던진 공 — 공 · 판정 · 0x12 대기 틱 · CPU 스윙 */
function thrownPitchPropsOf(model: TeamGameSceneModel) {
  const { progress } = model.props.session
  return {
    pitch: progress.lastPitch,
    resolution: progress.lastResolution,
    resultTicks: model.throwSettle.heldResultTicks,
    // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠으면 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다
    isJudgementCleared: progress.lastPitchJudgementCleared === true,
    cpuSwing: progress.lastCpuSwing ?? null,
  }
}

/** 0xf 구질 목록이면 뒤의 빛 지도 4c5a6 이 돌발 띠를 같이 어둡게 한다 */
const isBurstBandDimmed = (model: TeamGameSceneModel) =>
  model.pitchInput.phase === '구질' &&
  !model.confirmFlow.isAwaitingConfirm &&
  !model.throwSettle.isPitchSceneBusy &&
  model.change.changeWindow === null

/**
 * 사람 수비 타석 장면 — 원본은 누가 던지든 같은 프레임 0x52c50 · 그리기 표 0xd05a0 이 구장 · 투수 0x38d1c · 타자 0x49e64 ·
 * 주자 0x35b94 · HUD 0x4c4bc 를 그린다(`widgets/batting-stage/lib/pitcherSideStage`). 그 위에 0xe 소개 판 0x44944 ·
 * 0x16 "CHANGE" 가 얹히고, 구질 목록 · 조준 · 게이지는 장면 안에 그린다. 팝업(경기 중 메뉴 · 조작방법) 동안은 멈춘다 —
 * 단계 상태(0xf·0x10·0x11)와 조준점·게이지 틱은 그대로다 (0x52cc6, 투수편 `isPitchInputPaused` 와 같은 자리)
 */
export function renderPitchingScene(model: TeamGameSceneModel, substitutionOverlay: ReactElement | null, isPopupOpen: boolean): ReactElement {
  const { session } = model.props
  const { progress } = session
  const { confirmFlow, change } = model
  const inputSlots = pitchInputSlotsOf(model, isPopupOpen)
  return (
    <PitcherSideStage
      isHudOmitted={isHudOmittedOf(model)}
      // 0xd 진입마다 투수 그림 객체를 상태 0 으로 (48ee4 — '#' 교체 창에서 곧장 선 0xe 는 0xd 가 없다)
      sceneDEntryMark={confirmFlow.sceneConfirm.sceneDEntryMark}
      {...thrownPitchPropsOf(model)}
      // CPU 타자가 맞힌 공 — 판정 틀까지 0x11, 이어 0x13 을 그리고 0x17 이 선 틀에 수비 판으로 넘긴다
      hitScene={model.playHold.teamHitScene.hitScene}
      onHitSceneEnd={model.playHold.teamHitScene.end}
      // 판정 틀의 메시지 0x11 굴림 묶음 — 0x13 그림의 파티클 굴림보다 앞 (A-37)
      onHitJudged={model.playHold.teamHitScene.judge}
      hud={stageHudOf(progress, model.props.options)}
      {...teamPitcherSideStageOf(progress)}
      // 다음 CPU 타자 · 대타 · 우리 교체 투수를 미리 칠한다(0x47cc8 의 적재 때 칠하는 몫)
      warmCast={model.warmCast.theirBattingWarmCast}
      {...pitcherSceneryPropsOf(model)}
      isPaused={isStagePausedOf(model)}
      isFrozen={isPopupOpen}
      inputOverlayRef={model.inputOverlayRef}
      pitcherStaminaPercent={ourMoundStaminaOf(model)}
      // 실투 "!" 0x38d1c 38ee0 — 놓기 0x4dc78 4deae
      isMistakePitch={progress.lastPitchIsMistake === true}
      // 루상 주자 0x35b94 — 공격 팀(상대) 주자의 마선수 그림
      runnerAces={runnerAcesFor(progress, false)}
      // "#TIME" 0x4c940 — 사람 수비라 n = 우리 팀[+0x33] 벤치 투수 수. 팀 경기는 0x38984 가 통과한다
      timeKeyCount={session.benchPitchers.length}
      // 교체 창(상태 0xb) 동안은 "*MENU" · "#TIME" 을 안 그린다(0x4c8e0 의 상태 문턱 0xd ~ 0x15)
      isSubstitutionWindowOpen={change.changeWindow !== null}
      skillPanel={pitcherSkillPanelOf(model)}
    >
      {/* 돌발 띠 0x8e858 (0x4c4bc 4c522, 사람 수비 → 공 7) — 0xf 구질 목록이면 뒤의 빛 지도 4c5a6 이 같이 어둡게 한다 */}
      <BurstBand row={model.burstBandRow} role={model.burstBandRole} isDimmed={isBurstBandDimmed(model)} />
      {/* 0xe — 구질 고르기(0xf)는 OK 뒤다. 그 동안은 0xd 그리기 위에 투수·타자 소개 판 0x44944 (일시정지 창 아래에도 남는다 — 0x52efe 가 장면 그리기를 건너뛸 뿐이다) */}
      {shownMatchupCardsOf(model)}
      {/* 교체 연출 0x16 "CHANGE" (0x4da30) */}
      {substitutionOverlay}
      {inputSlots[0]}
      {inputSlots[1]}
      {inputSlots[2]}
    </PitcherSideStage>
  )
}
