/**
 * 스윙 타이밍 0~100 (binary.mod 0x34be0).
 * frame = 스윙 키를 누른 순간의 공 프레임 F, frameCount = 공이 나는 틱 수 N.
 * F = N−2 에서 100 이다. 특수구(type 22)는 24 → 22, N−1 → 12.
 * 원본 식은 max(cfg+0x10, cfg+0x12 × (폭 − 벌점) / 폭) 이고, 설정은 data/d_level.dat 의 D10 = 0 · D12 = 100 이다
 * (위치 분석 3차 상수표 — 점검 10차가 물은 *DAT_00034c6c 가 이 설정 객체다).
 */
const MINIMUM_FRAME_COUNT = 3
const TIMING_WIDTH = 24
const SPECIAL_TIMING_WIDTH = 22
const SPECIAL_DIVISOR = 12
/** d_level.dat D10 · D12 */
const TIMING_FLOOR = 0
const TIMING_SCALE = 100

export function timingOf(frame: number, frameCount: number, isSpecialPitch: boolean): number {
  if (frameCount < MINIMUM_FRAME_COUNT) return 0
  const width = isSpecialPitch ? SPECIAL_TIMING_WIDTH : TIMING_WIDTH
  const divisor = isSpecialPitch ? SPECIAL_DIVISOR : frameCount - 1
  const distance = Math.abs(frame - (frameCount - 2))
  const penalty = Math.trunc((distance * 100) / divisor)
  return Math.max(TIMING_FLOOR, Math.trunc((TIMING_SCALE * (width - penalty)) / width))
}

// 스윙 창(키를 받는 틱 · 판정 틱 · 공 끝)은 타이밍 값과 무관하다 — `widgets/batting-stage/lib/swingWindow` (0x4e060)
