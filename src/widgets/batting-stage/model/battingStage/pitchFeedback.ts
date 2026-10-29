/** 판정 틀의 손맛 — 타구 순간 소리 · 진동 */
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { activeSound } from '@/shared/api/audio/soundPort'
import { pitchVibrationMillisecondsOf } from '@/widgets/batting-stage/lib/pitchVibration'
import type { StageLatest } from '@/widgets/batting-stage/model/stageRefs'

/** 타구 순간 소리 — 판정 틀에 곧바로 낸다(소리 통로 `activeSound`, 투구 순간 소리 `useStageAnimation` 과 같은 통로) */
export function playContactSoundNow(soundId: number | null | undefined): void {
  if (soundId !== null && soundId !== undefined) activeSound().play(soundId)
}

/**
 * 진동 — 맞은 공은 0xbc5 → 0x5228c 의 100/200/300ms, 사구는 0x51b0e 의 200ms, 삼진은 0x4d0d6 의 100ms.
 * 환경설정 진동(+0x3b)이 켜졌을 때만. HUD 는 이 공 전 볼카운트다
 */
export function vibratePitch(latest: StageLatest, detail: PitchOutcomeDetail, swingFrame: number | null, pitch: Pitch): void {
  vibrate(pitchVibrationMillisecondsOf(detail, swingFrame, pitch, latest.hud?.strikes ?? null), latest.isVibrationOn !== false)
}
