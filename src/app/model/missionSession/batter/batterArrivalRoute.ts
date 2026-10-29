import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { OpenedPitchArrivalPlay, PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { BATTER_PITCH_RESULT_ENTRY_TICKS, playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import { holdsUntilResultWaitEnd } from '@/features/play-game/model/benchClearingScene'
import { playSoundIds } from '@/app/model/useSound'
import { missionArrivalContextAtom, pendingBenchClearingAtom, pendingRunnerPlayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import type { MissionArrivalContext } from '@/app/model/missionSession/types/missionPlayTypes'
import { arrivalCallSoundIdOf } from '@/app/model/missionSession/runnerPlay/arrivalReplay'
import { signalPitchSelection } from '@/app/model/missionSession/scene/sceneSteps'
import { continueMissionArrival, finishMissionArrivalAtBat } from '@/app/model/missionSession/batter/arrivalSteps'
import { type BatterPitchHands, startBatterDefensePlay } from '@/app/model/missionSession/batter/batterPitchSteps'

/** 판정한 공 하나 — 받기 전 판과 이 공으로 끝난 타석 */
export interface BatterPitch {
  readonly detail: PitchOutcomeDetail
  readonly nextAtBat: AtBatState
  readonly outcome: AtBatOutcome | null
  readonly current: MissionRun | null
  readonly runnersOnBase: number
}

/** 공 도착 판의 나머지가 쓸 값 */
const arrivalContextOf = ({ detail, outcome, runnersOnBase }: BatterPitch, current: MissionRun): MissionArrivalContext => ({
  current,
  hasSwung: detail.hasSwung,
  outcome,
  isBunt: detail.isBunt,
  runnersOnBase,
})

/**
 * 붙드는 공 도착 판(도루 · 폭투) — 판정 콜(도루 17 · 62/20, 폭투 17)과 그 뒤 아웃 콜은 판 안의 그 틱이다(화면이 판을 실시간으로 돌린다).
 * 심판 콜은 0x12 진입 틀(타구음은 판정 틀에 타석 화면이 냈다 — `contactSoundId` 는 비어 온다). 판이 도는 동안(상태 0x17) 다음 공은 없다
 */
export function holdLiveBatterArrival(
  hands: BatterPitchHands,
  pitch: BatterPitch,
  current: MissionRun,
  opened: Exclude<OpenedPitchArrivalPlay, { readonly kind: 2 }>,
): void {
  const { atoms, runner, audio } = hands
  playSoundIds(audio, [pitch.detail.contactSoundId])
  playSoundIdsAfterSceneTicks(audio, [pitchCallSoundIdOf(pitch.detail.resolution, pitch.nextAtBat)], BATTER_PITCH_RESULT_ENTRY_TICKS)
  atoms.set(missionArrivalContextAtom, arrivalContextOf(pitch, current))
  atoms.set(pendingRunnerPlayAtom, { kind: 'arrival', opened, side: '공격' })
  runner.setIsPaused(true)
}

/**
 * 타구음(판정 틀 — 타석 화면이 이미 냈다, `contactSoundId` 는 비어 온다) → 심판 콜(0x12 진입 틀 0x3dfac → 0xbba, 한 틀 뒤)
 * 차례 (경기 장면과 같은 0x51408 이다). 공 도착 판이 열렸으면 그 판정 콜(도루 17 · 62/20, 폭투 17)이 심판 콜 뒤다 — 원본은
 * 판 안의 그 틱에 낸다. 재생 칸에 넣는 판(진루만 하는 판)은 재생 화면이 기록된 틱에 내고
 * (`continueMissionArrival` → `pickoffReplay`), 재생하지 않는 판만 연 자리에서 낸다(근사).
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 아웃 콜도 여기서 같이 난다 (0xae24c 갈래)
 */
function announceBatterPitch({ audio }: BatterPitchHands, pitch: BatterPitch, play: PitchArrivalPlay | null, runsDefense: boolean): void {
  const { detail, nextAtBat, outcome } = pitch
  playSoundIds(audio, [detail.contactSoundId])
  playSoundIdsAfterSceneTicks(
    audio,
    [
      pitchCallSoundIdOf(detail.resolution, nextAtBat),
      arrivalCallSoundIdOf(play),
      outcome === null || runsDefense ? null : inPlayCallSoundIdOf(outcome),
    ],
    BATTER_PITCH_RESULT_ENTRY_TICKS,
  )
}

/** 공 도착 판 뒤의 같은 타석 · 끊긴 타석 — 처리했으면 참. 판이 없는 판(`current` 없음)은 같은 타석 다음 공 */
function continuedAfterArrival(hands: BatterPitchHands, pitch: BatterPitch, play: PitchArrivalPlay | null): boolean {
  if (pitch.current !== null) return continueMissionArrival(hands.atoms, hands.runner, play, arrivalContextOf(pitch, pitch.current))
  if (pitch.outcome !== null) return false
  signalPitchSelection(hands.atoms, 'same')
  return true
}

/**
 * 볼넷 · 사구 — 공 도착 0x3dfac 은 0x12 를 예약할 뿐이다(모드 6 도 상태 갱신 표 그대로 0x4e6d4). 틱 31 갱신의 4e74c 벤치
 * 클리어링 굴림(사구만)·판정 A 의 밀어내기 · 정산은 0x12 의 32 그림 뒤라 그동안 붙든다 — 화면이 `judgeHitByPitch` 를 부른다(r298).
 * 삼진은 정산 굴림이 없어 붙들지 않는다(판정 A 는 굴림 없이 0xd · 정산 — 웹 `applyMissionOutcome` 도 난수를 안 쓴다)
 * 도루 출발 중이면(3e0e4 → 3e114 곧장 0x17, A-24) 붙들지 않는다 — 대기 · 굴림 없이 아래 보통 길(밀어내기 판 곧장). 붙들면 참
 */
function holdFreePass(hands: BatterPitchHands, pitch: BatterPitch, play: PitchArrivalPlay | null, outcome: AtBatOutcome): boolean {
  const { current, detail, runnersOnBase } = pitch
  const isFreePass = outcome.kind === '사구' || outcome.kind === '볼넷'
  if (current === null || !isFreePass || !holdsUntilResultWaitEnd(outcome, play)) return false
  hands.atoms.set(pendingBenchClearingAtom, {
    side: '타자',
    phase: 'wait',
    run: current,
    outcome,
    play,
    hasSwung: detail.hasSwung,
    isBunt: detail.isBunt,
    runnersOnBase,
  })
  hands.runner.setIsPaused(true)
  return true
}

/** 미리 돌린 공 도착 판(또는 판 없음) 뒤의 길 — 같은 타석 · 끊긴 타석 · 수비 화면 · 붙든 볼넷 · 사구 · 끝난 타석 */
export function settleBatterArrival(
  hands: BatterPitchHands,
  pitch: BatterPitch,
  play: PitchArrivalPlay | null,
  extra: { readonly isUncatchable: boolean; readonly stealing: readonly StealBase[]; readonly buntKind: number; readonly isPlayOutcome: boolean },
): void {
  // 맞은 공(쏜 패턴이 묶인 안타·아웃·홈런)이면 수비 화면(상태 0x17)이 먼저 돈다 — 결과·콜은 그 뒤다
  announceBatterPitch(hands, pitch, play, extra.isPlayOutcome)
  if (continuedAfterArrival(hands, pitch, play)) return
  const { outcome, current, detail } = pitch
  if (outcome === null) return
  if (extra.isPlayOutcome && current !== null) {
    startBatterDefensePlay(hands, { current, detail, outcome, ...extra, runnersOnBase: pitch.runnersOnBase })
    return
  }
  if (holdFreePass(hands, pitch, play, outcome)) return
  finishMissionArrivalAtBat(hands.atoms, hands.runner, play, {
    hasSwung: detail.hasSwung,
    outcome,
    isBunt: detail.isBunt,
    runnersOnBase: pitch.runnersOnBase,
  })
}
