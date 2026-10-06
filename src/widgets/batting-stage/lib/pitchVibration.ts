import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { timingOf } from '@/entities/batting/model/swingTiming'
import {
  HIT_BY_PITCH_VIBRATION_MILLISECONDS,
  vibrationMillisecondsOf,
} from '@/entities/defense-controls/model/vibration'

/** 마구(구질 0x16) — 0x34be0 이 타이밍 폭을 22·12 로 바꾼다 (`resolvePitch` 와 같은 거름) */
const SPECIAL_PITCH = 'SPECIAL'

/**
 * 공 하나가 판정된 순간 울릴 진동 길이(ms). 없으면 0.
 *
 * - **맞은 공**(파울·번트 포함, `resultCode` 가 있다) → 0x51408 이 타구음 다음에 `0xac758(t)` 등급을 메시지 0xbc5 로
 *   보내고 0x5228c 가 100/200/300ms 로 울린다. t = 0x34be0 스윙 타이밍 (R15 4-1·4-5)
 * - **사구**(판정 v4) → 0x51b08~0x51b0e `vibrate(200, 100)` (L 1-F)
 * - 헛스윙·볼·스트라이크는 이 자리로 오지 않는다
 */
export function pitchVibrationMillisecondsOf(
  detail: PitchOutcomeDetail,
  swingFrame: number | null,
  pitch: { readonly frameCount: number; readonly type: string },
): number {
  if (detail.resolution.kind === '사구') return HIT_BY_PITCH_VIBRATION_MILLISECONDS
  if (detail.resultCode === null || swingFrame === null) return 0
  return vibrationMillisecondsOf(timingOf(swingFrame, pitch.frameCount, pitch.type === SPECIAL_PITCH))
}
