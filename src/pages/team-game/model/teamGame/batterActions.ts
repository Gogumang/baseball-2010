import { useMemo } from 'react'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { preRollContactMessage } from '@/features/defense-play/model/runDefensePlay'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { BATTER_PITCH_RESULT_ENTRY_TICKS } from '@/features/play-game/model/sceneTickSounds'
import {
  batterContactDefenseInputOf,
  cpuPickoff,
  spendOurSpecialSwing,
  startBatterOutcome,
  startBatterPitch,
  startSteal,
} from '@/features/play-team-game/model/teamGameFlow'
import type { StealBase } from '@/features/play-team-game/model/teamGameFlow'
import { arrivalCallSoundIdOf, pickoffCallSoundsOf } from './callSounds'
import { resultWaitTicksOf } from './otherSlices'
import type { StepSoundsOf, StepTimingOf, TeamActionContext } from './teamGameStep'

/**
 * 사람 타석 공의 소리 — 타구음(0x515de~)은 판정 틀이라 타석 화면이 이미 냈다(`contactSoundId` 는 비어 온다). 심판 콜(0x51a94)은 다음 틀
 * 0x12 진입 0x3dfac → 0xbba 다(`batterPitchTimingOf` — `BATTER_PITCH_RESULT_ENTRY_TICKS`). 인플레이 타구면 아웃 콜은 여기서 안 난다 —
 * 수비 화면이 끝난 뒤(`finishDefensePlay`)다
 */
function batterPitchSoundsOf(detail: PitchOutcomeDetail): StepSoundsOf {
  return (before, after) => {
    // 진행기가 타석이 끝나면 볼카운트를 바로 새 타석으로 되돌리므로(`finishBatterOutcome`),
    // 심판 콜이 보는 "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
    const nextAtBat = applyPitchResolution(before.atBat, detail.resolution)
    return [
      pitchCallSoundIdOf(detail.resolution, nextAtBat),
      // 공 도착 0x3dfac 가 연 도루·폭투 판의 판정 콜(도루 17 · 62/20, 폭투 17) — 원본은 판 안의 그 틱에 낸다.
      // 재생할 판은 재생 화면이 기록된 틱에, 재생하지 않는 판만 판을 연 이 자리에서 낸다 (`arrivalCallSoundIdOf`)
      arrivalCallSoundIdOf(before, after),
      after.pendingDefensePlay !== null || nextAtBat.outcome === null ? null : inPlayCallSoundIdOf(nextAtBat.outcome),
    ]
  }
}

/**
 * 같은 타석 다음 공이면 진행기가 이 걸음에 0xf 진입 0x3d954(CPU 투수 교체 22)까지 돈다 — 원본은 0x12 틱 0 에서 문턱 갱신 0x4e6d4 가
 * 예약한 다음 틀이다(사람이 던진 공의 `pitchSelectionEntryDelayTicksOf` 와 같은 셈)
 */
function batterPitchTimingOf(detail: PitchOutcomeDetail): StepTimingOf {
  return (before) => ({
    releaseSoundId: detail.contactSoundId ?? null,
    resultEntryTicks: BATTER_PITCH_RESULT_ENTRY_TICKS,
    pitchSelectionTicks: BATTER_PITCH_RESULT_ENTRY_TICKS + resultWaitTicksOf(applyPitchResolution(before.atBat, detail.resolution).outcome) + 1,
  })
}

/** 사람이 칠 차례의 손잡이 — 타석 화면이 판정한 공 · 맞은 판정 틀 · 필살 스윙 · 도루 · CPU 견제 */
export function useBatterActions({ step, random, progressRef }: TeamActionContext) {
  return useMemo(
    () => ({
      // 인플레이 타구가 나오면 **여기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다 (상태 0x17)
      preRollContact: (detail: PitchOutcomeDetail, buntKind: number) => {
        const input = batterContactDefenseInputOf(progressRef.current, detail, random, { buntKind })
        return input === null ? null : preRollContactMessage(input)
      },
      resolvePitch: (detail: PitchOutcomeDetail, isUncatchable?: boolean, buntKind?: number) =>
        step(
          // 판정 11(2스트라이크 번트 파울)은 파울 각 공 판이 판 끝 결과 코드 11 로 낸다(콜 62 는 판 결과 `played.buntFoulOut`).
          // 번트 종류(장면 +0xfdc)는 타구 판 리드(0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더하는 데 쓴다
          (progress) => startBatterPitch(progress, detail, random, { isUncatchable: isUncatchable === true, buntKind: buntKind ?? 0 }),
          batterPitchSoundsOf(detail),
          batterPitchTimingOf(detail),
        ),
      applyOutcome: (outcome: AtBatOutcome) =>
        step(
          (progress) => startBatterOutcome(progress, outcome, random),
          (_before, after) => (after.pendingDefensePlay !== null ? [] : [inPlayCallSoundIdOf(outcome)]),
        ),
      // CPU 견제(사람 공격) — 판을 붙들고 수비 화면이 실시간으로 돌린다(사람 주루 키 0x5331c · OK 슬라이딩 0x585). 콜은 판 끝에 낸다
      cpuPickoff: (base: PickoffBase) => step((progress) => cpuPickoff(progress, base, random, true), pickoffCallSoundsOf),
      specialSwingUsed: (remaining: number) => step((progress) => spendOurSpecialSwing(progress, remaining)),
      // 도루 출발 — 주자를 출발시키고 0x583 의 CPU 송구 결정 0xafa60 한 번(앞 판 수비가 공을 쥐었을 때만 굴림). 판정은 공이 도착할 때 도루 판(종류 5)이 한다
      steal: (base: StealBase) => step((progress) => startSteal(progress, base, random)),
    }),
    [step, random, progressRef],
  )
}
