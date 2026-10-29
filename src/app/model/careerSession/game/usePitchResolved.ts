import { useCallback } from 'react'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import { clearsPitchJudgement } from '@/features/defense-play/model/pitchArrivalPlay'
import { contactDefensePlayInputOf, startPlayerFoulPlay, type PitchArrivalStep } from '@/features/play-game/model/gameFlow'
import { contactOutcomeOfDetail, type PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { preRollContactMessage } from '@/features/defense-play/model/runDefensePlay'
import { tallyPitch } from '@/features/play-at-bat/model/atBatPitchTally'
import { pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { BATTER_PITCH_RESULT_ENTRY_TICKS, playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { arrivalContextAtom, foulPlayAtom, pitchTallyAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import type { ArrivalContext } from '@/app/model/careerSession/game/arrivalContext'
import { applyBuntAttempt, applyThrownPitch, rollPitchArrival } from '@/app/model/careerSession/game/pitchSteps'
import { useContinueAfterArrival } from '@/app/model/careerSession/game/useContinueAfterArrival'

/** 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 — 타석 화면이 0x12 틱 0 의 판정 글자 · 삼진 파티클을 고른다 */
function pitchReplyOf(arrival: PitchArrivalStep | null): PitchResolvedReply {
  const held = arrival?.deferred === true ? arrival.progress.pendingRunnerPlay : null
  return { judgementCleared: clearsPitchJudgement(arrival?.play) || (held?.kind === 'arrival' && clearsPitchJudgement(held.opened)) }
}

/** 공 하나를 먹인다 (`handlePitchResolved`) · 맞은 판정 틀의 판 입력을 미리 굴린다 (`preRollContact`) */
export function usePitchResolved(scope: CareerScope) {
  const { atoms, aceLevels, audio, random, runner } = scope
  const continueAfterArrival = useContinueAfterArrival(scope)

  /**
   * **맞은 판정 틀** — 메시지 0x11 굴림 묶음(필살수비 · 표시 패턴 · 두 공 폴 · 필살타법)을 이 공으로 설 판 입력으로 미리 굴린다(A-37).
   * 0x13 뒤 `handlePitchResolved` 가 세우는 판(`startPlayerOutcome` · `startPlayerFoulPlay`)은 쏜 공에 묶인 그 값을 되찾는다.
   * 판정 틀과 0x13 끝 사이에 수비 칸(능력 · 스킬 · 모드)은 안 바뀐다
   */
  const preRollContact = useCallback(
    (detail: PitchOutcomeDetail, buntKind: number) => {
      const progress = atoms.get(progressAtom)
      const outcome = contactOutcomeOfDetail(detail)
      if (progress === null || outcome === null) return null
      const input = contactDefensePlayInputOf(progress, outcome, random, { buntKind })
      return input === null ? null : preRollContactMessage(input)
    },
    [atoms, random],
  )

  /**
   * 파울 각 공 — 원본은 맞은 공이면 각과 무관하게 판(상태 0x17)을 돈다(메시지 0x11 → 0x13 → 0x17). 스트라이크(0xb6b58) ·
   * 연속 파울(0xa7dbc) · 파울 콜 25(51c5c)는 판이 파울로 닫힐 때(`finishDefensePlay`)다 — 여기서는 타구음만 낸다.
   * 공 도착 판(0x3dfac)은 못 맞힌 공만이라 열지 않는다. 필살타법 성공 굴림(0x517e6)도 판 시작이 한다(`foulContact`)
   */
  const startFoulContactPlay = useCallback(
    (detail: PitchOutcomeDetail, foulContact: NonNullable<PitchOutcomeDetail['foulContact']>, buntKind: number) => {
      const beforeFoul = atoms.get(progressAtom)
      if (beforeFoul === null) return
      const started = startPlayerFoulPlay(beforeFoul, foulContact, random, { strikes: runner.atBatRef.current.strikes, buntKind })
      atoms.set(progressAtom, started)
      playSoundIds(audio, [detail.contactSoundId])
      if (started.pendingDefensePlay === null) return
      atoms.set(foulPlayAtom, true)
      runner.setIsPaused(true)
    },
    [atoms, audio, random, runner],
  )

  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail, _pitch?: unknown, isUncatchable?: boolean, buntKind?: number): PitchResolvedReply | undefined => {
      const kind = buntKind ?? 0
      applyThrownPitch(atoms, detail, aceLevels)
      applyBuntAttempt(atoms, detail, kind)
      if (detail.resolution.kind === '파울' && detail.foulContact !== undefined) {
        startFoulContactPlay(detail, detail.foulContact, kind)
        return undefined
      }
      const nextAtBat = runner.applyPitch(detail.resolution)
      // 공마다 연속 파울(ctx+0x15f)을 센다 — 32·33 은 타석 결과와 함께 gameFlow 로 넘긴다 (0xa7dbc)
      const tally = tallyPitch(atoms.get(pitchTallyAtom), detail.resolution)
      atoms.set(pitchTallyAtom, tally)
      // 타구음(0x515de~)은 판정 틀 — 타석 화면이 이미 냈다(`contactSoundId` 는 비어 온다). 심판 콜(0x51a94)은 다음 틀 0x12 진입
      // 0x3dfac 가 메시지 0xbba 를 곧바로 보내 낸다(3e1e2~3e1e8) — 타석 화면은 0x12 를 예약한 틀에 이 자리를 부른다(`showResult`)
      playSoundIds(audio, [detail.contactSoundId])
      playSoundIdsAfterSceneTicks(audio, [pitchCallSoundIdOf(detail.resolution, nextAtBat)], BATTER_PITCH_RESULT_ENTRY_TICKS)
      const { beforeArrival, arrival } = rollPitchArrival(atoms, random, detail, nextAtBat, kind)
      const context: ArrivalContext = { nextAtBat, tally, isUncatchable, pattern: detail.pattern, buntKind: kind }
      const reply = pitchReplyOf(arrival)
      if (arrival?.deferred === true) {
        // 판이 도는 동안(상태 0x17) 다음 공은 없다 — 판 끝에서 `finishRunnerPlay` 가 아래 나머지를 잇는다
        atoms.set(progressAtom, arrival.progress)
        atoms.set(arrivalContextAtom, context)
        runner.setIsPaused(true)
        return reply
      }
      continueAfterArrival(beforeArrival, arrival, context)
      return reply
    },
    [aceLevels, atoms, audio, continueAfterArrival, random, runner, startFoulContactPlay],
  )

  return { handlePitchResolved, preRollContact }
}
