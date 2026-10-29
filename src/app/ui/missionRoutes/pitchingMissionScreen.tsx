import type { ReactNode } from 'react'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { isModeMagicPitchType, modePitchMenuOf, modePitchSlotNumbersOf } from '@/app/model/modePitcher'
import { missionPitcherMatchupCardsOf } from '@/pages/mission-play/lib/missionMatchupCards'
import { pitchingStageOf } from '@/app/ui/missionRoutes/missionStage'
import { missionPitcherNameOf, missionCardPitcherOf } from '@/app/ui/missionRoutes/missionNames'
import { resultBoardOf } from '@/app/ui/missionRoutes/resultBoard'
import type { MissionRouteView } from '@/app/ui/missionRoutes/missionRouteView'

/** 투수 미션의 투구 화면 */
export function pitchingMissionScreenOf(view: MissionRouteView, pitcherRun: PitcherRun): ReactNode {
  const {
    session,
    runner,
    random,
    hallOfFame,
    nari,
    pitchControl,
    gameSettings,
    gamePoint,
    actions,
    skillPanelSceneRef,
    setPopupFrozen,
    pitchScene,
  } = view
  return (
    <PitchingScreen
      run={pitcherRun}
      // 미션 투수(나리 투수편 저장 · 명예 투수)의 구질 칸 0xb6d2c — `modePitcherOf` 를 세션이 들고 있다.
      // 칸 5 마구(+0x18 ≠ 0)는 이 미션 한 판의 남은 횟수 팀+0x28 (0xaebe4 가 0xd84ff[+0x18] 로 채운다)과 함께
      repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
      // 구질 키 0x534d8 이 고르는 칸 번호 (빈 칸을 걸러 낸 메뉴라 차례와 다를 수 있다)
      repertoireSlots={modePitchSlotNumbersOf(session.pitcher)}
      magicRemaining={session.pitcherMagicRemaining}
      isMagicType={isModeMagicPitchType}
      usesGauge={pitchControl === '게이지'}
      atBat={runner.atBat}
      bannerText={runner.bannerText}
      onThrow={session.handleThrow}
      // 타석 장면 — 마지막 공 · 마운드 미션 투수 · 지금 CPU 타자 (`PitcherSideStage`). 맞은 공의 0x11 끝 · 0x13 · 공 도착 판의
      // 0x12 틱 0 도 이 장면이 그린 뒤 수비 판(0x17)으로 넘긴다 (`useMissionPitchSceneBeforePlay`)
      stage={{ ...pitchingStageOf(session, pitcherRun), ...pitchScene.stage }}
      // 상태 0xe 소개 판 0x44944 — 미션 투수(줄 + 게이트 0xa5764 가 연 이 경기 줄) · 지금 CPU 타자
      matchupCards={missionPitcherMatchupCardsOf(pitcherRun, missionCardPitcherOf(session, missionPitcherNameOf(session, hallOfFame, nari.투수)))}
      // 조준(0x10)의 틱 0x39c5c — 투수 미션 흔들림은 경기 난수로 · CLR 은 0xf 진입을 다시
      onAimTick={session.aimTick}
      onReturnToPitchSelection={session.returnToPitchSelection}
      // 경기 중 메뉴 "나가기" — 보통 미션은 0x40140 이 0xa5368(…, 0) 뒤 곧장 메인 메뉴(결과 화면 없음, 모드 5·6 같은 갈래)
      onGiveUp={actions.quitPitcherMission}
      onFinish={actions.finishPitcher}
      // 결과 판 0x4a384(모드 5·6) — "예"는 같은 미션 곧바로 다시(0x140006c = 3)
      onRetry={actions.retryPitcher}
      resultBoard={resultBoardOf(session, pitcherRun.mission, pitcherRun.status, gamePoint)}
      // 경기 중 메뉴 "다시하기" (StrGAME[7]) — 같은 미션을 처음부터 다시 세운다
      onRestart={() => actions.begin(pitcherRun.mission)}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 사람 견제 '3'·'1'·'7' (0x53548 → 0x50f28) — 모드 5 도 막지 않는다 (`actions.pickoff` 주석)
      onPickoffKey={actions.pickoff}
      // st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 루에 안 그린다
      stealDisplay={session.pitcherStealDisplay}
      skillPanelScene={skillPanelSceneRef}
      // 상태 0xe — 새 타석마다 사람 OK 를 기다린다
      sceneConfirm={session.sceneConfirm}
      onSceneConfirm={session.confirmScene}
      substitutionScene={session.substitutionScene}
      // 하늘 줄 — 장면을 세울 때 한 번 굴린 구장 +0x10 (0x783b0 rand(0, 6))
      skyRow={session.skyRow}
      onPopupFrozenChange={setPopupFrozen}
      onSubstitutionSceneDone={session.finishSubstitutionScene}
      // 결과 판 0x4a384 의 배경 · 정산 효과(0x4ea0c 꼬리 — 모드를 안 가린다)는 경기 난수로
      random={random}
    />
  )
}
