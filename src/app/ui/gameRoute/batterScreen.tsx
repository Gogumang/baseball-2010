import type { ReactNode } from 'react'
import { opponentCpuMagicStateOf, opponentStaminaPercentAfterPitchOf, stageOpponentPitcherAbilityOf } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { ScreenOverlay } from '@/shared/ui'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { SceneCloudCountingSpan } from '@/widgets/batting-stage/model/useSceneCloudCountingSpan'
import type { GameRouteView } from '@/app/ui/gameRoute/useGameRouteState'

/** 타자 스킬 22 압도 — 0xa5e14 가 `0xb62b4(현재 타자, 22)` 면 투구 소모 ×2 (`useCareerSession` 과 같은 칸) */
const INTIMIDATE_SKILL_ID = 22

type BurstProgress = GameRouteView['burst']
type BurstRow = NonNullable<GameRouteView['proposal']>

/** 돌발 창 글 — 돌발 표의 그 행 */
function burstLinesOf(burst: BurstProgress, burstRow: BurstRow | null) {
  if (burst === null || burstRow === null) return null
  return ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null
}

/** 창에 띄울 행 — 결과가 먼저다(타석이 끝나며 난 판정을 보여 준 뒤에야 다음 타석 제안이 뜬다) */
function windowRowOf(resolution: GameRouteView['resolution'], proposal: BurstRow | null): BurstRow | null {
  return resolution?.row ?? proposal
}

/** 돌발 창 0x1b · 0x1d — 창 글(없으면 창이 없다)과 창 */
export function burstWindowOf(view: GameRouteView) {
  const { career, burst, resolution, proposal, closeBurstResult, closeProposal } = view
  const burstLines = burstLinesOf(burst, windowRowOf(resolution, proposal))
  if (burstLines === null) return { lines: burstLines, element: null }
  const burstWindow = (
    <BurstMissionWindow
      lines={burstLines}
      judgement={resolution?.judgement ?? null}
      row={resolution?.row ?? null}
      // 0xb63c0(지금 타자) — 모드 4 의 돌발은 사람 장면(내 타석)에서만 뜨므로 내 선수 손으로 본다(⚠️ 유력: 결과 창은 타석이 끝난 뒤다)
      isBatterLeftHanded={career.battingSide !== 0}
      onClose={resolution !== null ? closeBurstResult : closeProposal}
    />
  )
  return { lines: burstLines, element: burstWindow }
}

/** 돌발 띠 0x8e858 의 행 — [M+0xc] 는 판정 뒤에도 결과 창을 닫을 때(0x8e5b8 8e7ee~8e800)까지 남는다 */
function burstBandRowOf(burst: BurstProgress, resolution: GameRouteView['resolution']): BurstRow | null {
  return burst?.current ?? resolution?.row ?? null
}

export type GameBurstWindow = ReturnType<typeof burstWindowOf>

/**
 * 타석 화면 — 경기 장면의 기본 갈래. `sceneBuntKind` 는 장면 +0xfdc 를 이 그림의 값으로 읽은 것이다(타석 화면은 넘겨받은 값이 바뀐
 * 그림에서만 따라간다)
 */
export function batterScreenOf(view: GameRouteView, burstView: GameBurstWindow, sceneBuntKind: number): ReactNode {
  const {
    session,
    progress,
    runner,
    random,
    career,
    gameSettings,
    aceLevels,
    runnerAnimationClockRef,
    skillPanelSceneRef,
    burst,
    resolution,
    walkerSeats,
    reportAlertScene,
    recordAlert,
    handlePitchResolved,
  } = view
  const burstLines = burstView.lines
  const burstWindow = burstView.element
  /** 지금 마운드의 상대 투수 — 타석 화면과 마구 두 칸(`cpuMagic`)이 함께 본다 */
  const moundPitcher = stageOpponentPitcherAbilityOf(progress, aceLevels)
  return (
    <>
      <GameScreen
        career={career}
        progress={progress}
        walkerSeats={walkerSeats}
        atBat={runner.atBat}
        // 지금 마운드의 상대 투수 — CPU 교체(0xac428)가 바꾸면 바뀐 투수가 던진다 (0xae83c).
        // 마선수 대결의 마투수는 0xb6414 첫 단계 `v · 0xd88aa[mgr[0x13a + 순번]] / 100` 을 먹는다.
        // 마투수도 마운드 레코드 +0x2c 로 체력% 0xaebb0 을 낸다 — 피로 0xb58e6 · 제구 등급 지친 갈래 0xb74bc
        // 체력%는 공이 손을 떠나며(0x3dec6 → 0xa5e14) 깎은 뒤 값을 놓기 0x4dc78 · 스윙 0xab214 가 본다 — 압도 22 는
        // `handlePitchResolved` 의 `throwOpponentPitch` 와 같은 장착 비트다
        pitcherAbility={{
          ...moundPitcher,
          staminaPercentAfterPitch: opponentStaminaPercentAfterPitchOf(progress, {
            batterIntimidates: career.equippedSkillIds.includes(INTIMIDATE_SKILL_ID),
          }),
        }}
        aceLevels={aceLevels}
        // 수비 팀 +0x28 · 공 +0x10 — 경기 내내 진행기가 든다(0xaebe4 aeea8 은 음수일 때만 채운다). 화면이 다시 서도 다시 차지 않는다
        cpuMagic={opponentCpuMagicStateOf(progress, moundPitcher, aceLevels)}
        isPaused={runner.isPaused || burstLines !== null}
        bannerText={runner.bannerText}
        // 구장 하늘 줄 — 경기를 세울 때(0x783b0) 한 번 정했다
        skyRow={session.stadiumSkyRow}
        // 구장 객체 — 경기를 세울 때(0x39fdc 모드 4) 정했다
        sceneStadium={session.sceneStadium}
        random={random}
        onPitchResolved={handlePitchResolved}
        // 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린다 (A-37)
        onContact={session.preRollContact}
        sceneBuntKind={sceneBuntKind}
        runnerAnimationClock={runnerAnimationClockRef}
        skillPanelScene={skillPanelSceneRef}
        onQuit={session.actions.quitGame}
        onSteal={session.actions.stealBase}
        // CPU 견제 (0x345fc 종류 4 → 0x34848) — 판은 위 주자 판 갈래(`pendingRunnerPlay`)가 실시간으로 돌린다
        onPickoff={session.actions.cpuPickoff}
        // 사구 뒤 벤치 클리어링 연출(상태 0x1e)이 끝나면 사구를 먹인다
        onBenchClearingDone={session.actions.finishBenchClearing}
        // 필살 스윙 틱(0x4e136)의 남은 횟수 −1 — 경기 진행기가 든다
        onSpecialSwingUsed={session.actions.spendSpecialSwing}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        recordAlert={recordAlert}
        onRecordAlertSceneChange={reportAlertScene}
        // 돌발 띠 0x8e858 — [M+0xc] 는 판정 뒤에도 결과 창을 닫을 때(0x8e5b8 8e7ee~8e800)까지 남는다
        burstRow={burstBandRowOf(burst, resolution)}
        // 돌발 제안 창 0x1b 의 그리기 0x4a198 은 HUD 0x4c4bc 를 안 부른다 — 결과 창 0x1d(0x4d1e0 → 0x4ce9c)는 부른다
        isHudOmitted={burstWindow !== null && resolution === null}
      />
      {/* 돌발 창도 화면 위 덮개라 기둥 안에 가둔다 — 안 그러면 창 전체로 퍼진다 */}
      {burstWindow !== null && <ScreenOverlay>{burstWindow}</ScreenOverlay>}
      {/* 돌발 제안 0x1b · 타석 위 돌발 결과 0x1d 는 원본이 구름을 센다 — 아래 루프가 '대기' 가 아니어도 (Q-08) */}
      {burstWindow !== null && <SceneCloudCountingSpan />}
    </>
  )
}
