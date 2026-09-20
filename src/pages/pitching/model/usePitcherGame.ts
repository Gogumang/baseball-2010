import { useMemo, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  closeBurstWindow,
  closeManagerHookWindow,
  giveUpPitching,
  isPitchTurn,
  startPitcherGame,
  summaryOf,
  throwPitch,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitchInput,
  PitcherGameOptions,
  PitcherGameProgress,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 투수편 경기 한 판을 들고 있는 상태 고리.
 *
 * 진행 규칙은 전부 `features/play-pitcher-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다.
 */
export interface PitcherGameSession {
  readonly progress: PitcherGameProgress
  /** 지금 사람이 공을 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: PitcherGameSummary | null
  readonly actions: {
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: PitchInput) => void
    /** `#` 스스로 강판 (StrGAME[104] 에 "예") */
    readonly giveUp: () => void
    /** 감독 대사 창(0x23) 확인 */
    readonly confirmManagerHook: () => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
  }
}

export function usePitcherGame(
  options: PitcherGameOptions,
  random: RandomPort,
): PitcherGameSession {
  const [progress, setProgress] = useState<PitcherGameProgress>(() =>
    startPitcherGame(options, random),
  )

  const actions = useMemo(
    () => ({
      throwPitch: (input: PitchInput) =>
        setProgress((current) => throwPitch(current, input, random)),
      giveUp: () => setProgress((current) => giveUpPitching(current, random)),
      confirmManagerHook: () =>
        setProgress((current) => closeManagerHookWindow(current, random)),
      closeBurst: () => setProgress((current) => closeBurstWindow(current)),
    }),
    [random],
  )

  const summary = useMemo(
    () => (progress.game.isFinished ? summaryOf(progress) : null),
    [progress],
  )

  return { progress, canPitch: isPitchTurn(progress), summary, actions }
}

/** 화면이 쓰는 타입을 한 번 더 내보낸다 — 앱이 진행기 경로를 몰라도 되게 한다 */
export type { PitchInput, PitcherGameOptions, PitcherGameProgress, PitcherGameSummary }
