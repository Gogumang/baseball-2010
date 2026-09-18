import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 도루.
 *
 * 원작 미션 "기동력은 나의 힘 — 번트와 도루를 1개씩 성공시키자!"에 필요하다.
 * 능력치 설명(StrHOWTO[12])에 "주루 : 주루, 수비 이동 속도"라고 되어 있어
 * 주루가 성공률을 좌우한다. 투수의 구속이 빠를수록 송구가 빨라 잡기 쉽다.
 */

/** 주루 0인 주자의 성공률 */
const BASE_SUCCESS = 0.25
/** 주루 100이 더해주는 성공률 */
const RUN_BONUS = 0.55
/** 구속 100인 투수가 깎는 성공률 */
const VELOCITY_PENALTY = 0.25

export type StealResult = '성공' | '실패'

export function stealChanceOf(runner: BatterAbility, pitcher: PitcherAbility): number {
  const chance =
    BASE_SUCCESS + (runner.run / 100) * RUN_BONUS - (pitcher.velocity / 100) * VELOCITY_PENALTY
  return Math.min(0.95, Math.max(0.05, chance))
}

export function attemptSteal(
  runner: BatterAbility,
  pitcher: PitcherAbility,
  random: RandomPort,
): StealResult {
  return random.next() < stealChanceOf(runner, pitcher) ? '성공' : '실패'
}
