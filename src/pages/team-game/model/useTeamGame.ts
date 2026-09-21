import { useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  applyBatterOutcome,
  applyBatterPitch,
  availablePitchers,
  canOpenPitcherChange,
  changePitcher,
  closeBurstWindow,
  isBatterTurn,
  isPitchTurn,
  runAutoProgress,
  startTeamGame,
  stealableBases,
  stealBase,
  summaryOf,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  StealBase,
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
  /** `#` 로 투수 교체 화면(상태 0xb)을 열 수 있는가 — 벤치 투수가 있고 투구 전일 때만 */
  readonly canChangePitcher: boolean
  /** 지금 벤치에서 올릴 수 있는 우리 투수 칸 */
  readonly benchPitchers: readonly number[]
  /** 지금 도루를 걸 수 있는 루 ('3' 1루 · '2' 2루) */
  readonly stealableBases: readonly StealBase[]
  readonly actions: {
    /** 타석 화면이 판정한 공 하나 */
    readonly resolvePitch: (detail: PitchOutcomeDetail) => void
    /** 타석 결과를 통째로 (자동 소화·테스트용) */
    readonly applyOutcome: (outcome: AtBatOutcome) => void
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: TeamPitchInput) => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /** `#` 교체 화면에서 벤치 투수 칸을 고른다 (R4 1a·1c) */
    readonly changePitcher: (benchIndex: number) => void
    /** 도루 (메시지 0x583) — 대상 주자가 선 루 */
    readonly steal: (base: StealBase) => void
    /** 경기 중 메뉴 '*' 의 자동진행 — **비용 검사는 화면이 먼저 한다** */
    readonly autoProgress: () => void
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
      changePitcher: (benchIndex: number) =>
        setProgress((current) => changePitcher(current, benchIndex)),
      steal: (base: StealBase) => setProgress((current) => stealBase(current, base, random)),
      autoProgress: () => setProgress((current) => runAutoProgress(current, random)),
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
    canChangePitcher: canOpenPitcherChange(progress),
    benchPitchers: availablePitchers(progress),
    stealableBases: stealableBases(progress),
    actions,
  }
}

export type { StealBase, TeamGameOptions, TeamGameProgress, TeamGameSummary, TeamPitchInput }
