import { abilityGradeOf } from '@/entities/fielding/model/fieldGeometry'
import { throwErrorBiasOf } from '@/entities/fielding/model/fieldingState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 수비 실수 세 가지 — 펌블(0xb401c 안 0xb41d0) · 악송구(0xa1828) · 필살수비 발동(0x66b30/0x66be4).
 * 수비 능력치가 수비에 주는 영향은 **송구 속도·악송구·펌블·필살 확률 넷뿐**이고
 * 이동 속도에는 전혀 안 들어간다 (P2 1c, 확정).
 */

const RANDOM_LIMIT = 10_000

/** 펌블 확률표 0xd87d4 = [200,180,160,140,120,100,80,50] (÷10000) — 등급 0~7 */
export const FUMBLE_PERMYRIAD: readonly number[] = [200, 180, 160, 140, 120, 100, 80, 50]

/** 만분율 펌블 확률. 수비 ≤125 면 2.0%, 925 초과면 0.5% */
export function fumbleChanceOf(defenseAbility: number): number {
  return FUMBLE_PERMYRIAD[abilityGradeOf(defenseAbility)]
}

/**
 * 펌블 굴림 — `rand(0, 10000) < 확률`.
 *
 * **I-controls 2a 정정 (P2 3절)**: 공 vt18 = 0xa27f0 은 "땅볼인가"가 아니라 **"공이 멈췄는가"** 다.
 * 그래서 펌블은 **움직이는 공을 잡을 때마다**(뜬공 직접 포구 포함) 걸리고,
 * 굴러와 멈춘 공을 주울 때만 없다. 송구 받기(공 목록 종류 4)는 이 굴림 전에 빠진다.
 */
export function rollFumble(defenseAbility: number, ballIsMoving: boolean, random: RandomPort): boolean {
  if (!ballIsMoving) return false
  return fumbleChanceOf(defenseAbility) > randomIntegerBelow(random, 0, RANDOM_LIMIT)
}

/** 악송구 기준값 = (10 − 등급) + 특수×100 + 100 (0xa1828). 특수 송구(레이저)는 오히려 1%p 더 위험하다 */
export function throwErrorChanceOf(defenseAbility: number, special = false): number {
  return throwErrorBiasOf(abilityGradeOf(defenseAbility)) + (special ? 100 : 0) + 100
}

export interface ThrowErrorResult {
  readonly errant: boolean
  /** 송구 속도 보정 (하한 100 은 부르는 쪽에서 적용한다) */
  readonly speedDelta: number
  /** 송구 방향 보정(도) */
  readonly angleDelta: number
}

export const NO_THROW_ERROR: ThrowErrorResult = { errant: false, speedDelta: 0, angleDelta: 0 }

/**
 * 악송구 굴림 (0xa1828~0xa1896).
 * ```
 * r = rand(0,10000) ; 기준 = (10 − 등급) + 특수×100 + 100
 * r < 기준 → 속도 += rand(−50, 특수?0:51) (하한 100), 방향 += rand(−49, 특수?0:50)
 * ```
 * 확률은 ≈1.03~1.10% 다.
 */
export function rollThrowError(
  defenseAbility: number,
  special: boolean,
  random: RandomPort,
): ThrowErrorResult {
  const threshold = throwErrorChanceOf(defenseAbility, special)
  if (randomIntegerBelow(random, 0, RANDOM_LIMIT) >= threshold) return NO_THROW_ERROR
  return {
    errant: true,
    speedDelta: randomIntegerBelow(random, -50, special ? 0 : 51),
    angleDelta: randomIntegerBelow(random, -49, special ? 0 : 50),
  }
}

/** 송구 속도에 적용되는 하한 (0xa1828) */
export const MINIMUM_THROW_SPEED = 100

/** 송구 거리 상한 = 17000 × 120 / 100. 넘으면 원바운드가 된다 (0xa1620, I-controls 2b) */
export const BOUNCE_THROW_DISTANCE = 20_400

/** 필살수비 발동 확률표 0xd25b0 = [1,2,3,3,4,4,5,6] (퍼센트) */
export const SPECIAL_DEFENSE_PERCENT: readonly number[] = [1, 2, 3, 3, 4, 4, 5, 6]

export interface SpecialDefenseOptions {
  /** 스킬 21 초감각 — +3%p */
  readonly hasSixthSense?: boolean
  /** 전역 모드 4(나만의리그 타자편)면 기준을 절반으로 나눈다 */
  readonly isBatterCareerMode?: boolean
}

/** 천분율 기준값 — `rand(0, 1000) < 기준` 이면 발동 (0x66b30 = 0x66be4, 표가 같다) */
export function specialDefenseThresholdOf(
  defenseAbility: number,
  options: SpecialDefenseOptions = {},
): number {
  const base = SPECIAL_DEFENSE_PERCENT[abilityGradeOf(defenseAbility)] + (options.hasSixthSense === true ? 3 : 0)
  const threshold = base * 10
  return options.isBatterCareerMode === true ? Math.trunc(threshold / 2) : threshold
}

/**
 * 필살수비 두 번 굴림 (메시지 0x11, 타구가 떠난 순간).
 * A 가 성공하면 점프 창(+0x1f5), A 가 실패했을 때만 B 를 굴려 슬라이딩 창(+0x1f6)을 연다.
 * 창을 여는 것뿐이고, 고르기(0xb3b38) 우선순위가 4·5 라 **보통 포구가 가능하면 쓰이지 않는다** (P2 3절).
 */
export function rollSpecialDefense(
  defenseAbility: number,
  random: RandomPort,
  options: SpecialDefenseOptions = {},
): { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean } {
  const threshold = specialDefenseThresholdOf(defenseAbility, options)
  if (randomIntegerBelow(random, 0, 1000) < threshold) return { jumpUnlocked: true, slideUnlocked: false }
  const second = randomIntegerBelow(random, 0, 1000) < threshold
  return { jumpUnlocked: false, slideUnlocked: second }
}
