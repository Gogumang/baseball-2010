import type { ReactElement } from 'react'
import { PitcherSideStage } from '@/widgets/batting-stage/ui/PitcherSideStage'
import { pitcherEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { ourBenchPitcherCountOf, pitcherSceneSkillPanelOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { pitcherMatchupCardsOf } from '@/pages/pitching/lib/pitcherMatchupCards'
import { pitcherSkyRowOf } from './pitcherBackdrop'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'
import { stageBatterOf } from './pitcherStageCast'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 작은 팀 로고 (team_logo_ini) — 팀 경기 HUD 와 같은 그림 */
const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)

/** 경기 장면 HUD 0x4c4bc(0x373d0) 재료 */
function pitcherHudOf(model: PitcherSceneModel) {
  const { options, session } = model.props
  const { progress } = session
  return {
    inning: progress.game.inning,
    half: progress.game.half,
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    balls: progress.atBat.balls,
    strikes: progress.atBat.strikes,
    // 붙든 삼진(0x12 대기)은 진입 3e1a6 이 이미 올린 아웃으로 그린다 (r298)
    outs: outsShownDuringResultWait(progress.game.outs, progress.pendingBenchClearing),
    bases: progress.game.bases,
    ourLogoUrl: smallLogoUrlOf(options.ourTeamId),
    opponentLogoUrl: smallLogoUrlOf(options.opponentTeamId),
    ourTeamId: options.ourTeamId,
    opponentTeamId: options.opponentTeamId,
    playerSide: progress.game.playerSide,
    // st[0x15 + i] — CPU 도루 출발 주자는 0xf 진입 전까지(공이 날거나 0x12 인 동안 포함) 루에 안 그린다
    hiddenRunnerBases: model.hiddenRunnerBases,
  }
}

/**
 * 마운드의 내 투수 — 폼 · 마구 · 손 · 장비 · 바탕 벌 · 체력.
 * 마운드 바탕 벌 = 피부 × 15 + 내 팀 (482c0~482fc → 0x793b0 의 794c2).
 * 강판 뒤(onMound 거짓)의 피부 0 은 화면에 안 나온다 — 원본 모드 3 은 강판(0x498d4 · 0x50794 → 0xc1b48) 뒤 경기 끝까지 0x21
 * 중계다(c1eac → 0xc1d38: 마운드가 내 선수가 아니면 자동). 0x21 그리기 0x4258c 는 타석 무대를 안 그리고 투수 · 타자 그림도
 * 모드 {1,2,8,9} 에서만이며, 0x21 의 마운드 다시 싣기(48526 0x47cc8)도 sim+0x9c(그 모드만 세움)일 때뿐이다(r309 직접 뜸).
 * 웹도 강판 뒤 `advance` 가 경기 끝까지 돌아 이 무대를 onMound 거짓으로 그리지 않는다. 0x47cc8(482c0~)은 0xd 진입 48e90 마다
 * 지금 마운드 투수로 다시 싣는다 — 사람 장면은 늘 내가 마운드라 내 피부다
 */
function moundPropsOf(model: PitcherSceneModel) {
  const { options, pitcherEquipmentLevels, pitcherSkinIndex = 0, session } = model.props
  const { progress } = session
  const isMyMound = progress.onMound
  return {
    pitcherForm: options.repertoire.form,
    pitcherMagicNumber: options.repertoire.magicNumber,
    // 내 투수 손 0xb63c0 = 폼 & 1 (마투수 아님)
    pitcherHand: pitcherHandOf(options.repertoire.form, false),
    // 내 투수가 마운드에 있을 때만 — 강판 뒤 마운드는 다른 투수다
    ...(pitcherEquipmentLevels === undefined || !isMyMound ? {} : { pitcherEquipment: pitcherEquipmentOf(pitcherEquipmentLevels) }),
    pitcherSkinIndex: isMyMound ? pitcherSkinIndex : 0,
    pitcherTeamIndex: options.ourTeamId,
  }
}

/** 던진 공 — 공 · 판정 · 0x12 길이 · CPU 스윙 · 맞은 공 장면 */
function thrownPitchPropsOf(model: PitcherSceneModel) {
  const { progress } = model.props.session
  const { pitcherHitScene } = model.holds
  return {
    pitch: progress.lastPitch,
    resolution: progress.lastResolution,
    resultTicks: model.wait.heldResultTicks,
    // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠으면 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다
    isJudgementCleared: progress.lastPitchJudgementCleared === true,
    cpuSwing: progress.lastCpuSwing ?? null,
    // CPU 타자가 맞힌 공 — 판정 틀까지 0x11, 이어 0x13 을 그리고 0x17 이 선 틀에 수비 판으로 넘긴다
    hitScene: pitcherHitScene.hitScene,
    onHitSceneEnd: pitcherHitScene.end,
    // 판정 틀의 메시지 0x11 굴림 묶음 — 0x13 그림의 파티클 굴림보다 앞 (A-37)
    onHitJudged: pitcherHitScene.judge,
  }
}

/** 돌발 제안 창 0x1b(그리기 0x4a198) · 강판 감독 대사 0x23(0x50828)은 HUD 0x4c4bc 를 안 부른다 — 결과 창 0x1d(0x4d1e0 → 0x4ce9c)는 부른다 */
const isHudOmittedOf = (model: PitcherSceneModel) =>
  (model.visibleBurstLines !== null && model.burst.resolution === null) || model.confirm.isManagerHookShown

/** 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 공격 측(st[9]) = 상대(CPU) 측 */
function skillPanelOf(model: PitcherSceneModel) {
  const { progress } = model.props.session
  return {
    entryKey: progress.sceneConfirm ?? null,
    attackSide: progress.game.playerSide === 0 ? 1 : 0,
    scene: model.setup.skillPanelSceneRef,
    ...pitcherSceneSkillPanelOf(progress),
  }
}

/** 0xf 구질 목록이면 뒤의 빛 지도 4c5a6 이 돌발 띠를 같이 어둡게 한다 */
const isBurstBandDimmed = (model: PitcherSceneModel) =>
  model.props.session.canPitch && !model.confirm.isAwaitingConfirm && !model.wait.isPitchSceneBusy && model.input.phase === '구질'

/** 0xe 소개 판 — 일시정지 창 아래에도 남는다(0x52efe 가 장면 그리기를 건너뛰어 마지막 그림(소개 판 포함)이 그대로다) */
function matchupCardsOf(model: PitcherSceneModel): ReactElement | false {
  const { pitcherName, matchupRecords, session } = model.props
  const isShown = model.confirm.isAwaitingConfirm && model.confirm.sceneConfirm.isInConfirmState
  return isShown && <SceneMatchupCards {...pitcherMatchupCardsOf(session.progress, pitcherName, matchupRecords)} />
}

/** 교체 연출 0x16 "CHANGE" (0x4da30) */
function substitutionOverlayOf(model: PitcherSceneModel): ReactElement | false {
  const { substitution } = model.confirm
  return substitution.isShown && <SubstitutionSceneOverlay key={substitution.serial} aceSlot={substitution.aceSlot} onDone={substitution.finish} />
}

/**
 * 사람 수비 타석 장면 — 원본은 240×320 경기 장면 한 장이다. HUD 는 장면의 0x4c4bc(0x373d0), 체력은 투수 위 지친 표시(0x38f68)가 그린다
 */
export function renderPitcherSideStage(model: PitcherSceneModel): ReactElement {
  const { options, settings, session } = model.props
  const { progress } = session
  const { confirm, backdrop } = model
  return (
    <PitcherSideStage
      isHudOmitted={isHudOmittedOf(model)}
      // 0xd 진입마다 투수 그림 객체를 상태 0 으로 (48ee4 — '#' 교체 창에서 곧장 선 0xe 는 0xd 가 없다)
      sceneDEntryMark={confirm.sceneConfirm.sceneDEntryMark}
      {...thrownPitchPropsOf(model)}
      hud={pitcherHudOf(model)}
      {...stageBatterOf(progress)}
      {...moundPropsOf(model)}
      warmCast={model.setup.stageWarmCast}
      // 타석 구장 +0x70 · 바닥 줄 +0xc — 셋업 0x39fdc 모드 3 갈래 (정산 배경과 같은 구장)
      stadium={backdrop.sceneStadium.stadium}
      fieldPalette={backdrop.grassPalette}
      // 하늘 줄 = 구장 +0x10 — 0x783b0 모드 3: 리그 날짜 g mod 6
      skyRow={pitcherSkyRowOf(options)}
      gameMode={PITCHER_CAREER_MODE}
      {...(settings === undefined ? {} : { isScoreboardOn: settings.isScoreboardOn })}
      isPaused={confirm.isAwaitingConfirm}
      isFrozen={model.isPitchInputPaused}
      inputOverlayRef={model.input.inputOverlayRef}
      // 0x38f68 — 마운드 투수 체력% 로 지친 표시(player_effect 애니 9 · 10). 강판 뒤 마운드는 다른 투수라 싣지 않는다
      pitcherStaminaPercent={progress.onMound ? staminaPercentOf(progress.stamina) : null}
      // 실투 "!" 0x38d1c 38ee0 — 놓기 0x4dc78 4deae (강판 뒤 마운드 공은 이 화면이 그리지 않는다)
      isMistakePitch={progress.lastPitchIsMistake === true}
      // "#TIME" 0x4c92e — 0x38984 는 모드 3 을 안 막는다('#' 가 강판 물음을 연다). n = 수비팀(우리)[+0x33] 벤치 투수 수
      timeKeyCount={ourBenchPitcherCountOf(progress)}
      skillPanel={skillPanelOf(model)}
    >
      {/* 돌발 띠 0x8e858 (0x4c4bc 4c522, 사람 수비 → 공 7) — 0xf 구질 목록이면 뒤의 빛 지도 4c5a6 이 같이 어둡게 한다 */}
      <BurstBand row={model.burstBandRow} role={burstBandRoleOf(progress.game.half, progress.game.playerSide)} isDimmed={isBurstBandDimmed(model)} />
      {matchupCardsOf(model)}
      {substitutionOverlayOf(model)}
    </PitcherSideStage>
  )
}
