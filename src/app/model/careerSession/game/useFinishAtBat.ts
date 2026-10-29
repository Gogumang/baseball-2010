import { useCallback } from 'react'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { useEndGame } from '@/app/model/careerSession/game/useEndGame'

/** 타석 끝 — 결과 배너를 `endFrames` 틀 띄우고, 경기가 끝났으면 정산으로 넘긴다 */
export type FinishAtBat = (advanced: GameProgress, outcome: AtBatOutcome, runnersOnBase: number, endFrames: number) => void

/**
 * 타석 하나가 경기 상태에 다 먹은 뒤 — 결과 배너를 띄우고, 경기가 끝났으면 정산으로 넘긴다.
 * 인플레이 타구는 **수비 화면이 끝난 뒤에야** 여기까지 온다.
 */
export function useFinishAtBat(scope: CareerScope): FinishAtBat {
  const { runner } = scope
  const endGame = useEndGame(scope)
  return useCallback(
    (advanced: GameProgress, outcome: AtBatOutcome, runnersOnBase: number, endFrames: number) => {
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase), endFrames, () => {
        if (!advanced.game.isFinished) {
          runner.setIsPaused(false)
          return
        }
        endGame(advanced)
      })
    },
    [endGame, runner],
  )
}
