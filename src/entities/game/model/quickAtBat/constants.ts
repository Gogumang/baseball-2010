import { BALANCE } from '@/shared/config/original/balance'

/**
 * 간이 타석(0xc262c · 0xc11f0 · 0xc1818)의 원본 상수 — 값은 `BALANCE.quickAtBat`(d_level · 코드 즉값)에서 읽는다.
 */
export const RANDOM_LIMIT = 10_000
/** 코스 오차의 원본 범위 rand(−13, 21) */
export const SPREAD_RANGE = BALANCE.quickAtBat.spreadRange
/** 호출자가 넘기는 기본 스윙 세기 (0x4b) */
export const BASE_POWER = BALANCE.quickAtBat.basePower
/** 스윙이 약해질지 보는 판정 — rand(0,10000) ≤ 2999 (0xc1584) */
export const WEAK_SWING_GATE = BALANCE.quickAtBat.weakSwingGate
/** 코스가 좁혀질지 보는 판정 — rand(0,10000) ≤ 1499 (0xc1590) */
export const TIGHT_COURSE_GATE = BALANCE.quickAtBat.tightCourseGate
export const TIGHT_COURSE_GAIN = BALANCE.quickAtBat.tightCourseGain
/** d_level.dat 0x10·0x12 — 스윙 세기를 [0, 100] 으로 다시 펼친다 (지금 값으로는 그대로다) */
export const POWER_SCALE = BALANCE.quickAtBat.powerScale
/** 연장에 들어가면 이닝마다 세기가 오르고 코스가 좁아져 경기가 끝나게 만든다 */
export const EXTRA_INNING_FROM = BALANCE.quickAtBat.extraInningFrom
export const EXTRA_INNING_POWER_STEP = BALANCE.quickAtBat.extraInningPowerStep
export const EXTRA_INNING_POWER_FLOOR = BALANCE.quickAtBat.extraInningPowerFloor
export const EXTRA_INNING_DIVISOR_UNIT = 20
/** 안타를 한 루 더 늘릴지 보는 주력 판정의 상한 (0xc1804) */
export const EXTRA_BASE_LIMIT = BALANCE.quickAtBat.extraBaseLimit
export const STRIKES_FOR_STRIKEOUT = 3
/** 볼 카운트가 이 값을 넘으면 포볼이다 — 0x9d57c 가 `볼 <= 2` 일 때만 볼을 센다 */
export const BALLS_BEFORE_WALK = 3
