import { balanceNumber } from '@/shared/config/balance'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 스윙 타이밍 0~100 (binary.mod 0x34be0).
 * frame = 스윙 키를 누른 순간의 공 프레임 F, frameCount = 공이 나는 틱 수 N.
 * F = N−2 에서 100 이다. 특수구(type 22)는 24 → 22, N−1 → 12.
 * 원본 식은 max(cfg+0x10, cfg+0x12 × (폭 − 벌점) / 폭) 이고, 설정은 data/d_level.dat 의 D10 = 0 · D12 = 100 이다
 * (위치 분석 3차 상수표 — 점검 10차가 물은 *DAT_00034c6c 가 이 설정 객체다).
 */
const MINIMUM_FRAME_COUNT = 3

/**
 * 폭 24 · 특수구 22 · 나눔 12 · 바닥(D10) · 배율(D12) 은 숨은 판정값 표(`balance.json` timing.*)에서 부를 때마다 읽는다.
 */
export function timingOf(frame: number, frameCount: number, isSpecialPitch: boolean): number {
  return timingByWidthOf(frame, frameCount, isSpecialPitch, timingWidthOf(isSpecialPitch))
}

/**
 * **B-130 고친 길의 타이밍 폭 배율** — 폭을 1.5 배로(보통 24 → 36 · 마구 22 → 33). 벌점(틱 차이 × 100 ÷ (N − 1))은 그대로라
 * 최적(F = N − 2) 100 은 같고, 한 틱 어긋남은 70 → 80(N = 14), 두 틱은 37 → 58 로 덜 떨어진다.
 */
const WIDENED_WIDTH_NUMERATOR = 3
const WIDENED_WIDTH_DENOMINATOR = 2

/**
 * **사람 타자의 스윙 타이밍** — 원본은 `timingOf` 그대로다. B-130(타이밍 창이 한 틱뿐) 고친 길은 폭을 넓혀 한 틱 어긋남을 덜 깎는다.
 * CPU 타자(사람이 던질 때 · 간이 경기)는 원본 식 그대로 `timingOf` 를 쓴다. 굴림 없음.
 */
export function humanSwingTimingOf(frame: number, frameCount: number, isSpecialPitch: boolean): number {
  const width = timingWidthOf(isSpecialPitch)
  const widened = isBugFixed('B-130') ? Math.trunc((width * WIDENED_WIDTH_NUMERATOR) / WIDENED_WIDTH_DENOMINATOR) : width
  return timingByWidthOf(frame, frameCount, isSpecialPitch, widened)
}

function timingWidthOf(isSpecialPitch: boolean): number {
  return balanceNumber(isSpecialPitch ? 'timing.specialWidth' : 'timing.width')
}

function timingByWidthOf(frame: number, frameCount: number, isSpecialPitch: boolean, width: number): number {
  if (frameCount < MINIMUM_FRAME_COUNT) return 0
  const divisor = isSpecialPitch ? balanceNumber('timing.specialDivisor') : frameCount - 1
  const distance = Math.abs(frame - (frameCount - 2))
  const penalty = Math.trunc((distance * 100) / divisor)
  return Math.max(balanceNumber('timing.floor'), Math.trunc((balanceNumber('timing.scale') * (width - penalty)) / width))
}

// 스윙 창(키를 받는 틱 · 판정 틱 · 공 끝)은 타이밍 값과 무관하다 — `widgets/batting-stage/lib/swingWindow` (0x4e060)
