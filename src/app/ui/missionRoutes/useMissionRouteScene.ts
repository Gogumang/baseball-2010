import { useState } from 'react'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import type { Screen } from '@/app/model/screen'
import { useFreePassPlayStart } from '@/pages/defense/model/useFreePassPlayStart'
import { useHitByPitchWait } from '@/pages/defense/model/useHitByPitchWait'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import { DEFENSE_SCENE_START } from '@/pages/defense/lib/defenseHomeRunEffects'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import { createRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { createSkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useMissionPitchSceneBeforePlay } from '@/app/ui/missionRoutes/useMissionPitchSceneBeforePlay'
import { useMissionWalkerSeats } from '@/app/ui/missionRoutes/useMissionWalkerSeats'
import type { MissionRoutesProps } from '@/app/ui/missionRoutes/missionRoutesProps'

/** 미션 경기 장면 하나를 가리키는 진행 화면 칸 — 진행 화면(미션 · 투수 미션 · 대결)이 설 때마다 그 칸, 그 밖 화면에서는 앞 칸 그대로 */
function advancePlayScreen(previous: Screen | null, screen: Screen): Screen | null {
  const isPlayScreen = screen.kind === '미션진행' || screen.kind === '투수미션' || screen.kind === '마선수대결'
  return isPlayScreen ? screen : previous
}

type MissionSession = MissionRoutesProps['session']

/** 지금 장면의 판 — 투수 미션은 투수 판, 타자 미션 · 대결은 타자 판, 그 밖 화면은 없다 */
function playingRunOf(screen: Screen, session: MissionSession) {
  if (screen.kind === '투수미션') return session.pitcherRun
  if (screen.kind === '미션진행' || screen.kind === '마선수대결') return session.missionRun
  return null
}

/** 타자 미션의 사구 대기 — 투수 미션 몫은 투구 장면 쪽이 센다 (`useMissionPitchSceneBeforePlay`) */
function batterBenchHoldOf(session: MissionSession) {
  return session.pendingBenchClearing?.side === '타자' ? session.pendingBenchClearing : null
}

/** 미션 라우트의 훅 — 장면 칸 · 팝업 멈춤 · 밀어내기 · 사구 대기 · 장면 두 줄 (옛 차례 그대로) */
export function useMissionRouteScene({ screen, session }: Pick<MissionRoutesProps, 'screen' | 'session'>) {
  const { actions } = session
  /**
   * 미션 경기 장면 0x104 하나 — 미션 · 마선수 대결을 세울 때마다(`begin` · `beginAceMatch` 가 새 화면 칸을 세운다) 새로 만든다.
   * 이 라우트는 목록 · 설명 · 결과도 그려 마운트 수명이 장면보다 길다 — 진행 화면 칸이 바뀔 때 아래 칸들을 0 으로 둔다
   */
  const playScreen = useRenderMachine<Screen | null, Screen>(advancePlayScreen, screen)
  /** 미션 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, playScreen)
  /** 장면 +0xfdc — 타자 미션의 번트 · 스윙 키가 쓴다. 키 없는 공은 0(0x11 진입의 memset — `BattingStage.sceneBuntKind`) */
  const sceneBuntKindRef = useSceneScopedRef(0, playScreen)
  /** 장면 +0xf24 의 루상 주자 애니 0~2 — 미션 장면이 사는 동안 0x35b94 가 부를 때마다 돈다 (`RunnerAnimationClock`) */
  const runnerAnimationClockRef = useSceneScopedRef(createRunnerAnimationClock(), playScreen)
  /** 경기 스킬 표시 판의 함성 비트 칸 skin+0x44c(0x3301c 가 0x3ff) · 애니 7 · 8 — 미션 장면이 사는 동안 (`skillPanel`) */
  const skillPanelSceneRef = useSceneScopedRef(createSkillPanelScene(), playScreen)

  const playingRun = playingRunOf(screen, session)
  // 볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기(0x1f 틱) 뒤 판정 A 가 0x17 로 보낸다 — 그동안 타석 · 투구 화면을 둔다
  // 경기 중 메뉴 · 조작방법 · 설정(일시정지 팝업 0x741a0)이 떠 있으면 0x12 상태 틱이 멈춘다(0x52cc6) — 타석 · 투구 화면이 알린다
  const [isPopupFrozen, setPopupFrozen] = useState(false)
  /**
   * 지금 선수 고르기(하위 17)가 미션 목록 CLR 의 `[0x140006c] = 0x11` 로 장면을 새로 세운 것인가 — 생성자가 띠를 1 로 세웠다.
   * 메인 메뉴에서 들어오면 이 라우트가 새로 서므로 거짓에서 시작한다
   */
  const [isPickSceneRebuilt, setPickSceneRebuilt] = useState(false)
  const isFreePassReady = useFreePassPlayStart(session.pickoffReplay, session.pendingBenchClearing !== null, isPopupFrozen)
  const pitchScene = useMissionPitchSceneBeforePlay(session, isPopupFrozen)
  // 타자 미션 볼넷 · 사구 — 0x12 대기(판정 틀 T 다음 그림이 틱 0) 틱 31 의 4e74c 판정, 들어갔으면 다음 틀의 진입 0x3a5f0
  // (r298 — 모드 6 도 0x4e6d4 를 탄다). 타자편 `GameRoute` 와 같은 셈이다
  useHitByPitchWait({
    hold: batterBenchHoldOf(session),
    waitTicks: RESULT_WAIT_TICKS_AT_BAT_END,
    isFrozen: isPopupFrozen,
    random: session.random,
    onJudge: actions.judgeHitByPitch,
    onEnter: actions.enterBenchClearing,
  })
  const walkerSeats = useMissionWalkerSeats(session, playScreen, playingRun)
  return {
    playScreen,
    defenseSceneRef,
    sceneBuntKindRef,
    runnerAnimationClockRef,
    skillPanelSceneRef,
    playingRun,
    setPopupFrozen,
    isPickSceneRebuilt,
    setPickSceneRebuilt,
    isFreePassReady,
    pitchScene,
    walkerSeats,
  }
}

export type MissionRouteScene = ReturnType<typeof useMissionRouteScene>
