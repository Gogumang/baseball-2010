import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'

/**
 * 구속 단계 0~3 (binary.mod 0x34968 · 0x66c98, 위치 분석 3차).
 * 능력치(0~999)마다 등급 배율을 곱해 999 로 자르고, 구질별 식으로 v 를 낸 뒤 rank(0~7)/2 를 단계로 쓴다.
 * 단계가 곧 pitch.zt1 비행 프레임 칸(flightSteps)이다. 레벨 7·9 예외(FASTBALL·CURVE·GYRO)는 레벨이 없어 뺐다.
 */
export interface PitchingStats {
  /** a0 제구 */
  readonly control: number
  /** a1 구속 */
  readonly velocity: number
  /** a2 변화 */
  readonly breaking: number
}

const TIER_PERCENT = [70, 80, 90, 100, 105, 110]
const MAXIMUM_STAT = 999
const RANK_LIMITS = [125, 250, 375, 525, 675, 825, 925]

type Formula = (control: number, velocity: number, breaking: number) => number
const t = Math.trunc
const FORMULAS: Readonly<Record<string, Formula>> = {
  A: (a0, a1) => t((a0 * 3) / 10) + t((a1 * 7) / 10),
  B: (a0, a1) => t(a0 / 5) + t((a1 * 8) / 10),
  C: (a0, a1, a2) => t(a0 / 5) + t(a1 / 2) + t((a2 * 3) / 10),
  D: (a0, a1, a2) => t(a0 / 5) + t((a1 * 3) / 10) + t(a2 / 2),
  E: (a0, _a1, a2) => t((a0 * 3) / 10) + t((a2 * 7) / 10),
  F: (a0, _a1, a2) => t(a0 / 5) + t((a2 * 8) / 10),
}
/** 구질 1~21 → 식 (표 0x66c98) */
const FORMULA_OF_TYPE = 'AABDCCDEFABDCCDEFBDCF'

export function pitchSpeedStageOf(typeIndex: number, stats: PitchingStats, controlTier: number): number {
  const percent = TIER_PERCENT[Math.max(0, Math.min(controlTier, TIER_PERCENT.length - 1))]
  const scale = (value: number) => Math.min(MAXIMUM_STAT, t((value * percent) / 100))
  const formula = FORMULAS[FORMULA_OF_TYPE[typeIndex] ?? 'A']
  const speed = Math.max(0, Math.min(MAXIMUM_STAT, formula(scale(stats.control), scale(stats.velocity), scale(stats.breaking))))
  const rank = RANK_LIMITS.findIndex((limit) => speed <= limit)
  return t((rank < 0 ? RANK_LIMITS.length : rank) / 2)
}

/** 공이 나는 틱 수 N (투구 레코드 frames) */
export function pitchFrameCountOf(typeIndex: number, stats: PitchingStats, controlTier: number): number {
  const steps = PITCH_TYPES[typeIndex].flightSteps
  return steps[Math.min(pitchSpeedStageOf(typeIndex, stats, controlTier), steps.length - 1)]
}
