import type { EventCommand } from '@/shared/config/original/eventTypes'

export interface SeasonEventReward {
  readonly kind: number
  readonly value: number
}

/** 보상 명령들의 항목을 차례대로 모은다 */
export function seasonRewardsIn(commands: readonly EventCommand[]): SeasonEventReward[] {
  return commands.flatMap((command) => (command.op === 'reward' ? command.items : []))
}

/** 393·394·395 — 목표 결과(달성 많음 쪽): 종류 0 · 1 · 3 값 += 5y (8d550~8d580) */
const GOAL_RESULT_BONUS_EVENTS: readonly number[] = [393, 394, 395]
const GOAL_RESULT_BONUS_KINDS: readonly number[] = [0, 1, 3]
const GOAL_RESULT_BONUS_PER_YEAR = 5
/** 396 — 목표 결과(달성 없음): 종류 0 −10y · 종류 1 −2y (8d5f4~8d624) */
const GOAL_RESULT_PENALTY_EVENT = 396
const GOAL_RESULT_PENALTY_PER_YEAR: Readonly<Record<number, number>> = { 0: 10, 1: 2 }

function withGoalBonus(reward: SeasonEventReward, yearIndex: number): SeasonEventReward {
  if (!GOAL_RESULT_BONUS_KINDS.includes(reward.kind)) return reward
  return { ...reward, value: reward.value + GOAL_RESULT_BONUS_PER_YEAR * yearIndex }
}

function withGoalPenalty(reward: SeasonEventReward, yearIndex: number): SeasonEventReward {
  const perYear = GOAL_RESULT_PENALTY_PER_YEAR[reward.kind]
  if (perYear === undefined) return reward
  return { ...reward, value: reward.value - perYear * yearIndex }
}

/**
 * 목표 결과 393~396 의 **연차 보정** (`0x8d508`, 모드 2 갈래 — 직접 떴다):
 * ```
 * 393·394·395: 항목 종류 0(인기도)·1(평판)·3(소지금) 이면 값 += 5y     (8d550~8d580)
 * 396:         종류 0 이면 −10y · 종류 1 이면 −2y                     (8d5f4~8d624)
 * ```
 * y = SR+0xb3(연차 idx). **명령에 있는 항목만** 고친다 — 394 의 평판·395 의 전부는 항목이 없어 그대로다.
 */
export function withSeasonYearAdjust(rewards: readonly SeasonEventReward[], eventId: number, yearIndex: number): readonly SeasonEventReward[] {
  if (GOAL_RESULT_BONUS_EVENTS.includes(eventId)) return rewards.map((reward) => withGoalBonus(reward, yearIndex))
  if (eventId === GOAL_RESULT_PENALTY_EVENT) return rewards.map((reward) => withGoalPenalty(reward, yearIndex))
  return rewards
}
