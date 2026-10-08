import type { PitchResolution } from '@/entities/at-bat/model/atBatState'

/**
 * **타석 단계의 길이 — 그림(틱) 수**. 원본 상태 갱신은 상태 틱(경기+0x2c)으로 다음 상태를 예약하고,
 * 예약은 다음 그림 머리 0xbc9c9 에서 선다(0x52c50). 웹 단계 길이는 그 상태가 서 있는 그림 수다.
 *
 * - **대기(0xf + 0x10)** — 0xf 갱신 0x39c1c 는 `상태 틱 > 7 이고 +0xfc8 ≠ 0` 이면 0x10 을 예약한다 → 틱 0~8 의 **9 그림**.
 *   0x10(0x39c5c)은 **7 그림** 뒤 0x11 이다. 웹 '대기' 는 이 둘을 합친 16 그림이다.
 * - **결과(0x12)** — 0x12 갱신 0x4e6d4 (4e6de~4e730): `st[0xb]` 가 3(볼넷) · 4(사구) · 5(삼진)이면 문턱 0x1f, 아니면 0xf.
 *   `상태 틱 ≥ 문턱` 인 갱신에서 예약하므로 틱 0~문턱의 **16 · 32 그림**이다.
 */
export const PRE_PITCH_TICKS = 9 + 7

/** 0x4e6e2 · 0x4e6f0 — 문턱 15 · 31 */
const RESULT_THRESHOLD = 15
const AT_BAT_END_RESULT_THRESHOLD = 31

/** 보통 결과(문턱 15)의 그림 수 */
export const RESULT_PHASE_TICKS = RESULT_THRESHOLD + 1

/** 볼카운트 (이 공을 먹이기 전) */
export interface CountBeforePitch {
  readonly balls: number
  readonly strikes: number
}

/**
 * 결과(0x12) 단계 그림 수. `st[0xb]`(0x9d57c 의 판정 코드)를 웹 판정과 이 공 앞 볼카운트로 가른다 —
 * 사구 · 볼넷(3볼에서 볼) · 삼진(2스트라이크에서 스트라이크)이면 32, 아니면 16.
 * 볼카운트를 모르면(HUD 없음) 사구만 32 로 본다.
 */
export function resultPhaseTicksOf(resolution: PitchResolution, count: CountBeforePitch | null): number {
  const threshold = endsAtBatInResultState(resolution, count) ? AT_BAT_END_RESULT_THRESHOLD : RESULT_THRESHOLD
  return threshold + 1
}

function endsAtBatInResultState(resolution: PitchResolution, count: CountBeforePitch | null): boolean {
  if (resolution.kind === '사구') return true
  if (count === null) return false
  if (resolution.kind === '볼') return count.balls >= 3
  if (resolution.kind === '스트라이크') return count.strikes >= 2
  return false
}
