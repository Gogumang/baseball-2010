import { useCallback } from 'react'
import { enterBenchClearing, judgeHitByPitch, resolveBenchClearing } from '@/features/play-game/model/gameFlow'
import { atBatEndFramesOf } from '@/app/model/useAtBatRunner'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import { inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { gameStepSoundIdsOf } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { runnersOnBaseOf } from '@/app/model/careerSession/game/arrivalContext'
import { useFinishAtBat } from '@/app/model/careerSession/game/useFinishAtBat'

/** 사구 · 벤치 클리어링 (0x12 대기 끝 4e74c · 진입 0x3a5f0 · 출구 0xae24c) */
export function useHitByPitchActions(scope: CareerScope) {
  const { atoms, audio, random } = scope
  const finishAtBat = useFinishAtBat(scope)

  /**
   * **사구의 0x12 대기 끝** (틱 31 갱신 0x4e6d4) — 화면이 대기를 센 뒤 부른다(`useHitByPitchWait`). 진행기 `judgeHitByPitch` 가
   * 4e74c 를 굴려 들어갔으면 붙든 채 두고(진입 0x3a5f0 은 다음 틀 `enterBenchClearing`), 안 들어갔으면 판정 A 0xae24c 의 보통 길
   * (밀어내기 판 · 정산) — 소리 · 타석 끝은 예전 공 도착 걸음의 볼넷 · 사구 그대로이고, 0xd 는 0x12 진입부터 32 그림 뒤라 남은 그림만 둔다.
   */
  const judgeHeldHitByPitch = useCallback(() => {
    const current = atoms.get(progressAtom)
    const pending = current?.pendingBenchClearing ?? null
    if (current === null || pending === null || pending.phase !== 'wait') return
    const runnersOnBase = runnersOnBaseOf(current)
    const judged = judgeHitByPitch(current, random)
    atoms.set(progressAtom, judged)
    if (judged.pendingBenchClearing !== null) return
    playSoundIds(audio, [inPlayCallSoundIdOf(pending.outcome), ...gameStepSoundIdsOf(current, judged)])
    const endFrames = atBatEndFramesOf(pending.outcome, pending.arrivalPlay) - RESULT_WAIT_TICKS_AT_BAT_END
    finishAtBat(judged, pending.outcome, runnersOnBase, Math.max(0, endFrames))
  }, [atoms, audio, finishAtBat, random])

  /** **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀에 화면이 부른다. 굴림 45 번 (`enterBenchClearing`) */
  const enterHeldBenchClearing = useCallback(() => {
    const current = atoms.get(progressAtom)
    if (current === null || current.pendingBenchClearing?.phase !== 'entry') return
    atoms.set(progressAtom, enterBenchClearing(current, random))
  }, [atoms, random])

  /**
   * 벤치 클리어링 연출이 끝났다 (`BenchClearingScene` 의 `onDone`) — 출구 0xae24c 뒤 사구를 보통 길로 먹인다.
   * `reachedTargetTick` 이면 틱 10 의 굴림 8 번을 진행기가 먼저 낸다.
   */
  const finishBenchClearing = useCallback(
    (reachedTargetTick: boolean) => {
      const current = atoms.get(progressAtom)
      const pending = current?.pendingBenchClearing ?? null
      if (current === null || pending === null) return
      const runnersOnBase = runnersOnBaseOf(current)
      const resolved = resolveBenchClearing(current, { reachedTargetTick }, random)
      atoms.set(progressAtom, resolved)
      playSoundIds(audio, [inPlayCallSoundIdOf(pending.outcome), ...gameStepSoundIdsOf(current, resolved)])
      // 벤치 클리어링 출구 0xae24c → 밀어내기 판(0x17)을 대기 없이 바로 세우고(`useFreePassPlayStart`) 그 판 끝에서 0xd
      finishAtBat(resolved, pending.outcome, runnersOnBase, 0)
    },
    [atoms, audio, finishAtBat, random],
  )

  return {
    /** 사구의 0x12 대기 끝 — 4e74c 판정 (`judgeHitByPitch`) */
    judgeHitByPitch: judgeHeldHitByPitch,
    /** 벤치 클리어링 진입 0x3a5f0 (`enterBenchClearing`) */
    enterBenchClearing: enterHeldBenchClearing,
    finishBenchClearing,
  }
}
