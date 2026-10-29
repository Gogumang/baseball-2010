import type { RefObject } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { playSoundIds } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { playSoundIdsAfterSceneTicks, type PitchStepSoundTiming } from '@/features/play-game/model/sceneTickSounds'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { pinchHitSoundIdsOf, scenePitcherChangeSoundIdsOf, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'

/** 걸음 앞뒤 진행으로 고른 소리 (null 은 안 낸다) */
export type StepSoundsOf = (before: TeamGameProgress, after: TeamGameProgress) => readonly (number | null)[]
/** 걸음이 여러 틀 몫일 때(사람이 던진 공)의 소리 틀 */
export type StepTimingOf = (before: TeamGameProgress, after: TeamGameProgress) => PitchStepSoundTiming

/** 진행 한 걸음을 먹이고 그 사이 소리를 낸다 — 바뀐 게 없으면 지금 진행을 그대로 돌려준다 */
export type TeamGameStep = (
  next: (current: TeamGameProgress) => TeamGameProgress,
  soundsOf?: StepSoundsOf,
  timingOf?: StepTimingOf,
) => TeamGameProgress

/** 손잡이 훅들이 같이 쓰는 재료 — 난수 · 소리 · 걸음, 그리고 상태 고리의 칸(최신 진행 · 진동 설정 · 0x12 진입 시계 거두기) */
export interface TeamActionContext {
  readonly random: RandomPort
  readonly audio: SoundPort
  readonly step: TeamGameStep
  readonly progressRef: RefObject<TeamGameProgress>
  readonly setProgress: (progress: TeamGameProgress) => void
  readonly isVibrationOnRef: RefObject<boolean | undefined>
  readonly cancelResultEntryRef: RefObject<(() => void) | null>
}

/** 걸음의 소리 · 0x12 진입 틀 몫 — 걸음이 고른 소리(`soundsOf`)와 진행 소리(공수 교대 13 · 돌발 42/36/37 — `stepSoundIdsOf`) */
function playResultEntrySounds(
  audio: SoundPort,
  current: TeamGameProgress,
  after: TeamGameProgress,
  soundsOf: StepSoundsOf | undefined,
  ticks: number,
): void {
  const stepSounds = soundsOf === undefined ? [] : soundsOf(current, after)
  playSoundIdsAfterSceneTicks(audio, [...stepSounds, ...stepSoundIdsOf(current, after)], ticks)
}

/** 0xf 진입 0x3d954 의 교체 소리 — 그 0xf 틀 몫 */
function playPitchSelectionSounds(audio: SoundPort, current: TeamGameProgress, after: TeamGameProgress, ticks: number): void {
  playSoundIdsAfterSceneTicks(
    audio,
    [
      // 대타 교체 연출(상태 0x16)을 지났으면 — CPU 대타는 다음 타석 준비(0xf 진입)에서 서므로 걸음 끝에 둔다
      ...pinchHitSoundIdsOf(current, after),
      // 사람 장면 CPU 투수 교체(0x3d954 → 0xac428)도 같은 0x16 연출 — 22 뒤 올라온 투수 등판음
      ...scenePitcherChangeSoundIdsOf(current, after),
    ],
    ticks,
  )
}

/**
 * 걸음의 소리 — `timingOf` 를 주면(사람이 던진 공) 걸음이 여러 틀 몫이다. 놓는 틀의 소리(`releaseSoundId`)만 지금 내고, 걸음의 소리는
 * 0x12 진입 틀(`resultEntryTicks` 뒤), 0xf 진입 0x3d954 의 교체 소리는 그 0xf 틀(`pitchSelectionTicks` 뒤)에 낸다(`playSoundIdsAfterSceneTicks`)
 */
export function playTeamStepSounds(
  audio: SoundPort,
  current: TeamGameProgress,
  after: TeamGameProgress,
  soundsOf: StepSoundsOf | undefined,
  timingOf: StepTimingOf | undefined,
): void {
  const timing = timingOf?.(current, after) ?? null
  if (timing !== null) playSoundIds(audio, [timing.releaseSoundId])
  playResultEntrySounds(audio, current, after, soundsOf, timing?.resultEntryTicks ?? 0)
  playPitchSelectionSounds(audio, current, after, timing?.pitchSelectionTicks ?? 0)
}
