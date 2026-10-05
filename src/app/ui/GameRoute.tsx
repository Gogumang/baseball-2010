import { useCallback, useState } from 'react'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { opponentPitcherAbilityOf } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { ScreenOverlay } from '@/shared/ui'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { TEAMS } from '@/shared/config/original/teams'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'

interface GameRouteProps {
  readonly session: ReturnType<typeof useCareerSession>
  readonly progress: GameProgress
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly career: PlayerCareer
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`). 마선수 대결의 상대 마투수가 능력치 배율
   * 0xd88aa(0xb6414 첫 단계 — 모드를 가리지 않는다)와 마구 횟수 0xd8509(0xaebe4)로 이 칸을 본다.
   * 안 넘기면 배율 없이 날 값이다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
}

/**
 * 나만의리그 경기 — 원작 로딩 화면(StrTIP)이 끝나면 타석으로.
 *
 * 인플레이 타구가 나오면 **수비 화면을 먼저 보여 준다**. 원본은 타구가 뜬 순간 경기 장면이
 * 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지 같은 루프를 돌며 **매 갱신 눌린 키를 읽는다**
 * (R10 · I 문서). 웹도 이제 같은 모양이다 — 진행기를 여기서 **실시간으로 한 틱씩** 돌리고
 * (`input` 갈래), 사람은 모드 4 에서 늘 공격이라 `side="공격"`(진루·귀루·슬라이딩)을 잡는다.
 * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
 * 홈런 비행처럼 조작할 것이 없는 장면만 예전대로 `ticks` 재생 갈래로 간다.
 *
 * 돌발미션이 발동하면 **타석 화면 위에** 창을 얹는다 (원본 상태 0x1b, K 4절 1-6).
 * 창이 떠 있는 동안 타석을 멈춰 둔다 — 원본도 장면 상태가 0xf 를 떠나 있어 투구가 나가지 않는다.
 */
export function GameRoute({ session, progress, runner, random, career, gameSettings, aceLevels }: GameRouteProps) {
  /** 이미 다 보여 준 플레이 — 같은 플레이를 두 번 재생하지 않으려고 기억해 둔다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const play = progress.lastDefensePlay
  const finishPlayback = useCallback(() => setShownPlay(play), [play])

  /** 제안 대사를 이미 보여 준 돌발 행. 판정은 진행기가 지워 주므로 여기서 셀 것이 없다 */
  const [shownProposal, setShownProposal] = useState<BurstMissionRow | null>(null)
  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  const proposal = burst !== null && burst.current !== null && burst.current !== shownProposal
    ? burst.current
    : null
  const closeProposal = useCallback(() => setShownProposal(proposal), [proposal])
  const { closeBurstResult } = session.actions
  /**
   * 경기 시작 인트로(상태 0xc) — 적재(상태 8, 웹은 로딩 팁) 끝에서 모드 1~4 만 온다. 타자편은 모드 4 라 선다.
   * 효과음 61 은 진입 예약음이라 세션이 로딩을 끝낼 때(`finishLoading`) 이미 낸다. 난수는 안 쓴다.
   */
  const [isIntroDone, setIntroDone] = useState(false)

  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.actions.finishLoading} />
      </RawScreen>
    )
  }
  if (!isIntroDone) {
    const side0Team = progress.game.playerSide === 0 ? progress.ourTeamId : progress.opponentTeamId
    const side1Team = progress.game.playerSide === 0 ? progress.opponentTeamId : progress.ourTeamId
    return (
      <GameIntro
        awayName={TEAMS[side0Team]?.name ?? ''}
        homeName={TEAMS[side1Team]?.name ?? ''}
        onDone={() => setIntroDone(true)}
      />
    )
  }
  // 사람이 주루를 잡는 갈래가 먼저다 — 진행 중인 타구가 있으면 그것을 실시간으로 돌린다
  if (progress.pendingDefensePlay !== null) {
    return (
      <DefensePlayback
        input={progress.pendingDefensePlay}
        side="공격"
        onDone={session.actions.finishDefensePlay}
      />
    )
  }
  if (play !== null && play !== shownPlay && play.ticks.length > 0) {
    return <DefensePlayback ticks={play.ticks} onDone={finishPlayback} />
  }

  // 결과가 먼저다 — 타석이 끝나며 난 판정을 보여 준 뒤에야 다음 타석 제안이 뜬다
  const burstRow = resolution?.row ?? proposal
  const burstLines =
    burst === null || burstRow === null ? null : ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null

  return (
    <>
      <GameScreen
        career={career}
        progress={progress}
        atBat={runner.atBat}
        // 지금 마운드의 상대 투수 — CPU 교체(0xac428)가 바꾸면 바뀐 투수가 던진다 (0xae83c).
        // 마선수 대결의 마투수는 0xb6414 첫 단계 `v · 0xd88aa[mgr[0x13a + 순번]] / 100` 을 먹는다
        pitcherAbility={progress.aceOpponent === null ? opponentPitcherAbilityOf(progress) : pitcherAbilityOf(progress.aceOpponent, aceLevels)}
        aceLevels={aceLevels}
        isPaused={runner.isPaused || burstLines !== null}
        bannerText={runner.bannerText}
        random={random}
        onPitchResolved={session.handlePitchResolved}
        onQuit={session.actions.quitGame}
        onSteal={session.actions.stealBase}
        // CPU 견제 (0x345fc 종류 4 → 0x34848) — 판은 위 재생 갈래(`lastDefensePlay`)로 보인다
        onPickoff={session.actions.cpuPickoff}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
      />
      {/* 돌발 창도 화면 위 덮개라 기둥 안에 가둔다 — 안 그러면 창 전체로 퍼진다 */}
      {burstLines !== null && (
        <ScreenOverlay>
        <BurstMissionWindow
          lines={burstLines}
          judgement={resolution?.judgement ?? null}
          onClose={resolution !== null ? closeBurstResult : closeProposal}
        />
        </ScreenOverlay>
      )}
    </>
  )
}
