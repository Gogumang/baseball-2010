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

interface GameRouteProps {
  readonly session: ReturnType<typeof useCareerSession>
  readonly progress: GameProgress
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly career: PlayerCareer
}

/** 나만의리그 경기 — 원작 로딩 화면(StrTIP)이 끝나면 타석으로 */
export function GameRoute({ session, progress, runner, random, career }: GameRouteProps) {
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.actions.finishLoading} />
      </RawScreen>
    )
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
