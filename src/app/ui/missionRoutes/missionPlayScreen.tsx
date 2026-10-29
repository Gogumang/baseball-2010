import type { ReactNode } from 'react'
import {
  missionBatterSpecialSwingRemainingOf,
  missionCpuMagicStateOf,
  missionMoundOpponent,
  missionMoundPitcherAbility,
  missionStageBatterOf,
} from '@/app/model/useMissionSession'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { missionCpuMoundPitcherEquipmentOf, missionCpuMoundPitcherSkinIndexOf } from '@/entities/mission/model/missionCpuTeam'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { missionBatterMatchupCardsOf } from '@/pages/mission-play/lib/missionMatchupCards'
import { missionBatterNameOf } from '@/app/ui/missionRoutes/missionNames'
import { resultBoardOf, BATTER_ACE_MATCH_FLAGS } from '@/app/ui/missionRoutes/resultBoard'
import type { MissionRouteView } from '@/app/ui/missionRoutes/missionRouteView'

/**
 * 타자 미션 · 이벤트 마선수 대결의 타석 화면 — 끝나면 미션 목록 대신 결과 이벤트로 돌아간다(대결).
 * `sceneBuntKind` 는 장면 +0xfdc 를 이 그림의 값으로 읽은 것이다
 */
export function missionPlayScreenOf(view: MissionRouteView, missionRun: MissionRun, sceneBuntKind: number): ReactNode {
  const {
    screen,
    session,
    runner,
    random,
    batter,
    hallOfFame,
    nari,
    gameSettings,
    gamePoint,
    actions,
    sceneBuntKindRef,
    runnerAnimationClockRef,
    skillPanelSceneRef,
    setPopupFrozen,
  } = view
  // 지금 사람 칸 타석의 타자 — 미션 타자 차례가 아니면 사람 칸 팀 마스터 줄(능력치 0xb6415 · 이름 · +0x14 스킬, 필살 0)
  const stageBatter = missionStageBatterOf(missionRun, batter)
  return (
    <MissionPlayScreen
      run={missionRun}
      ability={stageBatter.ability}
      batterSkillIds={stageBatter.skillIds}
      batterRecordSlot={stageBatter.recordSlot}
      // 타자 그림 · 손 — 지금 타자 레코드 +0xb (미션 타자 = 나리 저장 · 명예 기록, 마스터 차례 = 그 줄)
      {...(stageBatter.look === undefined ? {} : { batterLook: stageBatter.look })}
      batterName={stageBatter.name}
      // 상태 0xe 소개 판 0x44944 — CPU 마운드 · 지금 사람 칸 타자 레코드 (미션 타자는 줄 + 게이트 0xa5764 가 연 이 경기 줄)
      matchupCards={missionBatterMatchupCardsOf(
        missionRun,
        {
          name: missionBatterNameOf(session, hallOfFame, nari.타자, screen.kind === '마선수대결'),
          hand: (batter.look?.form ?? 0) & 1,
          ...(batter.recordLine === undefined ? {} : { recordLine: batter.recordLine }),
        },
        session.aceLevels,
      )}
      pitcherAbility={{
        ...missionMoundPitcherAbility(missionRun, session.aceLevels, session.opponentStaminaPercent),
        // 공이 손을 떠나며(0x3dec6 → 0xa5e14) 깎은 뒤 체력%를 놓기 0x4dc78 · 스윙 0xab214 가 본다
        staminaPercentAfterPitch: (pitchTypeNumber) => session.opponentStaminaPercentAfterPitch(missionRun, pitchTypeNumber),
      }}
      opponent={missionMoundOpponent(missionRun)}
      // 마운드 마스터 줄 +0x19 · +0x1a 니블 — 마투수 칸이면 없다 (0x47cc8 48138~4816a)
      pitcherEquipmentNibbles={missionCpuMoundPitcherEquipmentOf(missionRun.cpu)}
      pitcherSkinIndex={missionCpuMoundPitcherSkinIndexOf(missionRun.cpu)}
      atBat={runner.atBat}
      isPaused={runner.isPaused}
      bannerText={runner.bannerText}
      random={random}
      onPitchResolved={(detail, _pitch, isUncatchable, buntKind) => {
        sceneBuntKindRef.current = buntKind ?? 0
        // 0x3dfac 의 답(낫아웃이면 판정 칸을 지웠다) — 타석 화면이 0x12 틱 0 그림에 쓴다
        return session.handleMissionPitch(detail, isUncatchable, buntKind)
      }}
      // 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린다 (A-37)
      onContact={session.preRollContact}
      sceneBuntKind={sceneBuntKind}
      // 필살타법 — 나리 타자편 저장 선수의 번호(+0x18)와 이 미션 한 판의 남은 횟수 (0xaebe4 가 채운다)
      specialSwingNumber={stageBatter.specialSwingNumber}
      specialSwingRemaining={missionBatterSpecialSwingRemainingOf(session.batterSpecialSwingStored, stageBatter)}
      onSpecialSwingUsed={actions.specialSwingUsed}
      // 상대 마투수 마구 횟수 0xd8509[레벨] (타석 교대 0xaebe4) — 안 넘기면 늘 Lv1 의 3회다
      aceLevels={session.aceLevels}
      // CPU 팀 +0x28 · 공 +0x10 — 미션 한 판 내내 세션이 든다(0xaebe4 aeea8 은 음수일 때만 채운다). 화면이 다시 서도 다시 차지 않는다
      cpuMagic={missionCpuMagicStateOf(missionRun, session.aceLevels)}
      // CPU 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 미션(모드 6)에서도 돈다
      onPickoff={actions.cpuPickoff}
      // 도루 출발 (0x53610 → 0x583 → 0xa9bd4) — 판정은 공이 도착할 때 도루 판(종류 5)이 한다
      stealableBases={session.stealableBases}
      // 상태 0xe 주루 칸 — 루에 선 주자의 신원대로 (`missionRunnerRunAbilitiesOf`)
      runnerRunAbilities={session.missionRunnerRunAbilities}
      stealingFrom={session.stealingFrom}
      // 루상 마선수 주자 그림(0x35b94 · +0x1c) — 수비 판과 같은 `missionRunnerAcesOf`
      {...(session.missionRunnerAces === undefined ? {} : { runnerAces: session.missionRunnerAces })}
      // 투수 그리기 0x38d1c 의 지친 눈 — 마운드 체력% 0xaebb1 (마투수면 타석 화면이 거른다)
      pitcherStaminaPercent={session.opponentStaminaPercent}
      runnerAnimationClock={runnerAnimationClockRef}
      skillPanelScene={skillPanelSceneRef}
      onSteal={actions.steal}
      // 경기 중 "나가기" — 0x40140 이 0xa5368(…, 0) 뒤 곧장 메인 메뉴(결과 화면 없음). 마선수 대결도 플래그를 안 보고 같은
      // 길이다 — 진 결과 이벤트는 다음 타자편 105 진입이 띄운다 (파일 머리 "마선수 대결의 경기 중 나가기" 주석)
      onGiveUp={actions.quitBatterMission}
      onFinish={screen.kind === '마선수대결' ? actions.finishAceMatch : actions.finishBatter}
      // 결과 판 0x4a384(모드 5·6) — "예"는 같은 미션 곧바로 다시(0x140006c = 3)
      onRetry={actions.retryBatter}
      resultBoard={resultBoardOf(
        session,
        missionRun.mission,
        missionRun.status,
        gamePoint,
        screen.kind === '마선수대결' ? BATTER_ACE_MATCH_FLAGS : undefined,
      )}
      // 경기 중 메뉴 "다시하기" (StrGAME[7]) — 같은 미션을 처음부터 다시 세운다. 0x3c98e 는 g[0x11f] 를 안 보고 모드 5·6 이면
      // 장면 0x107 → 0x104 로 같은 미션을 다시 세운다 — g[0x11f] 는 아무도 안 내려 마선수 대결은 **같은 대결**로 다시 선다
      // (투수편 대결 `PitcherAceMatchRoute` 와 같다)
      onRestart={() => {
        if (screen.kind === '마선수대결') {
          const { kind: _kind, mission: _mission, ...pending } = screen
          actions.beginAceMatch(missionRun.mission, pending)
          return
        }
        actions.begin(missionRun.mission)
      }}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 상태 0xe — 새 타석마다 사람 OK 를 기다린다
      sceneConfirm={session.sceneConfirm}
      onSceneConfirm={session.confirmScene}
      substitutionScene={session.substitutionScene}
      // 하늘 줄 — 장면을 세울 때 한 번 굴린 구장 +0x10 (0x783b0 rand(0, 6))
      skyRow={session.skyRow}
      onPopupFrozenChange={setPopupFrozen}
      onSubstitutionSceneDone={session.finishSubstitutionScene}
    />
  )
}
