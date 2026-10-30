import type { EventReward } from '@/entities/pitcher-career/model/pitcherStreaks/otherSlices'
import { EVENT_REWARD_KIND } from '@/entities/pitcher-career/model/pitcherStreaks/otherSlices'
import type { PitcherStreakEventInput } from '@/entities/pitcher-career/model/pitcherStreaks/streakEvent'

/** 투수 보유 비트 (0xa3a75) — 보상 값은 비트 + 1 (8ad22~8af8a) */
const SKILL_BIT = { 집중: 15, 새가슴: 17, 더티볼: 20 } as const
/** 집중 — [1] 이 선발 12 · 구원 24 일 때 (8ad5e~8ad72) */
const FOCUS_STARTER_STREAK = 12
const FOCUS_RELIEF_STREAK = 24
/** 새가슴 얻기 — 연차 S+0xb3 > 1 이고 S+0x1d8[5](피안타) 가 선발 > 14 · 구원 > 5 (8adde~8ae66) */
const CHICKEN_HEART_YEAR_ABOVE = 1
const CHICKEN_HEART_STARTER_HITS_ABOVE = 14
const CHICKEN_HEART_RELIEF_HITS_ABOVE = 5
/** 새가슴 풀기 — 가졌고 [0] 이 선발 5 · 구원 7 (8aea0~8aeee) */
const CHICKEN_HEART_CLEAR_STARTER = 5
const CHICKEN_HEART_CLEAR_RELIEF = 7
/** 더티볼 얻기 — S+0x1d8[4](볼넷+사구) > 3 (8af2a~8af52) */
const DIRTY_BALL_WALKS_ABOVE = 3

/**
 * 0x8a6fc 의 스킬 명령(종류 4) — 평판 명령 뒤에 이 차례로 쌓는다:
 *   집중 15 (+16): 없고 [1] == 선발 12 · 구원 24
 *   새가슴 17 (+18): 없고 연차 > 1 이고 피안타 > 선발 14 · 구원 5 / (그 밖에) 가졌고 [0] == 선발 5 · 구원 7 → −18
 *   더티볼 20 (+21): 없고 볼넷+사구 > 3
 */
export function streakSkillRewardsOf(input: PitcherStreakEventInput, isStarter: boolean): EventReward[] {
  const owns = (bit: number) => input.skillIds.includes(bit)
  const rewards: EventReward[] = []
  const focusStreak = isStarter ? FOCUS_STARTER_STREAK : FOCUS_RELIEF_STREAK
  if (input.streaks.strikeout === focusStreak && !owns(SKILL_BIT.집중)) rewards.push(skillGained(SKILL_BIT.집중))
  const chickenHeart = chickenHeartRewardOf(input, isStarter, owns(SKILL_BIT.새가슴))
  if (chickenHeart !== null) rewards.push(chickenHeart)
  if (!owns(SKILL_BIT.더티볼) && input.walksAndHitByPitch > DIRTY_BALL_WALKS_ABOVE) rewards.push(skillGained(SKILL_BIT.더티볼))
  return rewards
}

const skillGained = (bit: number): EventReward => ({ kind: EVENT_REWARD_KIND.스킬, value: bit + 1 })

/** 새가슴 — 없으면 2년차부터 피안타로 얻고, 가졌으면 [0] 으로 푼다 */
function chickenHeartRewardOf(input: PitcherStreakEventInput, isStarter: boolean, owned: boolean): EventReward | null {
  if (input.season - 1 > CHICKEN_HEART_YEAR_ABOVE && !owned) {
    const limit = isStarter ? CHICKEN_HEART_STARTER_HITS_ABOVE : CHICKEN_HEART_RELIEF_HITS_ABOVE
    return input.hitsAllowed > limit ? skillGained(SKILL_BIT.새가슴) : null
  }
  if (!owned) return null
  const clearAt = isStarter ? CHICKEN_HEART_CLEAR_STARTER : CHICKEN_HEART_CLEAR_RELIEF
  return input.streaks.win === clearAt ? { kind: EVENT_REWARD_KIND.스킬, value: -(SKILL_BIT.새가슴 + 1) } : null
}
