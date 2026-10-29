import { advanceStreaks } from '@/entities/career/model/gameEvaluation/streak/advanceStreaks'
import { streakNoticesOf, type StreakNotice } from '@/entities/career/model/gameEvaluation/streak/streakNotices'
import { EVENT_REWARD_KIND, type EventReward } from '@/entities/career/model/gameEvaluation/otherSlices'
import { applySkillReward, gainReputation, hasSkill, type PlayerCareer } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'

const SLUMP_SKILL = 17
const SLUMP_SKILL_YEAR = 3
const SLUMP_GAIN_STREAK = 4
const SLUMP_CLEAR_STREAK = 10

/** 슬럼프 스킬 — 무안타 4 · 3년차 이상이면 얻고, 멀티히트 10 이면 푼다 */
interface SlumpChange {
  readonly gains: boolean
  readonly clears: boolean
}

const slumpChangeOf = (career: PlayerCareer): SlumpChange => ({
  gains: career.season >= SLUMP_SKILL_YEAR && career.streaks.hitless === SLUMP_GAIN_STREAK,
  clears: career.streaks.multiHit === SLUMP_CLEAR_STREAK,
})

/** 스킬 보상 값 — 얻기 +18 · 풀기 −18 (보유 여부를 보고), 없으면 null */
function slumpRewardValue(career: PlayerCareer, slump: SlumpChange): number | null {
  const owned = hasSkill(career, SLUMP_SKILL)
  if (slump.gains && !owned) return SLUMP_SKILL + 1
  if (slump.clears && owned) return -(SLUMP_SKILL + 1)
  return null
}

/** 슬럼프 스킬 얻기/풀기 — 얻기를 먼저 보고, 그 결과로 풀기를 본다 */
function applySlumpSkill(target: PlayerCareer, slump: SlumpChange): PlayerCareer {
  const gained = slump.gains && !hasSkill(target, SLUMP_SKILL) ? applySkillReward(target, SLUMP_SKILL + 1) : target
  return slump.clears && hasSkill(gained, SLUMP_SKILL) ? applySkillReward(gained, -(SLUMP_SKILL + 1)) : gained
}

/** 보상 명령 차례 — 알림이 있으면 평판 합(s16), 이어서 슬럼프 스킬 하나 */
function rewardsOf(career: PlayerCareer, notices: readonly StreakNotice[], reputation: number, slump: SlumpChange): EventReward[] {
  const rewards: EventReward[] = []
  if (notices.length > 0) rewards.push({ kind: EVENT_REWARD_KIND.평판, value: (reputation << 16) >> 16 })
  const skillValue = slumpRewardValue(career, slump)
  if (skillValue !== null) rewards.push({ kind: EVENT_REWARD_KIND.스킬, value: skillValue })
  return rewards
}

/**
 * **116 경기 뒤 평가 이벤트의 연속 기록 몫** — 0x8a6fc 가 지금 연속 기록 칸을 표(기준값)와 견줘 알림 줄과 **보상 명령**
 * (종류 7 · 스킬 kind 4 값 ±18 등, 8ad22~8adba 직접 떴다)을 내장 이벤트에 쌓는다. 0x8a6fc 는 저장 칸을 직접 고치지 않고
 * (쓰는 곳은 이벤트 관리자·명령 객체뿐) 보상은 114 가 그 이벤트를 틀 때 먹는다 — 그래서 116 을 다시 띄우면 또 먹는다.
 * `apply` 가 그 보상(평판 합 · 슬럼프 스킬 얻기/풀기)을 얹는다.
 */
export function streakEventOf(career: PlayerCareer): {
  readonly notices: readonly StreakNotice[]
  /**
   * 0x8a6fc 가 쌓는 **보상 명령**(종류 7) 차례 — 명령마다 항목 하나. 알림이 있으면 평판 합(8ac54~8ac64: 종류 1 · 값 [sp+0x20] s16),
   * 이어서 슬럼프 얻기 +18(8ac68~8accc: 무안타 4 · 연차 S+0xb3 > 1 · 타자편 · 미보유) 또는 풀기 −18(8acd0~8ad32: 멀티히트 10 · 보유).
   * 114 가 틀 때 0x8d4c4 가 명령마다 창을 띄운다(평판 = 공용 알림 · 스킬 = 스킬 창 0x8e054) — `EvaluationEventPlayer`
   */
  readonly rewards: readonly EventReward[]
  /** 슬럼프 스킬 얻기/풀기만 */
  readonly applySkills: (target: PlayerCareer) => PlayerCareer
  /** 스킬과 평판 합 둘 다 */
  readonly apply: (target: PlayerCareer) => PlayerCareer
} {
  const notices = streakNoticesOf(career.streaks)
  const slump = slumpChangeOf(career)
  const reputation = notices.reduce((total, notice) => total + notice.reputationChange, 0)
  const applySkills = (target: PlayerCareer): PlayerCareer => applySlumpSkill(target, slump)
  const rewards = rewardsOf(career, notices, reputation, slump)
  return { notices, rewards, applySkills, apply: (target) => gainReputation(applySkills(target), reputation) }
}

/**
 * 경기 뒤 연속 기록을 잇고, 기준값과 정확히 같으면 알림·스킬을 준다 (칸 잇기 + 0x8a6fc 의 스킬 보상).
 * ⚠️ 평판 몫은 넣지 않는다 — 예전 호출과 같게 부르는 쪽이 `notices` 의 평판을 더한다(`streakEventOf` 는 둘 다 얹는다).
 */
export function updateStreaks(career: PlayerCareer, stats: SeasonStats) {
  const advanced = advanceStreaks(career, stats)
  const event = streakEventOf(advanced)
  return { career: event.applySkills(advanced), notices: [...event.notices] }
}
