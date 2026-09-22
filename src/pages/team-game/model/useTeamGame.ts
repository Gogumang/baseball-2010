import { useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  availablePitchers,
  canOpenPitcherChange,
  changePitcher,
  closeBurstWindow,
  isBatterTurn,
  isPitchTurn,
  resolveDefensePlay,
  runAutoProgress,
  startBatterOutcome,
  startBatterPitch,
  startTeamGame,
  startThrowPitch,
  stealableBases,
  stealBase,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  PendingDefensePlay,
  StealBase,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
} from '@/features/play-team-game/model/teamGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

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
  /**
   * **지금 실시간으로 돌려야 하는 타구** (원본 경기 상태 0x17). 차 있으면 화면은 타석·투구 대신
   * 수비 화면을 그리고, 다 돌면 `actions.finishDefensePlay` 로 결과를 넘긴다.
   * 이 칸이 차 있는 동안 `canBat`·`canPitch` 는 둘 다 거짓이라 다음 투구가 나가지 않는다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
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
    /**
     * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
     * **여기서야** 진루·아웃·득점이 경기 상태가 된다.
     *
     * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
     * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
     */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
  }
}

export function useTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameSession {
  const [progress, setProgress] = useState<TeamGameProgress>(() => startTeamGame(options, random))

  const actions = useMemo(
    () => ({
      // 인플레이 타구가 나오면 **여기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다 (상태 0x17)
      resolvePitch: (detail: PitchOutcomeDetail) =>
        setProgress((current) => startBatterPitch(current, detail, random)),
      applyOutcome: (outcome: AtBatOutcome) =>
        setProgress((current) => startBatterOutcome(current, outcome, random)),
      throwPitch: (input: TeamPitchInput) =>
        setProgress((current) => startThrowPitch(current, input, random)),
      closeBurst: () => setProgress((current) => closeBurstWindow(current)),
      changePitcher: (benchIndex: number) =>
        setProgress((current) => changePitcher(current, benchIndex)),
      steal: (base: StealBase) => setProgress((current) => stealBase(current, base, random)),
      autoProgress: () => setProgress((current) => runAutoProgress(current, random)),
      finishDefensePlay: (result?: DefensePlayResult) =>
        setProgress((current) => {
          const pending = current.pendingDefensePlay
          if (pending === null) return current
          // 결과를 못 받았으면 남은 틱을 여기서 끝까지 돌린다 — 붙든 상태는 반드시 푼다
          return resolveDefensePlay(current, result ?? runDefensePlay(pending.input), random)
        }),
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
    pendingDefensePlay: progress.pendingDefensePlay,
    actions,
  }
}

export type {
  PendingDefensePlay,
  StealBase,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
}
