import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { missionOpponent, missionPitcherAbility } from '@/app/model/useMissionSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { MissionSelectScreen, MissionBriefing } from '@/pages/mission-select/ui/MissionSelectScreen'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchControl } from '@/entities/settings/model/gameSettings'

/** 원작 구질 선택은 다섯 자리다 (StrHOWTO <투구 조작>) */
const PITCHER_REPERTOIRE_SIZE = 5

interface MissionRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly ability: BatterAbility
  readonly pitchControl: PitchControl
}

/** 미션 모드 화면 분기. 진행 중인 미션이 없으면 선택 화면으로 되돌린다. */
export function MissionRoutes({
  screen,
  setScreen,
  session,
  runner,
  random,
  ability,
  pitchControl,
}: MissionRoutesProps) {
  const { missionRun, pitcherRun, actions } = session

  const selectScreen = (
    <MissionSelectScreen
      clearedKeys={session.clearedKeys}
      initialSide={session.lastSide}
      onSelect={(mission) => setScreen({ kind: '미션설명', mission })}
      onBack={() => setScreen({ kind: '메인메뉴' })}
    />
  )

  if (screen.kind === '미션설명') {
    return (
      <MissionBriefing
        mission={screen.mission}
        onStart={() => actions.begin(screen.mission)}
        onBack={() => setScreen({ kind: '미션선택' })}
      />
    )
  }

  // 이벤트 마선수 대결도 같은 타석 화면이다 — 끝나면 미션 목록 대신 결과 이벤트로 돌아간다
  if (screen.kind === '미션진행' || screen.kind === '마선수대결') {
    if (missionRun === null) return selectScreen
    return (
      <MissionPlayScreen
        run={missionRun}
        ability={ability}
        pitcherAbility={missionPitcherAbility(missionRun.mission)}
        opponent={missionOpponent(missionRun.mission)}
        atBat={runner.atBat}
        isPaused={runner.isPaused}
        bannerText={runner.bannerText}
        random={random}
        onPitchResolved={session.handleMissionPitch}
        onSteal={() => actions.steal(ability)}
        onGiveUp={actions.giveUpBatter}
        onFinish={screen.kind === '마선수대결' ? actions.finishAceMatch : actions.finishBatter}
      />
    )
  }

  if (screen.kind === '투수미션') {
    if (pitcherRun === null) return selectScreen
    return (
      <PitchingScreen
        run={pitcherRun}
        repertoire={PITCH_TYPES.slice(0, PITCHER_REPERTOIRE_SIZE)}
        usesGauge={pitchControl === '게이지'}
        atBat={runner.atBat}
        bannerText={runner.bannerText}
        onThrow={session.handleThrow}
        onGiveUp={actions.giveUpPitcher}
        onFinish={actions.finishPitcher}
      />
    )
  }

  return selectScreen
}
