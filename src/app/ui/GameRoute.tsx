import { useCallback, useState } from 'react'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

interface GameRouteProps {
  readonly session: ReturnType<typeof useCareerSession>
  readonly progress: GameProgress
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly career: PlayerCareer
}

/**
 * 나만의리그 경기 — 원작 로딩 화면(StrTIP)이 끝나면 타석으로.
 *
 * 인플레이 타구가 나오면 **수비 화면을 먼저 보여 준다**. 원본은 타구가 뜬 순간 경기 장면이
 * 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지 같은 루프를 돈다 (R10 · I 문서).
 * 웹은 진행기가 그 플레이를 통째로 계산해 두므로 여기서는 재생만 하고, 다 보면 타석으로 돌아간다.
 */
export function GameRoute({ session, progress, runner, random, career }: GameRouteProps) {
  /** 이미 다 보여 준 플레이 — 같은 플레이를 두 번 재생하지 않으려고 기억해 둔다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const play = progress.lastDefensePlay
  const finishPlayback = useCallback(() => setShownPlay(play), [play])

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

  return (
    <GameScreen
      career={career}
      progress={progress}
      atBat={runner.atBat}
      pitcherAbility={progress.aceOpponent === null ? DEFAULT_PITCHER_ABILITY : pitcherAbilityOf(progress.aceOpponent)}
      isPaused={runner.isPaused}
      bannerText={runner.bannerText}
      random={random}
      onPitchResolved={session.handlePitchResolved}
      onQuit={session.actions.quitGame}
    />
  )
}
