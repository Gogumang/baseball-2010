import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { missionBatterSpecialSwingRemainingOf, missionOpponent, missionPitcherAbility } from '@/app/model/useMissionSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { MissionSelectScreen, MissionBriefing } from '@/pages/mission-select/ui/MissionSelectScreen'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import type { ModeBatter } from '@/app/model/modeBatter'
import { isModeMagicPitchType, modePitchMenuOf } from '@/app/model/modePitcher'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchControl } from '@/entities/settings/model/gameSettings'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { OriginalMission } from '@/shared/config/original/missions'

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
  const { missionRun, pitcherRun, actions } = session
  const { ability } = batter

  const overlay = missionOverlayOf(session)
  if (overlay !== null) return overlay

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
        onPitchResolved={(detail, _pitch, isUncatchable) => session.handleMissionPitch(detail, isUncatchable)}
        // 필살타법 — 나리 타자편 저장 선수의 번호(+0x18)와 이 미션 한 판의 남은 횟수 (0xaebe4 가 채운다)
        specialSwingNumber={batter.specialSwingNumber}
        specialSwingRemaining={missionBatterSpecialSwingRemainingOf(session.batterSpecialSwingStored, batter)}
        onSpecialSwingUsed={actions.specialSwingUsed}
        // 상대 마투수 마구 횟수 0xd8509[레벨] (타석 교대 0xaebe4) — 안 넘기면 늘 Lv1 의 3회다
        aceLevels={session.aceLevels}
        // CPU 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 미션(모드 6)에서도 돈다
        onPickoff={actions.cpuPickoff}
        // 도루 출발 (0x53610 → 0x583 → 0xa9bd4) — 판정은 공이 도착할 때 도루 판(종류 5)이 한다
        stealableBases={session.stealableBases}
        onSteal={actions.steal}
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
        // 미션 투수(나리 투수편 저장 · 명예 투수)의 구질 칸 0xb6d2c — `modePitcherOf` 를 세션이 들고 있다.
        // 칸 5 마구(+0x18 ≠ 0)는 이 미션 한 판의 남은 횟수 팀+0x28 (0xaebe4 가 0xd84ff[+0x18] 로 채운다)과 함께
        repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
        magicRemaining={session.pitcherMagicRemaining}
        isMagicType={isModeMagicPitchType}
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

/**
 * 공 사이에 끼어드는 화면 — 수비·벤치 클리어링·견제 재생. 없으면 null.
 *
 * **수비 화면(상태 0x17)이 먼저다.** 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라
 * 맞은 공은 0x11 → 0x13 → **늘 0x17** 로 간다 (`0xae5f0` = `movs r0,#0x17`, R10 8절 전이표).
 * 다 돌고 나서야 `0xae3e8` 이 다음 타석으로 보낸다 — 그 자리가 `finishDefensePlay` 다.
 *
 * 사람이 잡는 쪽(`side`)은 편에 따라 다르다: 타자 미션은 내가 공격(주루), 투수 미션은 내가 수비(송구).
 */
function missionOverlayOf(session: ReturnType<typeof useMissionSession>): ReactNode | null {
  const { pendingDefensePlay, actions } = session
  if (pendingDefensePlay !== null) {
    return (
      <DefensePlayback
        input={pendingDefensePlay.input}
        side={pendingDefensePlay.side === '투수' ? '수비' : '공격'}
        onDone={actions.finishDefensePlay}
      />
    )
  }

  // 투수 미션 사구 뒤 벤치 클리어링 연출(상태 0x1e) — 투수편 `PitcherGameScreen` 과 같은 위젯이다
  if (session.pendingBenchClearing !== null) {
    return <BenchClearingScene onDone={actions.finishBenchClearing} />
  }

  // CPU 견제 한 판 — 세션이 이미 다 돌려 먹였다. 화면은 재생만 한다 (나만의리그 `GameRoute` 의 lastDefensePlay 와 같은 꼴)
  if (session.pickoffReplay !== null) {
    return <DefensePlayback ticks={session.pickoffReplay.ticks} onDone={actions.finishPickoffReplay} />
  }
  return null
}

interface PitcherAceMatchRouteProps {
  /** SYS 8 이 고른 투수 미션 레코드 (team − 1, `aceMatchMissionOf(team, '투수')`) */
  readonly mission: OriginalMission
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly pitchControl: PitchControl
  /** 대결이 끝났다 — 저장 +0x177 의 결과 바이트 (이겼나) */
  readonly onFinish: (isWin: boolean) => void
}

/**
 * **투수편 마선수 대결 화면** — 투수편 라우트의 `renderAceMatch` 가 그린다.
 * 원본은 투수편 장면(0x106)을 떠나 미션 장면(모드 5)으로 가서 보통 투수 미션과 같은 투구 화면으로 던지고,
 * 끝나면 결과 화면에서 재도전 커서 없이(0x407f0 의 +0x176 갈래) 원래 모드로 돌아온다 (0x4b328 · 0x4090c).
 * 들어서면 `beginPitcherAceMatch` 로 미션을 세우고, 결과 [확인]에서 `finishPitcherAceMatch` 의 이겼나를 넘긴다.
 */
export function PitcherAceMatchRoute({ mission, session, runner, pitchControl, onFinish }: PitcherAceMatchRouteProps) {
  const beginRef = useRef(session.actions.beginPitcherAceMatch)
  beginRef.current = session.actions.beginPitcherAceMatch
  useEffect(() => {
    beginRef.current(mission)
  }, [mission])

  const overlay = missionOverlayOf(session)
  if (overlay !== null) return overlay

  // 미션을 세우기 전(첫 그림) — 아무것도 안 그린다
  const { pitcherRun, actions } = session
  if (pitcherRun === null || session.pitcherAceMatchMission !== mission) return null

  return (
    <PitchingScreen
      run={pitcherRun}
      repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
      magicRemaining={session.pitcherMagicRemaining}
      isMagicType={isModeMagicPitchType}
      usesGauge={pitchControl === '게이지'}
      atBat={runner.atBat}
      bannerText={runner.bannerText}
      onThrow={session.handleThrow}
      // ⚠️ 근사: 원본 경기 중 메뉴 나가기 0x40140 은 모드 5·6 이면 0xa5368(obj,0) 뒤 메인 메뉴(장면 0x103)로 간다 —
      //    +0x176 이 서 있을 때 어디로 가는지는 안 읽었다. 웹은 보통 미션처럼 '실패' 로 두어 패배 결과로 잇는다.
      onGiveUp={actions.giveUpPitcher}
      onFinish={() => {
        const isWin = actions.finishPitcherAceMatch()
        if (isWin !== null) onFinish(isWin)
      }}
    />
  )
}
