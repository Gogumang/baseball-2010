import { useMemo } from 'react'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { deepHitCheerSoundIdOf, inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { recordDrawnTeamFieldingErrors, resolveDefensePlay, resolveRunnerPlay } from '@/features/play-team-game/model/teamGameFlow'
import type { PendingDefensePlay } from '@/features/play-team-game/model/teamGameFlow'
import { arrivalCallSoundIdOf } from './callSounds'
import type { StepSoundsOf, TeamActionContext } from './teamGameStep'

/**
 * 판 끝 근사 소리 — 판정 콜(결과 메시지 0xbba → 0x51a56: 7 → 25 · 8/12 → 11 · 9 → 17 · 11 → 62 · 13 → 62/20)과 깊은 낙구 함성 60(52b62)은
 * 원본처럼 판 안의 그 틱에 화면이 냈다(`DefensePlayback` 의 `tickSounds`). 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 근사로 낸다 —
 * **수비 결과를 함께 넘겨야** 원본이 보는 칸(state[0x1f])과 세이프 갈래가 열린다(`inPlayCallSoundIdOf` 둘째 인자)
 */
function defensePlayEndSoundsOf(pending: PendingDefensePlay, played: DefensePlayResult, result: DefensePlayResult | undefined): StepSoundsOf {
  return () => {
    if (result !== undefined) return []
    return [
      deepHitCheerSoundIdOf({
        outcome: pending.outcome,
        carryDistance: carryDistanceOf(pending.input.trajectory),
        caughtOnTheFly: played.caughtOnTheFly,
        // 파울로 닫힌 판에는 60 이 없다 — 콜은 결과 코드 7 메시지 51c5c 의 25 하나(`inPlayCallSoundIdOf` 의 `foulEnded`)
        foulEnded: played.foulEnded,
      }),
      // 판정 11(2스트라이크 번트 파울) — 판 끝 결과 코드가 낸다(`played.buntFoulOut`). 아웃 콜은 조건 없이 62 (0x51b20)
      inPlayCallSoundIdOf(pending.outcome, played),
    ]
  }
}

/** 실시간 판(타구 · 주자)이 끝난 뒤의 손잡이 — 화면이 결과를 못 넘겼으면 키 없이 끝까지 돌려서라도 붙든 상태를 푼다 */
export function usePlayEndActions({ step, random, progressRef, setProgress }: TeamActionContext) {
  return useMemo(
    () => ({
      finishRunnerPlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingRunnerPlay
        if (pending == null) return
        const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
        step(
          (progress) => resolveRunnerPlay(progress, played, random),
          // 판정 콜(도루 · 폭투 · 견제)은 원본처럼 판 안의 그 틱(결과 메시지 0xbba → 0x51a56)에 화면이 냈다
          // (`LiveRunnerPlayback` 의 `playRunnerTickSounds`). 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 낸다
          (before, after) =>
            result !== undefined
              ? []
              : [
                  arrivalCallSoundIdOf(before, after),
                  pending.kind === 'pickoff' && isPickoffPlayResult(played) ? pickoffCallSoundIdOf(played) : null,
                ],
        )
      },
      recordFieldingErrors: (errors: readonly DrawnFieldingError[]) => {
        // 소리 · 난수 없음 — 기록 재료만 얹는다
        const progress = progressRef.current
        const after = recordDrawnTeamFieldingErrors(progress, errors)
        if (after === progress) return
        progressRef.current = after
        setProgress(after)
      },
      finishDefensePlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingDefensePlay
        if (pending === null) return
        // 결과를 못 받았으면 남은 틱을 여기서 끝까지 돌린다 — 붙든 상태는 반드시 푼다
        const played = result ?? runDefensePlay(pending.input)
        step((progress) => resolveDefensePlay(progress, played, random), defensePlayEndSoundsOf(pending, played, result))
      },
    }),
    [step, random, progressRef, setProgress],
  )
}
