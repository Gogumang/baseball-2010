import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { STRIKEOUT_VIBRATION_MILLISECONDS } from '@/entities/defense-controls/model/vibration'

/** 0x9d57c 가 5(삼진)를 내는 그 전 스트라이크 수 — `st[4] > 1` */
const STRIKEOUT_STRIKES_BEFORE = 2

/**
 * **사람이 던진 공의 삼진 진동** — 상태 0x12 그리기 `0x4ce9c` 의 0x4d0b4~0x4d0d6 (100ms).
 *
 * ```
 * 52fb6  경기 장면 프레임 0x52c50 → 그리기 표 0xd05a0[0x12] = 0x4ce9c   ; 모드를 가리지 않는다
 * 3dfac  0x12 진입 — v = 0x9d57c(…) ; v ≠ 0 이면 3e1da state[0xc] = v   ; 이 진입에도 모드 갈래가 없다
 * 4d0ba  s8 state[0xc] == 5 && 경기+0x2c(상태 틱) == 0 → 4d0d6 0x3a44(100, 100)
 * ```
 * 0x4ce9c 를 부르는 곳은 프레임 0x52c50(0x52fb6) 과 상태 0x1d 그리기 0x4d1e0(0x4d1ea) 둘뿐인데, 0x4d1e0 은 부르기
 * 전에 경기+0x2c = 100 을 써(0x4d1e4) 틱 조건이 늘 거짓이다 — 곧 울리는 곳은 경기 장면 0x104 의 상태 0x12 하나다.
 * 그 상태는 **누가 던지든** 같다: 사람이 치는 타석(`BattingStage`)뿐 아니라 사람이 던지고 CPU 가 치는 타석
 * (투수편 모드 4 · 팀경기 수비 반 이닝)도 못 맞힌 공은 0x11 → 0x12 를 지난다. 그래서 내가 잡은 삼진도 울린다.
 *
 * 0x9d57c: 스트라이크(스윙했거나 존 안)이고 그 전 스트라이크 st[4] > 1 이면 5 — 곧 세 번째 스트라이크다.
 * 맞힌 공(파울·타구)은 0x12 가 아니라 0x13 으로 가므로 2S 파울은 울리지 않는다.
 *
 * ⚠️ 근사(때): 웹 투구 화면은 던지는 순간에 판정이 나오므로 그 자리에서 울린다 (심판 콜과 같은 근사).
 * ⚠️ 미해결(드묾): 타석 화면 `pitchVibrationMillisecondsOf` 와 같다 — 0.1% 낫아웃·삼진 + 도루의 0x12 첫 그리기는
 *    "세 번째 스트라이크면 100ms" 로만 본다.
 *
 * @param strikesBefore 이 공 **전** 스트라이크 수
 */
export function strikeoutVibrationMillisecondsOf(
  resolution: PitchResolution | null,
  strikesBefore: number,
): number {
  if (resolution?.kind !== '스트라이크') return 0
  return strikesBefore >= STRIKEOUT_STRIKES_BEFORE ? STRIKEOUT_VIBRATION_MILLISECONDS : 0
}
