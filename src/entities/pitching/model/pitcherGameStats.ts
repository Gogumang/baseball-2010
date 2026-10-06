import { abilityAfterFatigue } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'

/**
 * **사람 타석에서 공을 던지는 CPU 투수의 경기용 능력치** — 원본 `0xb570c` 를 체력%와 함께 부른 값.
 *
 * 투구 화면 0x34968 · 제구 등급 0x4dbac 가 지금 수비 투수 P = `0xae83c(팀)` 로 이렇게 부른다 (디스어셈 대조):
 * ```
 * 34974  P = 0xae83c(팀) ; st = 0xaebb0(팀)                ; 체력% = trunc(P+0x2c / 100), 모드 7 이면 100
 * 3499e  c = 0xb570c(로스터, 0, P, 1, [sp]=st, [sp+4]=1)    ; 제구 · 349b6 칸 1 구속 · 349ce 칸 2 변화
 * 4dc30  c = 0xb570c(로스터, 0, P, st', 1)  (st' = ldrsh P+0x2c / 100 — 0xaebb0 의 모드 7 갈래가 없다)
 * 4dc4a  t = 0xb74bc(전역, c, 0xaebb0(팀))                 ; 제구 등급 — 셋째 인자가 0 이면 지친 갈래
 * ```
 * `0xb570c` 안의 차례 (G-1a · P7 G1 · J 2·4 — 확정):
 * ```
 * b5728  v = 0xb6414(rec, k, 1)                  ; 마선수 배율 → 장비 → 스킬
 *        모드 가지 (시즌 질병·보직·사기 / 나리 질병·부상·사기)
 * b58e6  체력 구간 감소 — [sp+0x24](= 부르는 쪽 [sp]) 가
 *          > 54 그대로 · 35~54 v += v/(−10) · 20~34 v += (v−16v)·2/100 · 1~19 v −= v/2 · ≤ 0 v += −90v/100
 *          (나눗셈은 0xca7b5 = 0 쪽 버림. `abilityAfterFatigue` 와 같은 값이다)
 * b592c  팀 능력치 정액 (모드 1·2·8·9) → b5a74 코치 정액 (모드 2)
 * b5b06  0..999 로 한 번 자른다
 * ```
 * 곧 피로는 **팀·코치 정액보다 먼저** 먹는다 — 이미 정액을 더한 값에 피로를 먹이면 값이 달라진다.
 * 그래서 재료를 피로 앞(`beforeFatigue`)과 피로 뒤 정액(`bonusAfterFatigue`)으로 받는다.
 *
 * 실투 판정 0x33cbc 의 구속은 `0xb570d(ctx, 1, 투수, 1, 90, 1)` — 체력 인자 **90** 이라 피로가 없다
 * (P7 G1 표). 그 값은 `mistakeVelocity` 로 따로 낸다.
 */

/** 원본 능력치 상한 — 0xb5b06 */
const ABILITY_LIMIT = 999

/** 체력 인자가 이 값이면 0xb58e6 이 아무것도 안 깎는다 (타자·야수·실투 쪽이 넘기는 상수 0x5a) */
export const NO_FATIGUE_STAMINA_PERCENT = 90

/** 투구 엔진 능력치(0~100)를 원본 눈금(0~999)으로 — 원본 재료가 없는 호출처의 옛 경계 */
const LEGACY_SCALE = 10

/** 제구·구속·변화 세 칸 (원본 눈금) */
export interface PitcherStatTriple {
  readonly control: number
  readonly velocity: number
  readonly breaking: number
}

/** `0xb570c` 를 피로(0xb58e6) 앞뒤로 쪼갠 재료 */
export interface PitcherGameAbilityParts {
  /**
   * 0xb58e6 에 들어가기 **전** 값 — `0xb6414(rec, k, 1)` 실효값에 모드 가지(시즌 질병·보직·사기,
   * 나리 질병·부상·사기)까지 먹인 값. 0..999 로 **자르기 전** 그대로 넘긴다(냉정 22 로 999 를 넘은 제구 등).
   * 일반 로스터 투수는 마선수 배율·장비·스킬이 없어 레코드 밑값 그대로다.
   */
  readonly beforeFatigue: PitcherStatTriple
  /**
   * 0xb58e6 **뒤에** 더하는 정액 — 팀 능력치(0xb592c, 모드 1·2·8·9 — `teamAbilityBonusOf`) +
   * 코치(0xb5a74, 모드 2). 없으면 0 (모드 3~7 은 둘 다 없다).
   */
  readonly bonusAfterFatigue?: PitcherStatTriple
}

const clamp = (value: number) => Math.min(ABILITY_LIMIT, Math.max(0, value))

/** `0xb570c` 한 칸 — 피로 앞 값 · 체력% · 피로 뒤 정액 → 0..999 */
export function pitcherGameStatOf(beforeFatigue: number, staminaPercent: number, bonusAfterFatigue = 0): number {
  return clamp(abilityAfterFatigue(beforeFatigue, staminaPercent) + bonusAfterFatigue)
}

/** 세 칸을 한꺼번에 */
export function pitcherGameStatsOf(parts: PitcherGameAbilityParts, staminaPercent: number): PitcherStatTriple {
  const bonus = parts.bonusAfterFatigue
  return {
    control: pitcherGameStatOf(parts.beforeFatigue.control, staminaPercent, bonus?.control ?? 0),
    velocity: pitcherGameStatOf(parts.beforeFatigue.velocity, staminaPercent, bonus?.velocity ?? 0),
    breaking: pitcherGameStatOf(parts.beforeFatigue.breaking, staminaPercent, bonus?.breaking ?? 0),
  }
}

/** CPU 투구 한 번이 쓰는 투수 값 */
export interface CpuPitchStats extends PitcherStatTriple {
  /** 실투 판정 0x33cbc 의 구속 — 체력 인자 90 이라 피로 없음 */
  readonly mistakeVelocity: number
  /** 0xb74bc 셋째 인자 `0xaebb0(팀) != 0` — 거짓이면 제구 등급이 두 칸 내려간다 */
  readonly isNotExhausted: boolean
}

/**
 * `selectPitch` 가 쓰는 투수 값.
 *
 * - `gameAbility` 가 있으면 위 원본 차례 그대로 (`staminaPercent` 없으면 피로 없음).
 * - 없으면 옛 경계 — 0~100 칸 × 10. 이 값은 부르는 쪽이 이미 팀 보정을 더하고 ÷10 반올림한 것이라
 *   (537 → 540) 원본과 다르다. `staminaPercent` 를 함께 넘기면 그 값에 피로를 먹이는데,
 *   **팀·코치 정액 뒤에 먹이는 셈이라 원본 차례와 다르다(근사)** — 원본 재료를 넘기는 것이 맞다.
 * - `staminaPercent` 가 없으면 지치지 않은 것으로 본다 (기존 동작).
 */
export function cpuPitchStatsOf(pitcher: PitcherAbility): CpuPitchStats {
  const staminaPercent = pitcher.staminaPercent ?? NO_FATIGUE_STAMINA_PERCENT
  const isNotExhausted = staminaPercent !== 0
  const parts: PitcherGameAbilityParts = pitcher.gameAbility ?? {
    beforeFatigue: {
      control: pitcher.control * LEGACY_SCALE,
      velocity: pitcher.velocity * LEGACY_SCALE,
      breaking: (pitcher.breaking ?? pitcher.velocity) * LEGACY_SCALE,
    },
  }
  const stats = pitcherGameStatsOf(parts, staminaPercent)
  return {
    ...stats,
    mistakeVelocity: pitcherGameStatOf(
      parts.beforeFatigue.velocity,
      NO_FATIGUE_STAMINA_PERCENT,
      parts.bonusAfterFatigue?.velocity ?? 0,
    ),
    isNotExhausted,
  }
}
