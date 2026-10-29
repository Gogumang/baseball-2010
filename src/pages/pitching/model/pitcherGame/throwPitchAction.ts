import { useMemo } from 'react'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf, walkCheerSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'
import { resultEntryStepTimingOf, scheduleSceneFrameUpdate } from '@/features/play-game/model/sceneTickSounds'
import type { PitchStepSoundTiming } from '@/features/play-game/model/sceneTickSounds'
import { enterPitchResult, startPitch } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitchInput, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { pitchResultEntryDelayTicksOf, pitchSelectionEntryDelayTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { arrivalCallSoundIdOf } from './callSounds'
import { resultWaitTicksOf } from './otherSlices'
import type { PitcherActionContext, StepSoundsOf } from './pitcherGameStep'

/**
 * 투구 순간 소리 12 / 마구 28 (0x3f378 — 놓는 틀). 내 투수는 육성(rec+0xa 비트7)이라 0xb633d 가 거짓 — 구질 22 일 때만 28.
 * 심판 콜은 0x12 진입 틀(놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤 — 삼진 진동과 같은 틀), 0xf 진입 CPU 대타 22 는
 * 0x12 문턱 뒤 0xf 틀이다(`PitchStepSoundTiming`). 원본은 그 사이 공이 날아가 두 소리가 다 들린다
 */
function releaseTimingOf(input: PitchInput, stepBefore: PitcherGameProgress, after: PitcherGameProgress): PitchStepSoundTiming {
  const frameCount = after.lastPitch?.frameCount ?? 0
  const resolution = after.lastResolution
  const outcome = resolution === null ? null : applyPitchResolution(stepBefore.atBat, resolution).outcome
  return {
    releaseSoundId: pitchReleaseSoundIdOf({
      typeNumber: input.typeNumber,
      pitcherMagicNumber: after.lastPitch?.pitcherMagicNumber ?? 0,
      ballMagicNumber: after.lastPitch?.magicNumber ?? 0,
    }),
    resultEntryTicks: pitchResultEntryDelayTicksOf(frameCount),
    pitchSelectionTicks: pitchSelectionEntryDelayTicksOf(frameCount, resultWaitTicksOf(outcome)),
  }
}

/**
 * 던진 공의 걸음 소리 — 심판 콜(0x51a94)은 0x12 진입 0x3dfac 가 판정 0x9d57c 를 메시지 0xbba 로 곧바로(0xbfbac, 3e1e2~3e1e8) 보내
 * 그 틀에 난다. **곁일**: 삼진이면 0x12 틱 0 의 그림에 진동 100ms 를 건다 (0x4d0d6)
 */
function throwPitchSoundsOf(isVibrationOn: () => boolean): StepSoundsOf {
  return (before, after) => {
    const resolution = after.lastResolution
    if (resolution === null) return []
    // 삼진 진동 100ms — 사람이 던진 공도 상태 0x12 그리기 0x4ce9c 를 지난다 (0x4d0d6, `strikeoutVibration`). 0x12 틱 0 의
    // 그림(놓은 틱에서 `pitchResultEntryDelayTicksOf` 뒤)에 울린다 — 나리 투수는 마투수가 아니다
    const strikeoutMs = strikeoutVibrationMillisecondsOf(resolution, before.atBat.strikes)
    const isOn = isVibrationOn()
    if (strikeoutMs > 0) {
      setGameSceneTickTimeout(() => vibrate(strikeoutMs, isOn), pitchResultEntryDelayTicksOf(after.lastPitch?.frameCount ?? 0))
    }
    // 진행기가 타석이 끝나면 볼카운트를 새 타석으로 되돌리므로, 심판 콜이 보는 "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
    const nextAtBat = applyPitchResolution(before.atBat, resolution)
    return [
      pitchCallSoundIdOf(resolution, nextAtBat),
      // 공 도착 0x3dfac 가 연 판의 판정 콜 — 도루 · 폭투 판은 붙들어(`live`) 화면이 판 안의 그 틱에 내므로 여기서는
      // `lastArrivalPlay` 가 밀어내기(콜 없음)일 때만 바뀐다 (`arrivalCallSoundIdOf`)
      arrivalCallSoundIdOf(before, after),
      // 볼넷 뒤 관중 함성 29 (0x51afa~0x51b02) — 원본은 **공격 팀이 CPU 조작** (`state[0x31 + state[9]] == 1`) 일 때만 예약한다.
      // 투수편은 사람이 늘 수비라 타석에 서는 쪽이 언제나 CPU 다 → 조건이 늘 참이다. 겹치는 방식도 원본과 같다 — 0x6e498 은 큐가
      // 아니라 지금 소리를 끊는(0x6e4b8 stop) 한 칸 예약이라, 24 를 끊고 이어 트는 웹 동작이 그대로다 (1ce7ba7, soundPort.ts 머리 주석)
      walkCheerSoundIdOf(nextAtBat.outcome, true),
      // 인플레이 타구면 아웃 콜은 수비 화면이 끝난 뒤다
      after.pendingDefensePlay !== null || nextAtBat.outcome === null ? null : inPlayCallSoundIdOf(nextAtBat.outcome),
    ]
  }
}

/**
 * 구질·코스·게이지 칸을 정해 한 개 던진다 — 인플레이 타구가 되면 **거기서 멈춘다**(주자 처리는 수비 화면이 끝난 뒤). 공 도착의 도루 · 폭투
 * 판은 붙들어 수비 화면이 실시간으로 돌린다(송구 키 +0x160 — `live`). 못 맞힌 공의 공 도착 0x3dfac 은 0x12 진입 틀까지 붙들고
 * (`holdsArrival`) 그 틀의 시계가 `enterPitchResult` 로 잇는다
 */
export function useThrowPitchAction({ step, random, progressRef, isVibrationOnRef, cancelResultEntryRef }: PitcherActionContext) {
  return useMemo(() => {
    const isVibrationOn = () => isVibrationOnRef.current !== false
    return (input: PitchInput) => {
      const before = progressRef.current
      const timingOf = (stepBefore: PitcherGameProgress, after: PitcherGameProgress) => releaseTimingOf(input, stepBefore, after)
      const released = step((progress) => startPitch(progress, input, random, true, true), throwPitchSoundsOf(isVibrationOn), timingOf)
      if (released === before || released.pendingPitchArrival == null) return
      // 0x12 진입 틀 — 0x3dfac 의 굴림(`rollPassedBall` · 판 시작)과 그 뒤 걸음. 공이 나는 동안의 관리자 틱 굴림(마구 공 파티클 따위)이
      // 먼저 난다. 걸음의 소리는 그 틀(지금), 0xf 진입 교체 소리는 남은 틱 뒤(`resultEntryStepTimingOf`)
      const releaseTiming = releaseTimingOf(input, before, released)
      cancelResultEntryRef.current?.()
      cancelResultEntryRef.current = scheduleSceneFrameUpdate(() => {
        cancelResultEntryRef.current = null
        step(
          (progress) => enterPitchResult(progress, random),
          (entryBefore, entryAfter) => [arrivalCallSoundIdOf(entryBefore, entryAfter)],
          () => resultEntryStepTimingOf(releaseTiming),
        )
      }, releaseTiming.resultEntryTicks)
    }
  }, [step, random, progressRef, isVibrationOnRef, cancelResultEntryRef])
}
