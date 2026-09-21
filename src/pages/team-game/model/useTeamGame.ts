import { useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  applyBatterOutcome,
  applyBatterPitch,
  closeBurstWindow,
  isBatterTurn,
  isPitchTurn,
  startTeamGame,
  summaryOf,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
} from '@/features/play-team-game/model/teamGameFlow'

/**
 * 팀 경기 한 판을 들고 있는 상태 고리 (일반·시즌·대전 공용).
 *
 * 진행 규칙은 전부 `features/play-team-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다
 * (시즌 세션이 그렇게 쓴다 — `TeamGameScreen` 주석 참고).
 */
export interface TeamGameSession {
  readonly progress: TeamGameProgress
  /** 사람이 칠 차례인가 */
  readonly canBat: boolean
  /** 사람이 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: TeamGameSummary | null
  readonly actions: {
    /** 타석 화면이 판정한 공 하나 */
    readonly resolvePitch: (detail: PitchOutcomeDetail) => void
    /** 타석 결과를 통째로 (자동 소화·테스트용) */
    readonly applyOutcome: (outcome: AtBatOutcome) => void
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: TeamPitchInput) => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
  }
}

export function useTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameSession {
  const [progress, setProgress] = useState<TeamGameProgress>(() => startTeamGame(options, random))

  const actions = useMemo(
    () => ({
      resolvePitch: (detail: PitchOutcomeDetail) =>
        setProgress((current) => applyBatterPitch(current, detail, random)),
      applyOutcome: (outcome: AtBatOutcome) =>
        setProgress((current) => applyBatterOutcome(current, outcome, random)),
      throwPitch: (input: TeamPitchInput) =>
        setProgress((current) => throwPitch(current, input, random)),
      closeBurst: () => setProgress((current) => closeBurstWindow(current)),
    }),
    [random],
  )

  const summary = useMemo(
    () => (progress.game.isFinished ? summaryOf(progress) : null),
    [progress],
  )

  return {
    progress,
    canBat: isBatterTurn(progress),
    canPitch: isPitchTurn(progress),
    summary,
    actions,
  }
}

export type { TeamGameOptions, TeamGameProgress, TeamGameSummary, TeamPitchInput }
