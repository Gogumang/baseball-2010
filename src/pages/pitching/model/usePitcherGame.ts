import { useEffect, useMemo, useRef, useState } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  closeBurstWindow,
  closeManagerHookWindow,
  giveUpPitching,
  isPitchTurn,
  resolveDefensePlay,
  startPitch,
  startPitcherGame,
  summaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  PITCH_RELEASE_SOUND,
} from '@/features/play-at-bat/model/atBatSounds'
import { GAME_INTRO_SOUND, gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
// 진행 소리(공수 교대 13 · 돌발 42/36/37)는 팀경기와 같은 자리다 — 같은 경기 장면(0x104)이라
// 규칙도 하나다. 화면 두 곳이 같은 것을 두 번 적지 않게 팀경기 쪽 것을 그대로 빌려 쓴다.
import { stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
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
    /**
     * 구질·코스·게이지 칸을 정해 한 개 던진다.
     * 인플레이 타구가 되면 **거기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다.
     */
    readonly throwPitch: (input: PitchInput) => void
    /** 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`) */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
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

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 내면 StrictMode 가
   * 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()

  /** 진행 한 걸음을 먹이고, 그 사이에 원본이 내는 소리를 울린다 (팀경기 고리와 같은 모양) */
  const step = useMemo(() => {
    return (
      next: (current: PitcherGameProgress) => PitcherGameProgress,
      soundsOf?: (
        before: PitcherGameProgress,
        after: PitcherGameProgress,
      ) => readonly (number | null)[],
    ) => {
      const current = progressRef.current
      const after = next(current)
      if (after === current) return
      progressRef.current = after
      setProgress(after)
      playSoundIds(audio, [
        ...(soundsOf === undefined ? [] : soundsOf(current, after)),
        ...stepSoundIdsOf(current, after),
        // 승리 31 · 패배 32 징글 (상태 0x19 결과 적재 0x4ea0c). 무승부는 원본이 어느 쪽을 내는지
        // 문서에 없어 `gameResultSoundIdOf` 가 비워 둔다
        ...(after.game.isFinished && !current.game.isFinished
          ? [gameResultSoundIdOf(summaryOf(after).result)]
          : []),
      ])
    }
  }, [audio])

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148).
  // ⚠️ 웹에는 인트로 화면이 없어 **경기가 서는 자리**에 둔다 — 근사다
  useEffect(() => {
    playSoundIds(audio, [GAME_INTRO_SOUND])
    // 경기 한 판에 한 번 — 고리가 살아 있는 동안 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo(
    () => ({
      throwPitch: (input: PitchInput) =>
        step(
          (current) => startPitch(current, input, random),
          // 투구 순간 소리 12 (0x3f378) → 심판 콜(0x51a94). 통로가 하나라 뒤 소리가 앞을 끊는다.
          // ⚠️ 마구 갈래 28 은 안 이었다 — 이 자리가 던진 공이 마구인지 가를 칸이 없다
          (before, after) => {
            const resolution = after.lastResolution
            if (resolution === null) return [PITCH_RELEASE_SOUND]
            // 진행기가 타석이 끝나면 볼카운트를 새 타석으로 되돌리므로, 심판 콜이 보는
            // "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
            const nextAtBat = applyPitchResolution(before.atBat, resolution)
            return [
              PITCH_RELEASE_SOUND,
              pitchCallSoundIdOf(resolution, nextAtBat),
              // 인플레이 타구면 아웃 콜은 수비 화면이 끝난 뒤다
              after.pendingDefensePlay !== null || nextAtBat.outcome === null
                ? null
                : inPlayCallSoundIdOf(nextAtBat.outcome),
            ]
          },
        ),
      /**
       * **여기서야** 진루·아웃·실점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
       *
       * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
       * 붙들어 둔 상태를 푼다 — 안 그러면 다음 공이 영영 나가지 않는다.
       */
      finishDefensePlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingDefensePlay
        if (pending === null) return
        step(
          (current) => resolveDefensePlay(current, result ?? runDefensePlay(pending), random),
          // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·홈런 함성(11)은 여기서야 난다
          (before) =>
            before.atBat.outcome === null ? [] : [inPlayCallSoundIdOf(before.atBat.outcome)],
        )
      },
      giveUp: () => step((current) => giveUpPitching(current, random)),
      confirmManagerHook: () => step((current) => closeManagerHookWindow(current, random)),
      closeBurst: () => step((current) => closeBurstWindow(current)),
    }),
    [random, step],
  )

  const summary = useMemo(
    () => (progress.game.isFinished ? summaryOf(progress) : null),
    [progress],
  )

  return { progress, canPitch: isPitchTurn(progress), summary, actions }
}

/** 화면이 쓰는 타입을 한 번 더 내보낸다 — 앱이 진행기 경로를 몰라도 되게 한다 */
export type { PitchInput, PitcherGameOptions, PitcherGameProgress, PitcherGameSummary }
