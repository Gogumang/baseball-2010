import { useCallback } from 'react'
import { startPlayerOutcome, type GameProgress, type PitchArrivalStep } from '@/features/play-game/model/gameFlow'
import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { atBatEndFramesOf, type AtBatRunner } from '@/app/model/useAtBatRunner'
import { EMPTY_AT_BAT_PITCH_TALLY } from '@/features/play-at-bat/model/atBatPitchTally'
import { inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { gameStepSoundIdsOf } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { CareerAtoms, CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { pitchTallyAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { type ArrivalContext, isBatterRecordedNow, runnersOnBaseOf } from '@/app/model/careerSession/game/arrivalContext'
import { useEndGame } from '@/app/model/careerSession/game/useEndGame'
import { useFinishAtBat } from '@/app/model/careerSession/game/useFinishAtBat'

/** 공 하나의 공 도착 뒤 나머지 */
export type ContinueAfterArrival = (beforeArrival: GameProgress | null, arrival: PitchArrivalStep | null, context: ArrivalContext) => void

/**
 * 판정 콜(도루 17 · 62/20, 폭투 17) — 원본은 판 안의 결과 코드가 선 틱(결과 메시지 0xbba → 0x51a56)에 낸다. 실시간으로 돈 판
 * (`shownLive`)은 화면이 그 틱에 이미 냈고, 미리 돌린 판은 재생 칸(`lastDefensePlay` — 진루만 하는 판은 공 도착에서, 낫아웃 · 밀어내기
 * 판은 타석 결과 `finishPlayerOutcome` 에서 넣는다)에 들어가 재생 화면이 기록된 틱에 낸다(`DefensePlayback` 재생 갈래의
 * `tickSoundIds`). 그릴 틱이 없는 판만 여기서(근사) 낸다
 */
function arrivalCallSoundIdOf(play: PitchArrivalStep['play']): number | null {
  if (play == null || play.shownLive === true || play.result.ticks.length > 0) return null
  return play.callSoundId
}

/** 공 도착 판이 진행을 바꿨으면 적고 판정 콜 · 공수 교대 소리를 낸다 */
function showArrivalStep(atoms: CareerAtoms, audio: SoundPort, beforeArrival: GameProgress | null, arrival: PitchArrivalStep | null): void {
  if (beforeArrival === null || arrival === null || arrival.progress === beforeArrival) return
  atoms.set(progressAtom, arrival.progress)
  playSoundIds(audio, [arrivalCallSoundIdOf(arrival.play), ...gameStepSoundIdsOf(beforeArrival, arrival.progress)])
}

/** 판에서 반 이닝·경기가 끝났다 — 내 타석이 끊긴다 (견제사와 같은 길) */
function endInterruptedAtBat(atoms: CareerAtoms, runner: AtBatRunner, endGame: (finished: GameProgress) => void, progress: GameProgress): void {
  atoms.set(pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
  runner.resetAtBat()
  if (progress.game.isFinished) endGame(progress)
}

/**
 * 타석 결과(안타/아웃 코드)만 먼저 정한다 — 인플레이 타구면 주자 처리는 화면 뒤로 미뤄진다.
 * 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800).
 * 판정 11(2스트라이크 번트 파울)은 파울 각 공 판이 판 끝 결과 코드 11 로 낸다 — 콜 62 는 판 결과(`played.buntFoulOut`)가 고정한다
 */
function startArrivedOutcome(
  atoms: CareerAtoms,
  random: RandomPort,
  current: GameProgress,
  outcome: AtBatOutcome,
  arrival: PitchArrivalStep | null,
  context: ArrivalContext,
): GameProgress {
  const advanced = startPlayerOutcome(current, outcome, random, {
    isUncatchable: context.isUncatchable,
    // 쏜 패턴(0xb0930 덱에서 뽑은 것)을 그대로 판에 싣는다 — 타석 결과 객체에 묶인 것과 같은 값을 명시적으로 넘긴다
    pattern: context.pattern,
    foulRecordIds: context.tally.foulRecordIds,
    arrivalPlay: arrival?.play ?? null,
    // 이 공의 번트 종류(장면 +0xfdc) — 타구 판 시작 리드(0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다
    buntKind: context.buntKind,
    // 삼진 + 도루 판의 한 정산이 0xa59c0 에 보는 타자 게이트 0xa56dc(ctx, 지금 타자, 1)
    isRecorded: isBatterRecordedNow(atoms),
  })
  atoms.set(progressAtom, advanced)
  return advanced
}

/**
 * 수비 진행 중 — 화면이 틱을 돌리는 동안 타석을 멈춰 둔다. 원본도 상태 0x17 이 도는 동안 0xf(타석 준비)로 돌아가지 않아
 * 다음 투구가 나가지 않는다. 사구 — 0x12 대기(32 그림) 끝의 판정(`judgeHitByPitch`)까지, 들어갔으면 벤치 클리어링
 * 연출(상태 0x1e)이 끝날 때(`finishBenchClearing`)까지 붙든다. 그동안 타석 화면은 0x12 를 그린다
 */
const isHeldAfterOutcome = (advanced: GameProgress) => advanced.pendingDefensePlay !== null || advanced.pendingBenchClearing !== null

/**
 * 공 하나의 **공 도착 뒤 나머지** — 판 소리 · 판에서 끊긴 타석 · 끝난 타석의 결과(`startPlayerOutcome`).
 * 판을 미리 돌린 공은 `handlePitchResolved` 가 곧바로, 사람 주루 키를 받으며 실시간으로 돈 판(`pendingRunnerPlay`)은
 * 판 끝(`finishRunnerPlay`)이 부른다.
 */
export function useContinueAfterArrival(scope: CareerScope): ContinueAfterArrival {
  const { atoms, audio, random, runner } = scope
  const endGame = useEndGame(scope)
  const finishAtBat = useFinishAtBat(scope)
  return useCallback(
    (beforeArrival: GameProgress | null, arrival: PitchArrivalStep | null, context: ArrivalContext) => {
      showArrivalStep(atoms, audio, beforeArrival, arrival)
      if (arrival?.interrupted === true) return endInterruptedAtBat(atoms, runner, endGame, arrival.progress)
      const outcome = context.nextAtBat.outcome
      if (!isAtBatFinished(context.nextAtBat) || outcome === null) return
      // 타석이 끝났다 — 다음 타석은 새 카운터로 (타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다)
      atoms.set(pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
      const current = atoms.get(progressAtom)
      if (current === null) return
      const runnersOnBase = runnersOnBaseOf(current)
      const advanced = startArrivedOutcome(atoms, random, current, outcome, arrival, context)
      if (isHeldAfterOutcome(advanced)) return runner.setIsPaused(true)
      // 홈런·삼진·볼넷은 수비를 기다리지 않는다 — 홈런 함성(11)과 진행 소리를 여기서 낸다
      playSoundIds(audio, [inPlayCallSoundIdOf(outcome), ...gameStepSoundIdsOf(current, advanced)])
      // 0x12 진입에서 끝난 타석 — 도루 · 폭투 판(종류 5 · 9)이 열렸으면 곧장 0x17 이라 판 끝에서, 아니면 0x12 대기 32 그림 뒤 0xd
      finishAtBat(advanced, outcome, runnersOnBase, atBatEndFramesOf(outcome, arrival?.play))
    },
    [atoms, audio, endGame, finishAtBat, random, runner],
  )
}
