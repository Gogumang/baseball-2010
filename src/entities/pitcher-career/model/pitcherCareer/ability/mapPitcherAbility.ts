import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'

/** 네 칸(제구 · 구속 · 변화 · 체력)마다 같은 셈을 돌린 능력치 — 칸 차례는 레코드 +0xc 부터의 차례 그대로 */
export function mapPitcherAbility(valueOf: (key: keyof PitcherAbility) => number): PitcherAbility {
  return {
    control: valueOf('control'),
    velocity: valueOf('velocity'),
    breaking: valueOf('breaking'),
    stamina: valueOf('stamina'),
  }
}
