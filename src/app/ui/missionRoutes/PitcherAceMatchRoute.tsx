import { useEffect, useRef, useState } from 'react'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { useFreePassPlayStart } from '@/pages/defense/model/useFreePassPlayStart'
import { DEFENSE_SCENE_START } from '@/pages/defense/lib/defenseHomeRunEffects'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import { isModeMagicPitchType, modePitchMenuOf, modePitchSlotNumbersOf } from '@/app/model/modePitcher'
import type { PitchControl } from '@/entities/settings/model/gameSettings'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionPitcherMatchupCardsOf } from '@/pages/mission-play/lib/missionMatchupCards'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { PITCHER_ACE_MATCH_FLAGS, resultBoardOf } from '@/app/ui/missionRoutes/resultBoard'
import { pitchingStageOf } from '@/app/ui/missionRoutes/missionStage'
import { missionCardPitcherOf } from '@/app/ui/missionRoutes/missionNames'
import { useMissionPitchSceneBeforePlay } from '@/app/ui/missionRoutes/useMissionPitchSceneBeforePlay'
import { missionOverlayOf } from '@/app/ui/missionRoutes/missionOverlay'

interface PitcherAceMatchRouteProps {
  /** SYS 8 이 고른 투수 미션 레코드 (team − 1, `aceMatchMissionOf(team, '투수')`) */
  readonly mission: OriginalMission
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly pitchControl: PitchControl
  /** 경기 중 메뉴 "설정" 칸 — App 이 환경설정을 넘긴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 대결이 끝났다 — 저장 +0x177 의 결과 바이트 (이겼나) */
  readonly onFinish: (isWin: boolean) => void
  /** 경기 중 "나가기" 0x40140 — 투수편 세션이 대결을 내려놓는다(대기 칸은 남는다). 메인 메뉴로는 미션 세션이 간다 */
  readonly onQuit: () => void
  /**
   * 던지는 나리 투수편 저장 선수의 이름 — 0x1fbd0 은 g[0x176] 이면 늘 [저장+0x3c] 선수다. 첫 0x18 판 PITCHER(0x420dc)가 쓴다.
   * 안 주면 그 판에 이름을 안 쓴다.
   */
  readonly pitcherName?: string | null
}

/**
 * **투수편 마선수 대결 화면** — 투수편 라우트의 `renderAceMatch` 가 그린다.
 * 원본은 투수편 장면(0x106)을 떠나 미션 장면(모드 5)으로 가서 보통 투수 미션과 같은 투구 화면으로 던지고,
 * 끝나면 결과 화면에서 재도전 커서 없이(0x407f0 의 +0x176 갈래) 원래 모드로 돌아온다 (0x4b328 · 0x4090c).
 * 들어서면 `beginPitcherAceMatch` 로 미션을 세우고, 결과 [확인]에서 `finishPitcherAceMatch` 의 이겼나를 넘긴다.
 */
export function PitcherAceMatchRoute({
  mission,
  session,
  runner,
  pitchControl,
  gameSettings,
  onFinish,
  onQuit,
  pitcherName,
}: PitcherAceMatchRouteProps) {
  const beginRef = useRef(session.actions.beginPitcherAceMatch)
  useMirrorRef(beginRef, session.actions.beginPitcherAceMatch)
  useEffect(() => {
    beginRef.current(mission)
  }, [mission])

  // 대결 하나 = 미션 장면 하나 (`beginPitcherAceMatch` 가 `mission` 마다 세운다)
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, mission)
  // 볼넷 · 사구 밀어내기 판은 0x12 대기(0x1f 틱) 뒤 — 보통 미션과 같다
  // 경기 중 메뉴 · 조작방법 · 설정(일시정지 팝업 0x741a0)이 떠 있으면 0x12 상태 틱이 멈춘다(0x52cc6) — 타석 · 투구 화면이 알린다
  const [isPopupFrozen, setPopupFrozen] = useState(false)
  const isFreePassReady = useFreePassPlayStart(session.pickoffReplay, session.pendingBenchClearing !== null, isPopupFrozen)
  const pitchScene = useMissionPitchSceneBeforePlay(session, isPopupFrozen)
  const overlay = missionOverlayOf({
    session,
    defenseScene: defenseSceneRef,
    playingRun: session.pitcherAceMatchMission === mission ? session.pitcherRun : null,
    bannerText: runner.bannerText,
    isFreePassReady,
    missionBatterName: null,
    missionPitcherName: pitcherName ?? null,
    pitchScene,
  })
  if (overlay !== null) return overlay

  // 미션을 세우기 전(첫 그림) — 아무것도 안 그린다
  const { pitcherRun, actions } = session
  if (pitcherRun === null || session.pitcherAceMatchMission !== mission) return null

  return (
    <PitchingScreen
      run={pitcherRun}
      repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
      repertoireSlots={modePitchSlotNumbersOf(session.pitcher)}
      magicRemaining={session.pitcherMagicRemaining}
      isMagicType={isModeMagicPitchType}
      usesGauge={pitchControl === '게이지'}
      atBat={runner.atBat}
      bannerText={runner.bannerText}
      onThrow={session.handleThrow}
      stage={{ ...pitchingStageOf(session, pitcherRun), ...pitchScene.stage }}
      // 상태 0xe 소개 판 0x44944 — 대결은 g[0x176] 이라 늘 나리 투수(0x1fbd0)
      matchupCards={missionPitcherMatchupCardsOf(pitcherRun, missionCardPitcherOf(session, pitcherName ?? null))}
      onAimTick={session.aimTick}
      onReturnToPitchSelection={session.returnToPitchSelection}
      // 경기 중 메뉴 나가기 0x40140 — +0x176 이 서 있어도 보통 미션과 같이 메인 메뉴(장면 0x103)로 간다(저장 없음). 진 결과
      // 이벤트는 다음 투수편 105 진입이 띄운다 (파일 머리 주석)
      onGiveUp={() => {
        onQuit()
        actions.quitPitcherMission()
      }}
      // 경기 중 메뉴 "다시하기"(0x3c706 → StrGAME[7] 예 → 하위 3 0x3c98e) — 0x3c98e 는 +0x176 을 안 보고 모드 5·6 이면
      // 0x140006c = 3 · 장면 0x107 로 간다. 0x107 진입 0x1d9a4 가 this+0x9c = 미션객체+0xbd 를 잡고 상태 3 0x1e908 이 그 미션을
      // 곧장 다시 세운다(장면 0x104). 대결의 +0xbd 는 SYS 8 이 g[0x175] 와 같은 team − 1 로 적었고(0x8d88a~0x8d890), g[0x176] 은
      // 아무도 안 내리므로 **같은 대결을 처음부터** 다시 치르고 끝나면 그대로 투수편으로 돌아간다
      onRestart={() => actions.beginPitcherAceMatch(mission)}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 마선수 대결도 미션 장면(모드 5)이라 사람 견제 길이 같다
      onPickoffKey={actions.pickoff}
      // st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 루에 안 그린다
      stealDisplay={session.pitcherStealDisplay}
      // 대결도 미션 장면이라 새 타석마다 0xe 에서 OK 를 기다린다
      sceneConfirm={session.sceneConfirm}
      onSceneConfirm={session.confirmScene}
      substitutionScene={session.substitutionScene}
      skyRow={session.skyRow}
      onPopupFrozenChange={setPopupFrozen}
      onSubstitutionSceneDone={session.finishSubstitutionScene}
      onFinish={() => {
        const isWin = actions.finishPitcherAceMatch()
        if (isWin !== null) onFinish(isWin)
      }}
      // 결과 판 0x4a384 — g[0x176] 이 서 있어 앞부분(띠 · YOU WIN/LOSE)만, G 보상 없음
      resultBoard={resultBoardOf(session, pitcherRun.mission, pitcherRun.status, undefined, PITCHER_ACE_MATCH_FLAGS)}
      // 대결도 정산 0x4ea0c 꼬리를 지난다 — 배경 · 정산 효과는 경기 난수로
      random={session.random}
    />
  )
}
