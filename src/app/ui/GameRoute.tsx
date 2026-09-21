import { useCallback, useState } from 'react'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { ScreenOverlay } from '@/shared/ui'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'

interface GameRouteProps {
  readonly session: ReturnType<typeof useCareerSession>
  readonly progress: GameProgress
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly career: PlayerCareer
  readonly gameSettings: ReturnType<typeof useGameSettings>
}

/**
 * 나만의리그 경기 — 원작 로딩 화면(StrTIP)이 끝나면 타석으로.
 *
 * 인플레이 타구가 나오면 **수비 화면을 먼저 보여 준다**. 원본은 타구가 뜬 순간 경기 장면이
 * 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지 같은 루프를 돈다 (R10 · I 문서).
 * 웹은 진행기가 그 플레이를 통째로 계산해 두므로 여기서는 재생만 하고, 다 보면 타석으로 돌아간다.
 *
 * 돌발미션이 발동하면 **타석 화면 위에** 창을 얹는다 (원본 상태 0x1b, K 4절 1-6).
 * 창이 떠 있는 동안 타석을 멈춰 둔다 — 원본도 장면 상태가 0xf 를 떠나 있어 투구가 나가지 않는다.
 */
export function GameRoute({ session, progress, runner, random, career, gameSettings }: GameRouteProps) {
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

  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.actions.finishLoading} />
      </RawScreen>
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
        pitcherAbility={progress.aceOpponent === null ? DEFAULT_PITCHER_ABILITY : pitcherAbilityOf(progress.aceOpponent)}
        isPaused={runner.isPaused || burstLines !== null}
        bannerText={runner.bannerText}
        random={random}
        onPitchResolved={session.handlePitchResolved}
        onQuit={session.actions.quitGame}
        onSteal={session.actions.stealBase}
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
