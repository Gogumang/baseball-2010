import { useMemo } from 'react'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { deepHitCheerSoundIdOf, inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { recordDrawnPitcherFieldingErrors, resolveDefensePlay, resolveRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherActionContext, StepSoundsOf } from './pitcherGameStep'

type PendingDefensePlay = NonNullable<PitcherGameProgress['pendingDefensePlay']>

/**
 * 판 끝 근사의 콜은 **수비 결과를 함께 넘겨야** 원본이 보는 칸(state[0x1f])과 세이프 갈래가 열린다 (`atBatSounds.inPlayCallSoundIdOf` 둘째 인자).
 * 파울 각 공 판은 타석 칸에 결과가 없다(타석이 아직 안 끝났다) — 파울로 닫히면 결과 코드 7 메시지 51c5c 의 25, 낙구 전에 잡히면(파울 뜬공
 * 아웃) 판 끝 정산의 아웃 콜이다(`inPlayCallSoundIdOf` 는 `played.outcome` 을 먼저 본다). 판정 콜 · 깊은 낙구 함성 60 은 원본처럼 판 안의
 * 그 틱에 화면이 냈다(`DefensePlayback` 의 `tickSounds` — 결과 메시지 0xbba → 0x51a56 · 슬롯 2 꼬리 52b62). 화면이 결과를 못 넘겨 여기서
 * 돌린 판만 판 끝에 근사로 낸다
 */
function defensePlayEndSoundsOf(pending: PendingDefensePlay, played: DefensePlayResult, result: DefensePlayResult | undefined): StepSoundsOf {
  return (before) => {
    if (result !== undefined) return []
    const outcome = before.atBat.outcome ?? played.outcome ?? pending.outcome
    return [
      deepHitCheerSoundIdOf({
        outcome,
        carryDistance: carryDistanceOf(pending.trajectory),
        caughtOnTheFly: played.caughtOnTheFly,
        foulEnded: played.foulEnded,
      }),
      inPlayCallSoundIdOf(outcome, played),
    ]
  }
}

/** 판정 콜(도루 · 폭투 · 견제) — 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 낸다(새로 연 공 도착 판의 콜 · 견제 콜) */
function runnerPlayEndSoundsOf(pendingKind: string, played: DefensePlayResult, result: DefensePlayResult | undefined): StepSoundsOf {
  return (before, after) => {
    if (result !== undefined) return []
    const arrival = after.lastArrivalPlay
    return [
      arrival !== null && arrival !== before.lastArrivalPlay ? arrival.callSoundId : null,
      pendingKind === 'pickoff' && isPickoffPlayResult(played) ? pickoffCallSoundIdOf(played) : null,
    ]
  }
}

/** 실시간 판(타구 · 주자)이 끝난 뒤의 손잡이 — 화면이 결과를 못 넘겼으면 키 없이 끝까지 돌려서라도 붙든 상태를 푼다 */
export function usePlayEndActions({ step, random, progressRef, setProgress }: PitcherActionContext) {
  return useMemo(
    () => ({
      /**
       * **여기서야** 진루·아웃·실점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다. 화면이 결과를 안 넘겨 주는 경우
       * (재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도 붙들어 둔 상태를 푼다 — 안 그러면 다음 공이 영영 나가지 않는다.
       */
      finishDefensePlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingDefensePlay
        if (pending === null) return
        const played = result ?? runDefensePlay(pending)
        step((progress) => resolveDefensePlay(progress, played, random), defensePlayEndSoundsOf(pending, played, result))
      },
      recordFieldingErrors: (errors: readonly DrawnFieldingError[]) => {
        // 소리 · 난수 없음 — 기록 재료만 얹는다
        const progress = progressRef.current
        const after = recordDrawnPitcherFieldingErrors(progress, errors)
        if (after === progress) return
        progressRef.current = after
        setProgress(after)
      },
      // 판정 콜은 원본처럼 판 안의 그 틱(결과 메시지 0xbba → 0x51a56)에 화면이 냈다 (`LiveRunnerPlayback` 의 `playRunnerTickSounds`)
      finishRunnerPlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingRunnerPlay
        if (pending == null) return
        const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
        step((progress) => resolveRunnerPlay(progress, played, random), runnerPlayEndSoundsOf(pending.kind, played, result))
      },
    }),
    [step, random, progressRef, setProgress],
  )
}
