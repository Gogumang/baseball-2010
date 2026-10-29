import type { ReactElement } from 'react'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import {
  currentBatterAbility,
  currentBatterEntry,
  currentPitcherAbility,
  currentPitcherEquipment,
  currentPitcherSkinIndex,
  entryBatterSkillIdsOf,
  opponentMagicStateOf,
  runnerAcesFor,
  specialSwingRemainingAt,
} from '@/features/play-team-game/model/teamGameFlow'
import { teamBattingStageBatterOf } from '@/pages/team-game/lib/teamMatchupCards'
import { resultWaitTicksOf } from './otherSlices'
import { batterEquipmentPropsOf, stageHudOf } from './stageHud'
import { isHudOmittedOf, isStagePausedOf, shownMatchupCardsOf } from './stageOverlays'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 사람 타석의 공 판정 — 공 끝 대기를 판정 틀에 싣고 진행기에 넘긴다 */
function pitchResolvedHandlerOf(model: TeamGameSceneModel) {
  const { actions, progress } = model.props.session
  const { notePitchResolved } = model.confirmFlow.pitchEnd
  return (detail: PitchOutcomeDetail, _pitch: unknown, isUncatchable?: boolean, buntKind?: number) => {
    // 타석 공 하나가 판정됐다 — 공 끝은 0x12 문턱 갱신 0x4e796(15/31 틱 뒤) · 인플레이면 0x17 끝(수비 판이 풀릴 때).
    // 판정 틀에 싣고(진행기에 넘기기 전) 대기 틱은 이 공으로 끝난 타석 결과로 정한다 (`GameRoute` 와 같다)
    const outcomeAfter = applyPitchResolution(progress.atBat, detail.resolution).outcome
    notePitchResolved({ isHit: detail.resultCode !== null, waitTicks: resultWaitTicksOf(outcomeAfter) })
    const after = actions.resolvePitch(detail, isUncatchable, buntKind)
    // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠으면 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다
    return { judgementCleared: after.lastPitchJudgementCleared === true }
  }
}

/** 상대 마운드 — 투수 그리기 0x38d1c 의 지친 눈 · 장비 겹 · 바탕 벌 · 마투수 그림 */
function opponentMoundPropsOf(model: TeamGameSceneModel) {
  const { progress } = model.props.session
  const { opposingAcePitcher } = model
  return {
    // 투수 그리기 0x38d1c — 상대 마운드 체력% ≤ 34 면 지친 눈(38f68). 38f56 이 마선수면 거른다 — 마투수가 서 있으면 null
    pitcherStaminaPercent: opposingAcePitcher === null ? staminaPercentOf(progress.opponentStamina) : null,
    // 마운드 상대 투수 레코드 +0x19 · +0x1a 니블 → 장비 겹 (타석 교대 0x47cc8 의 48138~4816a, 마투수면 없음)
    pitcherEquipmentNibbles: currentPitcherEquipment(progress),
    // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(482c0~482fc → 0x793b0 의 794c2) — 사람 타석의 수비 팀 = 상대
    pitcherSkinIndex: currentPitcherSkinIndex(progress),
    pitcherTeamIndex: model.props.options.opponentTeamId,
    // 상대 팀 마투수(0xb88c8)가 교체로 올라오면 그림도 마선수 것이다
    acePitcher: opposingAcePitcher === null ? null : acePitcherFramesOf(opposingAcePitcher),
  }
}

/** 지금 타자 — 타석 그림 · 스킬 · 오늘 타석 결과 링 (명단 칸) */
function currentBatterPropsOf(model: TeamGameSceneModel) {
  const { progress } = model.props.session
  return {
    // 마타자가 대타로 올라오면 필살 연출 점프표(0xd01e4)가 이 순번을 본다
    aceBatterIndex: currentBatterEntry(progress)?.aceIndex ?? -1,
    // 타석 그림 0x10866 → 0x78fd8 — 선수 레코드 +0x19·+0x1a 장비 니블(부위 0~3 = 히트·파워·수비·주루 칸)로 장비 겹을
    // 고른다. 명단 칸이 니블을 들 때만(붙박이 표 선수) 넘긴다 — 니블 0 이면 원본도 그 부위를 안 그린다
    ...batterEquipmentPropsOf(currentBatterEntry(progress)?.equipment),
    // 지금 타자의 레코드 +0x14 장착 스킬(`TeamEntryBatter.skillBits` — 표 줄은 Xls 행, 영입 선수는 기록 사본, 마타자는 제 행)
    batterSkillIds: entryBatterSkillIdsOf(currentBatterEntry(progress)),
    // 투수 스킬 31 의 0xb6394 — 경기 시작 레코드 첨자 · 마타자 순번 (`TeamEntryBatter.recordSlot`)
    batterRecordSlot: currentBatterEntry(progress)?.recordSlot ?? 0,
    // 그 타순 칸의 오늘 타석 결과 링 — 공격 팀 + 타순(팀+0x32)×0x18 + 0x34 (0x445cc 4477a~4478c · 0xab214 aba8e~abaac).
    // 스윙 판정 0xab214 의 16 상승세 · 17 하락세와 스킬 판 비트 16 · 17 이 같은 링을 읽는다
    recentAtBatCodes: progress.ourEntryRecords[progress.game.battingOrderIndex]?.results ?? [],
  }
}

/** 사람 타석 장면 칸 — 번트 칸 · 스킬 판 · 하늘 줄 · 환경설정 */
function batterSceneSlotsOf(model: TeamGameSceneModel) {
  const { settings, session } = model.props
  const { progress } = session
  const { stadiumSkyRow } = model.backdrop
  return {
    // 장면 +0xfdc — CPU 타석(0x34436)과 사람 키가 같은 칸을 쓴다. 진행기가 공마다 든 값을 넘긴다
    sceneBuntKind: progress.sceneBuntKind ?? 0,
    // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람 팀이 공격 측(st[9])
    skillPanel: { entryKey: progress.sceneConfirm ?? null, attackSide: progress.game.playerSide, scene: model.scoped.skillPanelSceneRef },
    // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726) · 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
    isScoreboardOn: settings?.isScoreboardOn,
    isVibrationOn: settings?.isVibrationOn,
    // 구장 하늘 줄 — 경기 하나에 한 번(0x783b0). 수비 재생으로 화면이 다시 서도 같은 줄이다
    ...(stadiumSkyRow === null ? {} : { skyRow: stadiumSkyRow }),
  }
}

/** 사람 타석 장면 — 타석 화면(`widgets/batting-stage`, 상태 0xf~0x13) 위에 돌발 띠 · 소개 판 · 교체 연출 · 기록 알림 */
export function renderBattingScene(model: TeamGameSceneModel, substitutionOverlay: ReactElement | null, isPopupOpen: boolean): ReactElement {
  const { options, seasonStadium, random, session } = model.props
  const { progress, actions } = session
  const { backdrop, scoped, change } = model
  const { isMenuOpen } = model.sceneMenu
  return (
    <>
      <div className={stageScreen.canvasSlot}>
        <BattingStage
          isHudOmitted={isHudOmittedOf(model)}
          batterAbility={currentBatterAbility(progress)}
          // 타자 폼 rec[0xb] >> 4 · 피부 · 손 0xb63c0 (타석 교대 0x47d58~0x47dd6) — 몸통 · 자세표 · 배치 side 와 스윙 판정 0xab214 ·
          // CPU 투구의 타자 손. 마타자 손은 표 0xd88b0
          {...teamBattingStageBatterOf(progress)}
          {...currentBatterPropsOf(model)}
          {...batterSceneSlotsOf(model)}
          runnerAnimationClock={scoped.runnerAnimationClockRef}
          // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다. 마타자(0xb633c)면 위젯이 거른다
          canBunt
          // 팀 경기(모드 1·2·8·9)는 판정 묶음 '일반' — "내 선수" 보너스(모드 3·4)도 타자 미션 +100(모드 6)도 없다 (0xab214)
          swingMode="일반"
          // 타순 칸별 이 경기 남은 필살 횟수 s8 팀[+0x29 + 타순] (0xaea30) — 진행기가 든다. 0xaebe4 처럼 칸이 비면
          // 그 타자로 채운 값이다: 마타자 0xd84fa[레벨], 그 밖은 +0x18 == 0 이라 0 ('0' 키 무시, 0x51e14)
          specialSwingRemaining={specialSwingRemainingAt(progress, '우리')}
          onSpecialSwingUsed={(remaining) => actions.specialSwingUsed(remaining)}
          // "#TIME"(0x4c940) — 사람 공격이라 n = 벤치 타자 수 팀[+0x28c]. 팀 경기(모드 1·2·8·9)는 0x38984 가 통과한다
          timeKeyCount={progress.ourBenchBatters}
          // 교체 창(상태 0xb) 동안은 "*MENU" · "#TIME" 을 안 그린다(0x4c8e0 의 상태 문턱 0xd ~ 0x15)
          isSubstitutionWindowOpen={change.changeWindow !== null}
          gameMode={options.mode}
          pitcherAbility={currentPitcherAbility(progress)}
          hud={stageHudOf(progress, options)}
          // 루상 주자 0x35b94 — 주자 +0x9c ≠ −1(마선수)이면 타석 교대 0x483a0 이 +0x1c 에 실은 ace/defender 그림 (수비 판과 같은 값)
          runnerAces={runnerAcesFor(progress, true)}
          isEagleEyeEnabled={false}
          {...opponentMoundPropsOf(model)}
          // 다음 타자 · 대타 · 교체 투수를 미리 칠한다 — 원본은 타석 교대 0x47cc8 의 적재 때 칠해 첫 그림부터 제 색이다
          warmCast={model.warmCast.ourBattingWarmCast}
          // 시즌 홈경기에서만 차 있다 — 차 있으면 배경이 시즌 구장(0x77494)으로 갈린다
          seasonStadium={seasonStadium}
          {...backdrop.sceneryProps}
          // 상대 마투수의 마구 횟수 0xd8509[mgr[0x13a + 순번]] (0xaebe4) — 전역 마선수 레벨 칸
          aceLevels={options.aceLevels}
          // 상대 팀+0x28 과 공+0x10 은 진행기가 든다 — 공 객체는 경기에 하나라 사람 투구와 칸을 함께 쓴다
          cpuMagic={opponentMagicStateOf(progress)}
          // 0xe 에서는 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다. 일시정지 팝업(0x52cc6) · 교체 창(상태 0xb, 0x4db68 은
          // 장면을 그리기만 한다) 동안도 멈춘 채 선다 — 내렸다 다시 올리면 타석이 새로 서며 굴림이 샌다
          isPaused={isStagePausedOf(model) || isPopupOpen}
          // 좌우 이동 +0xfe4 는 0xd 진입 48f88 에서만 지운다 — 같은 타석의 다음 공(0xf)과 결과 연출 동안은 남는다(A-02)
          shiftResetSerial={model.confirmFlow.sceneConfirm.sceneDEntryMark}
          random={random}
          onPitchResolved={pitchResolvedHandlerOf(model)}
          // 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린다 (A-37)
          onContact={actions.preRollContact}
          flightProbeRef={scoped.flightProbeRef}
          // CPU 투수 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 루가 정해진 뒤는 진행기가 판을 돌린다
          onPickoff={(base) => actions.cpuPickoff(base)}
        />
      </div>
      {/* 타석 공용 그리기 0x4c4bc 4c510~4c524 — 점수판 바로 뒤 돌발 띠 0x8e858 (아이콘은 g[0x31 + 공격 측] 로 — 사람 공격이면 방망이 8) */}
      <BurstBand row={model.burstBandRow} role={model.burstBandRole} />
      {/* 0xe 그리기 0x4d9ec — 타석 장면 위에 투수·타자 소개 판 0x44944 (일시정지 창 아래에도 남는다 — 0x52efe 가 장면 그리기를 건너뛸 뿐이다) */}
      {shownMatchupCardsOf(model)}
      {/* 교체 연출 0x16 — 그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE" 를 얹는다 */}
      {substitutionOverlay}
      {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c — 그리기 표 다음(53066) · 팝업 0x746cd 앞. 교체 창(0xb) · 돌발 창 위,
        경기 중 메뉴 아래 */}
      <RecordAlertStageOverlay frame={model.recordAlert} isUnderMenu={isMenuOpen} />
    </>
  )
}
