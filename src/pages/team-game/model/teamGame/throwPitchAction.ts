import { useMemo } from 'react'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf, walkCheerSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'
import { resultEntryStepTimingOf, scheduleSceneFrameUpdate } from '@/features/play-game/model/sceneTickSounds'
import type { PitchStepSoundTiming } from '@/features/play-game/model/sceneTickSounds'
import { enterPitchResult, startThrowPitch } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress, TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { pitchResultEntryDelayTicksOf, pitchSelectionEntryDelayTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { teamPitcherSideStageOf } from '@/pages/team-game/lib/teamMatchupCards'
import { arrivalCallSoundIdOf } from './callSounds'
import { resultWaitTicksOf } from './otherSlices'
import type { StepSoundsOf, TeamActionContext } from './teamGameStep'

/** 놓는 틀의 소리 — 구질 번호 · 마투수 번호(rec+0xa 비트6) · 공+0x10 */
function releaseSoundIdOf(input: TeamPitchInput, after: TeamGameProgress): number {
  return pitchReleaseSoundIdOf({
    typeNumber: input.typeNumber,
    pitcherMagicNumber: after.lastPitch?.pitcherMagicNumber ?? 0,
    ballMagicNumber: after.lastPitch?.magicNumber ?? 0,
  })
}

/**
 * 투구 순간 소리 12 / 마구 28 (0x3f378 — 놓는 틀) — 구질 22, 또는 마투수(rec+0xa 비트6)의 공+0x10 ≠ 0.
 * 공+0x10 은 안 지워져(H2 3-4) 마투수는 첫 마구 뒤로 모든 공이 28 이다 (원본 그대로).
 * 심판 콜은 0x12 진입 틀(놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤 — 마투수면 릴리스 단계가 길다), 0xf 진입 CPU 교체 22 는
 * 0x12 문턱 뒤 0xf 틀이다(`PitchStepSoundTiming`). 원본은 그 사이 공이 날아가 두 소리가 다 들린다
 */
function releaseTimingOf(input: TeamPitchInput, stepBefore: TeamGameProgress, after: TeamGameProgress): PitchStepSoundTiming {
  const frameCount = after.lastPitch?.frameCount ?? 0
  const aceOrder = teamPitcherSideStageOf(stepBefore).acePitcher?.order
  const resolution = after.lastResolution
  const outcome = resolution === null ? null : applyPitchResolution(stepBefore.atBat, resolution).outcome
  return {
    releaseSoundId: releaseSoundIdOf(input, after),
    resultEntryTicks: pitchResultEntryDelayTicksOf(frameCount, aceOrder),
    pitchSelectionTicks: pitchSelectionEntryDelayTicksOf(frameCount, resultWaitTicksOf(outcome), aceOrder),
  }
}

/**
 * 사람이 던진 공의 걸음 소리 — 심판 콜(0x51a94)은 0x12 진입 0x3dfac 가 판정 0x9d57c 를 메시지 0xbba 로 곧바로(0xbfbac, 3e1e2~3e1e8)
 * 보내 그 틀에 난다. **곁일**: 삼진이면 0x12 틱 0 의 그림에 진동 100ms 를 건다 (0x4d0d6, `strikeoutVibration`)
 */
function throwPitchSoundsOf(isVibrationOn: () => boolean): StepSoundsOf {
  return (before, after) => {
    const resolution = after.lastResolution
    if (resolution === null) return []
    // 삼진 진동 100ms — 사람이 던진 공도 상태 0x12 그리기 0x4ce9c 를 지난다 (0x4d0d6, `strikeoutVibration`). 0x12 틱 0 의
    // 그림(놓은 틱에서 `pitchResultEntryDelayTicksOf` 뒤 — 마투수면 릴리스 단계가 길다)에 울린다.
    // 우리 공격 반쪽의 삼진은 `BattingStage` 가 울린다
    const strikeoutMs = strikeoutVibrationMillisecondsOf(resolution, before.atBat.strikes)
    const isOn = isVibrationOn()
    if (strikeoutMs > 0) {
      setGameSceneTickTimeout(
        () => vibrate(strikeoutMs, isOn),
        pitchResultEntryDelayTicksOf(after.lastPitch?.frameCount ?? 0, teamPitcherSideStageOf(before).acePitcher?.order),
      )
    }
    const nextAtBat = applyPitchResolution(before.atBat, resolution)
    return [
      pitchCallSoundIdOf(resolution, nextAtBat),
      // CPU 가 건 도루·폭투 판의 판정 콜 — 재생할 판은 재생 화면이 그 틱에, 아니면 판을 연 이 자리에서 (`arrivalCallSoundIdOf`)
      arrivalCallSoundIdOf(before, after),
      // 볼넷 뒤 관중 함성 29 (0x51afa~0x51b02) — 원본은 **공격 팀이 CPU 조작** (`state[0x31 + state[9]] == 1`, 0x51adc~0x51af8) 일
      // 때만 예약한다. 이 자리는 사람이 던지는 타석이라 **타석에 선 쪽이 언제나 상대(CPU) 팀**이다. 우리 공격 반쪽에서는 공격이 사람이라
      // 원본에서도 안 난다 — 그래서 여기에만 있다.
      walkCheerSoundIdOf(nextAtBat.outcome, true),
      after.pendingDefensePlay !== null || nextAtBat.outcome === null ? null : inPlayCallSoundIdOf(nextAtBat.outcome),
    ]
  }
}

/** 구질·코스·게이지 칸을 정해 한 개 던진다 — 못 맞힌 공은 0x12 진입 틀까지 공 도착을 붙들고 그 틀에 `enterPitchResult` 로 잇는다 */
export function useThrowPitchAction({ step, random, progressRef, isVibrationOnRef, cancelResultEntryRef }: TeamActionContext) {
  return useMemo(() => {
    const isVibrationOn = () => isVibrationOnRef.current !== false
    return (input: TeamPitchInput) => {
      const before = progressRef.current
      const timingOf = (stepBefore: TeamGameProgress, after: TeamGameProgress) => releaseTimingOf(input, stepBefore, after)
      // 못 맞힌 공의 공 도착 0x3dfac 은 0x12 진입 틀까지 붙든다(`holdsArrival` — 아래 시계가 `enterPitchResult` 로 잇는다)
      const released = step((progress) => startThrowPitch(progress, input, random, true), throwPitchSoundsOf(isVibrationOn), timingOf)
      if (released === before || released.pendingPitchArrival == null) return
      // 0x12 진입 틀 — 0x3dfac 의 굴림(`rollPassedBall` · 판 시작)과 그 뒤 걸음. 공이 나는 동안의 관리자 틱 굴림(마구 공 파티클 따위)이
      // 먼저 난다. 걸음의 소리(공 도착 판 콜 · 공수 교대 따위)는 그 틀(지금), 0xf 진입 교체 소리는 남은 틱 뒤(`resultEntryStepTimingOf`)
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
