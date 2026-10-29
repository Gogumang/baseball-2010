import { useCallback } from 'react'
import { resolveDefensePlay, type GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { runDefensePlay, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { EMPTY_AT_BAT_PITCH_TALLY, tallyPitch } from '@/features/play-at-bat/model/atBatPitchTally'
import { deepHitCheerSoundIdOf, inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { gameStepSoundIdsOf } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { foulPlayAtom, pitchTallyAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { countOf, isBatterRecordedNow, runnersOnBaseOf } from '@/app/model/careerSession/game/arrivalContext'
import { useFinishAtBat } from '@/app/model/careerSession/game/useFinishAtBat'

/** 판 끝 걸음이 쓰는 세션 칸 */
type PlayScope = Pick<CareerScope, 'atoms' | 'audio' | 'random' | 'runner'>

type PendingDefensePlay = NonNullable<GameProgress['pendingDefensePlay']>

/** 화면이 돌린 판 — 함성 · 콜은 판 안의 그 틱에 이미 났다 */
const SHOWN_PLAY_SOUND_IDS = [null, null] as const

/**
 * 화면이 결과를 못 넘겨 여기서 돌린 판의 함성 60 · 판정 콜 — 판 끝에 근사로 낸다.
 * 판정 11(2스트라이크 번트 파울)은 판 끝 결과 코드가 낸다(`played.buntFoulOut`) — 콜은 조건 없이 62 (0x51b20)
 */
function approximatedPlaySoundIdsOf(pending: PendingDefensePlay, played: DefensePlayResult, outcome: AtBatOutcome): readonly (number | null)[] {
  return [
    deepHitCheerSoundIdOf({ outcome, carryDistance: carryDistanceOf(pending.trajectory), caughtOnTheFly: played.caughtOnTheFly }),
    inPlayCallSoundIdOf(outcome, played),
  ]
}

/**
 * 판 끝 정산 0xa8024 — 진루·아웃·득점을 경기 상태에 먹인다. 파울 각 공 판을 낙구 전에 잡았으면(파울 뜬공 아웃) 이 타석에서 앞서
 * 난 연속 파울 기록(32·33)을 정산과 함께 넘긴다
 */
function rollDefensePlayResolution(scope: PlayScope, current: GameProgress, played: DefensePlayResult, isFoulPlay: boolean): GameProgress {
  const { atoms, random, runner } = scope
  const resolved = resolveDefensePlay(current, played, random, {
    foulRecordIds: isFoulPlay && played.foulEnded !== true ? atoms.get(pitchTallyAtom).foulRecordIds : undefined,
    // 정산 0xa8024 의 타자 게이트 [sp+0x34] — 국가대항전 · 포스트시즌이면 거짓 (장내 홈런 a84d6 · 번트 안타 a8506)
    isRecorded: isBatterRecordedNow(atoms),
    // 파울로 닫힌 판 — 같은 틱 0x35108 이 0xb6b58 로 스트라이크를 먹인 뒤 다음 틱 0xf 진입이 교체 틱 굴림(0x344dc)을 본다.
    // 세션 카운트는 `runner.applyPitch` 가 같은 규칙(`applyPitchResolution` 파울)으로 올린다
    countAfterFoul: countOf(applyPitchResolution(runner.atBatRef.current, { kind: '파울' })),
  })
  atoms.set(progressAtom, resolved)
  return resolved
}

/**
 * 파울로 닫힌 판 — 0xae3e8 ae568 → 0xf(같은 타석 다음 공) · 0x35108 → 0xb6b58(스트라이크 ≤ 1 이면 +1).
 * 결과 코드 7 메시지 51c5c 의 연속 파울(0xa7dbc)과 파울 콜 25 가 이 판의 것이다 — 7 이 난 틱 b4562 가 0xbba 로 화면까지 가고
 * 같은 틱 0x35108 이 판을 닫는다(파울 판의 끝 틱이 곧 7 의 틱이다). 파울 콜 25 는 화면이 돌린 판이면 그 틱에 이미 났다
 * (`DefensePlayback` 의 `tickSounds`)
 */
function continueFoulEndedPlay(scope: PlayScope, current: GameProgress, resolved: GameProgress, played: DefensePlayResult, shownLive: boolean): void {
  const { atoms, audio, runner } = scope
  const pending = current.pendingDefensePlay
  runner.applyPitch({ kind: '파울' })
  atoms.set(pitchTallyAtom, tallyPitch(atoms.get(pitchTallyAtom), { kind: '파울' }))
  const call = shownLive || pending === null ? null : inPlayCallSoundIdOf(pending.outcome, played)
  playSoundIds(audio, [call, ...gameStepSoundIdsOf(current, resolved)])
  runner.setIsPaused(false)
}

/**
 * 배너·소리는 **판 끝 정산 0xa8024 가 낸 결과**로 낸다 — `pending.outcome` 은 판 앞 예측(`predictedOutcomeOf`)이라
 * 판이 다르게 끝나면(예: 예측 아웃인데 판에서 안타) 어긋난다. 타구 판이 아닌 결과(옛 호출)만 예측으로 남는다.
 * 판정 콜(결과 메시지 0xbba → 0x51a56)과 깊은 낙구 함성 60(슬롯 2 꼬리 52b62)은 원본처럼 판 안의 그 틱에 화면이 냈다
 * (`DefensePlayback` 의 `tickSounds`). 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 근사로 낸다. 진행 소리는 판 끝 그대로다.
 * 낸 결과를 돌려준다
 */
function playAtBatPlaySounds(
  audio: SoundPort,
  current: GameProgress,
  resolved: GameProgress,
  pending: PendingDefensePlay,
  played: DefensePlayResult,
  shownLive: boolean,
): AtBatOutcome {
  const outcome = played.outcome ?? pending.outcome
  const approximated = shownLive ? SHOWN_PLAY_SOUND_IDS : approximatedPlaySoundIdsOf(pending, played, outcome)
  playSoundIds(audio, [...approximated, ...gameStepSoundIdsOf(current, resolved)])
  return outcome
}

/**
 * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
 * **여기서야** 진루·아웃·득점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
 *
 * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
 * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
 */
export function useFinishDefensePlay(scope: CareerScope): (result?: DefensePlayResult) => void {
  const { atoms, audio, random, runner } = scope
  const finishAtBat = useFinishAtBat(scope)
  return useCallback(
    (result?: DefensePlayResult) => {
      const parts = { atoms, audio, random, runner }
      const current = atoms.get(progressAtom)
      const pending = current?.pendingDefensePlay ?? null
      if (current === null || pending === null) return
      const runnersOnBase = runnersOnBaseOf(current)
      const played = result ?? runDefensePlay(pending)
      const isFoulPlay = atoms.get(foulPlayAtom)
      atoms.set(foulPlayAtom, false)
      const resolved = rollDefensePlayResolution(parts, current, played, isFoulPlay)
      const shownLive = result !== undefined
      if (played.foulEnded === true) return continueFoulEndedPlay(parts, current, resolved, played, shownLive)
      // 파울 뜬공 아웃으로 타석이 끝났다 — 다음 타석은 새 카운터로 (타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다)
      if (isFoulPlay) atoms.set(pitchTallyAtom, EMPTY_AT_BAT_PITCH_TALLY)
      const outcome = playAtBatPlaySounds(audio, current, resolved, pending, played, shownLive)
      // 0x17 판 끝 → 판정 B 가 곧장 0xd
      finishAtBat(resolved, outcome, runnersOnBase, 0)
    },
    [atoms, audio, finishAtBat, random, runner],
  )
}
