import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { missionOpponent, missionPitcherAbility } from '@/app/model/useMissionSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { MissionSelectScreen, MissionBriefing } from '@/pages/mission-select/ui/MissionSelectScreen'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { ModeBatter } from '@/app/model/modeBatter'
import { modePitchMenuOf } from '@/app/model/modePitcher'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchControl } from '@/entities/settings/model/gameSettings'
import type { useGameSettings } from '@/app/model/useGameSettings'

interface MissionRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 치는 육성 타자 — 0xb6414 능력치와 장착 스킬 (`modeBatterOf`) */
  readonly batter: ModeBatter
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly pitchControl: PitchControl
}

/** 미션 모드 화면 분기. 진행 중인 미션이 없으면 선택 화면으로 되돌린다. */
export function MissionRoutes({
  screen,
  setScreen,
  session,
  runner,
  random,
  batter,
  pitchControl,
  gameSettings,
}: MissionRoutesProps) {
  const { missionRun, pitcherRun, pendingDefensePlay, actions } = session
  const { ability } = batter

  /**
   * **수비 화면(상태 0x17)이 먼저다.** 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라
   * 맞은 공은 0x11 → 0x13 → **늘 0x17** 로 간다 (`0xae5f0` = `movs r0,#0x17`, R10 8절 전이표).
   * 다 돌고 나서야 `0xae3e8` 이 다음 타석으로 보낸다 — 그 자리가 `finishDefensePlay` 다.
   *
   * 사람이 잡는 쪽(`side`)은 편에 따라 다르다: 타자 미션은 내가 공격(주루), 투수 미션은 내가 수비(송구).
   */
  if (pendingDefensePlay !== null) {
    return (
      <DefensePlayback
        input={pendingDefensePlay.input}
        side={pendingDefensePlay.side === '투수' ? '수비' : '공격'}
        onDone={actions.finishDefensePlay}
      />
    )
  }

  // CPU 견제 한 판 — 세션이 이미 다 돌려 먹였다. 화면은 재생만 한다 (나만의리그 `GameRoute` 의 lastDefensePlay 와 같은 꼴)
  if (session.pickoffReplay !== null) {
    return <DefensePlayback ticks={session.pickoffReplay.ticks} onDone={actions.finishPickoffReplay} />
  }

  const selectScreen = (
    <MissionSelectScreen
      clearedKeys={session.clearedKeys}
      clearCounts={session.clearCounts}
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
        batterSkillIds={batter.skillIds}
        pitcherAbility={missionPitcherAbility(missionRun.mission, session.aceLevels)}
        opponent={missionOpponent(missionRun.mission)}
        atBat={runner.atBat}
        isPaused={runner.isPaused}
        bannerText={runner.bannerText}
        random={random}
        onPitchResolved={session.handleMissionPitch}
        // 상대 마투수 마구 횟수 0xd8509[레벨] (타석 교대 0xaebe4) — 안 넘기면 늘 Lv1 의 3회다
        aceLevels={session.aceLevels}
        // CPU 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 미션(모드 6)에서도 돈다
        onPickoff={actions.cpuPickoff}
        onSteal={() => actions.steal(ability)}
        onGiveUp={actions.giveUpBatter}
        onFinish={screen.kind === '마선수대결' ? actions.finishAceMatch : actions.finishBatter}
        // 경기 중 메뉴 "다시하기" (StrGAME[7]) — 같은 미션을 처음부터 다시 세운다
        onRestart={() => actions.begin(missionRun.mission)}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
      />
    )
  }

  if (screen.kind === '투수미션') {
    if (pitcherRun === null) return selectScreen
    return (
      <PitchingScreen
        run={pitcherRun}
        // 미션 투수(나리 투수편 저장 · 명예 투수)의 구질 칸 0xb6d2c — `modePitcherOf` 를 세션이 들고 있다
        repertoire={modePitchMenuOf(session.pitcher)}
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
