import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { timingOf } from '@/entities/batting/model/swingTiming'
import {
  HIT_BY_PITCH_VIBRATION_MILLISECONDS,
  STRIKEOUT_VIBRATION_MILLISECONDS,
  vibrationMillisecondsOf,
} from '@/entities/defense-controls/model/vibration'

/** 마구(구질 0x16) — 0x34be0 이 타이밍 폭을 22·12 로 바꾼다 (`resolvePitch` 와 같은 거름) */
const SPECIAL_PITCH = 'SPECIAL'
/** 0x9d57c 가 5(삼진)를 내는 그 전 스트라이크 수 — `st[4] > 1` */
const STRIKEOUT_STRIKES_BEFORE = 2

/**
 * 공 하나가 판정된 순간 울릴 진동 길이(ms). 없으면 0.
 *
 * - **맞은 공**(파울·번트 포함, `resultCode` 가 있다) → 0x51408 이 타구음 다음에 `0xac758(t)` 등급을 메시지 0xbc5 로
 *   보내고 0x5228c 가 100/200/300ms 로 울린다. t = 0x34be0 스윙 타이밍 (R15 4-1·4-5)
 * - **사구**(판정 v4) → 0x51b08~0x51b0e `vibrate(200, 100)` (L 1-F)
 * - **삼진**(세 번째 스트라이크, 판정 v5) → 상태 0x12 첫 그리기 0x4d0d6 의 100ms. `strikesBefore` 는 이 공 **전**
 *   스트라이크 수(HUD) — 모르면(null, 점수판 없는 홈런더비) 울리지 않는다
 * - 그 밖의 헛스윙·스트라이크·볼은 울리지 않는다
 *
 * ⚠️ 미해결(드묾): 원본은 삼진을 `state[0xc] == 5` 로 보는데 이 칸은 0x3dfac 가 v ≠ 0 일 때만 쓴다 — 0.1% 낫아웃이
 *    v 를 0 으로 지우면 앞 공의 값이 남는다. 또 삼진 + 도루처럼 진입에서 곧장 0x17 을 예약할 때 0x12 그리기가 한 번
 *    도는지는 확인 안 했다. 둘 다 진행기 쪽 판정이라 이 화면은 "세 번째 스트라이크면 100ms" 로만 본다.
 */
export function pitchVibrationMillisecondsOf(
  detail: PitchOutcomeDetail,
  swingFrame: number | null,
  pitch: { readonly frameCount: number; readonly type: string },
  strikesBefore: number | null = null,
): number {
  if (detail.resolution.kind === '사구') return HIT_BY_PITCH_VIBRATION_MILLISECONDS
  if (detail.resolution.kind === '스트라이크') {
    return strikesBefore !== null && strikesBefore >= STRIKEOUT_STRIKES_BEFORE ? STRIKEOUT_VIBRATION_MILLISECONDS : 0
  }
  if (detail.resultCode === null || swingFrame === null) return 0
  return vibrationMillisecondsOf(timingOf(swingFrame, pitch.frameCount, pitch.type === SPECIAL_PITCH))
}
