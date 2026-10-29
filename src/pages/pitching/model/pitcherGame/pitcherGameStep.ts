import type { RefObject } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { playSoundIds } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { playSoundIdsAfterSceneTicks, type PitchStepSoundTiming } from '@/features/play-game/model/sceneTickSounds'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pinchHitSoundIdsOf, stepSoundIdsOf } from './otherSlices'

/** 걸음 앞뒤 진행으로 고른 소리 (null 은 안 낸다) */
export type StepSoundsOf = (before: PitcherGameProgress, after: PitcherGameProgress) => readonly (number | null)[]
/** 걸음이 여러 틀 몫일 때(공 던지기)의 소리 틀 */
export type StepTimingOf = (before: PitcherGameProgress, after: PitcherGameProgress) => PitchStepSoundTiming

/** 진행 한 걸음을 먹이고 그 사이 소리를 낸다 — 바뀐 게 없으면 지금 진행을 그대로 돌려준다 */
export type PitcherGameStep = (
  next: (current: PitcherGameProgress) => PitcherGameProgress,
  soundsOf?: StepSoundsOf,
  timingOf?: StepTimingOf,
) => PitcherGameProgress

/** 손잡이 훅들이 같이 쓰는 재료 — 난수 · 소리 · 걸음, 그리고 상태 고리의 칸(최신 진행 · 진동 설정 · 0x12 진입 시계 거두기) */
export interface PitcherActionContext {
  readonly random: RandomPort
  readonly audio: SoundPort
  readonly step: PitcherGameStep
  readonly progressRef: RefObject<PitcherGameProgress>
  readonly setProgress: (progress: PitcherGameProgress) => void
  readonly isVibrationOnRef: RefObject<boolean | undefined>
  readonly cancelResultEntryRef: RefObject<(() => void) | null>
}

/** 걸음의 소리 · 0x12 진입 틀 몫 — 걸음이 고른 소리(`soundsOf`)와 진행 소리(공수 교대 13 · 돌발 42/36/37 — `stepSoundIdsOf`) */
function playResultEntrySounds(
  audio: SoundPort,
  current: PitcherGameProgress,
  after: PitcherGameProgress,
  soundsOf: StepSoundsOf | undefined,
  ticks: number,
): void {
  const stepSounds = soundsOf === undefined ? [] : soundsOf(current, after)
  playSoundIdsAfterSceneTicks(audio, [...stepSounds, ...stepSoundIdsOf(current, after)], ticks)
}

/**
 * 걸음의 소리 (팀경기 고리와 같은 모양) — `timingOf` 를 주면(공 던지기) 걸음이 여러 틀 몫이다. 놓는 틀의 소리(`releaseSoundId`)만 지금
 * 내고, 걸음의 소리는 0x12 진입 틀(`resultEntryTicks` 뒤), 0xf 진입 0x3d954 의 교체 소리는 그 0xf 틀(`pitchSelectionTicks` 뒤)에 낸다.
 * 사람 장면 CPU 대타(0x3d954 3da70)가 교체 연출 0x16 을 지났으면 — 22(3da88) 뒤 0xe 에서 들어온 타자 등판음. 다음 공을 고르기 전(0xf 진입)에
 * 서므로 걸음 끝에 둔다 (팀경기 `useTeamGame` 과 같은 자리). 투수편 사람 장면은 늘 우리 수비라 CPU 투수 교체(3da3e — 수비가 CPU 일 때)는
 * 없고, 8회 구원 등판·강판 교체는 0x21(간이 엔진) 쪽이라 0x16 을 안 지나 등판음도 없다
 */
export function playPitcherStepSounds(
  audio: SoundPort,
  current: PitcherGameProgress,
  after: PitcherGameProgress,
  soundsOf: StepSoundsOf | undefined,
  timingOf: StepTimingOf | undefined,
): void {
  const timing = timingOf?.(current, after) ?? null
  if (timing !== null) playSoundIds(audio, [timing.releaseSoundId])
  playResultEntrySounds(audio, current, after, soundsOf, timing?.resultEntryTicks ?? 0)
  playSoundIdsAfterSceneTicks(audio, pinchHitSoundIdsOf(current, after), timing?.pitchSelectionTicks ?? 0)
}
