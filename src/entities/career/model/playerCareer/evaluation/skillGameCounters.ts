import { toInt16, toInt8 } from '@/entities/career/model/playerCareer/bounds'
import { hasSkill } from '@/entities/career/model/playerCareer/skills/skillEquip'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

const MONEY_GRUBBER_SKILL = 2
const HELPLESS_SKILL = 5
/** 무력감 해제 카운터가 이어지는 기준 사기 (A-4) */
const HIGH_MORALE = 90

/** 무력감 · 먹튀 경기 뒤 카운터 세 칸 (+0x1c7 · +0x1cd · +0x1c0) */
export interface SkillGameCounters {
  readonly highMoraleStreak: number
  readonly moneyGrubberGames: number
  readonly moneyGrubberPopularityGain: number
}

/**
 * **+0x1c2 이번 시즌 인기도 변화 합을 쌓는다** — 116 의 12c14~12c30 `ldrsh +0x1c2 · + ldrsb +0x4a · strh`(모드 3·4 공용).
 * 더하는 쪽 +0x4a 는 **s8 로 읽고**(−128~127 을 넘는 변화는 잘려 돈다), 합은 s16 칸에 적는다(넘치면 음수로 돈다).
 */
export function addSeasonPopularityGain(gain: number, popularityChange: number): number {
  return toInt16(gain + toInt8(popularityChange))
}

/**
 * **116 진입의 경기 뒤 카운터** (12bc2~12c84, 모드 3·4 공용 — 스킬은 `0xa3a75(S, 5|2)` 보유 비트 5 무력감 · 2 먹튀, 두 편 같은 번호):
 * ```
 * 무력감 있고 사기(0xa3a25) > 89  → s8 +0x1c7 += 1
 * 무력감 있고 사기 ≤ 89          → +0x1c7 = 0
 * 무력감 없음                     → 그대로 (지우지 않는다)
 * (s16 +0x1c2 += s8 +0x4a · 0xa4d09 — `addSeasonPopularityGain`)
 * 먹튀 있음 → s8 +0x1cd += 1 · s16 +0x1c0 += s8 +0x4a  /  없음 → 둘 다 0
 * ```
 */
export function countSkillGameCounters(
  counters: SkillGameCounters,
  input: { readonly hasHelpless: boolean; readonly hasMoneyGrubber: boolean; readonly morale: number; readonly popularityChange: number },
): SkillGameCounters {
  return {
    highMoraleStreak: highMoraleStreakAfterGame(counters.highMoraleStreak, input),
    moneyGrubberGames: input.hasMoneyGrubber ? toInt8(counters.moneyGrubberGames + 1) : 0,
    moneyGrubberPopularityGain: input.hasMoneyGrubber ? toInt16(counters.moneyGrubberPopularityGain + toInt8(input.popularityChange)) : 0,
  }
}

/** +0x1c7 — 무력감이 없으면 그대로, 있으면 사기 ≥ 90 일 때 +1 · 아니면 0 */
function highMoraleStreakAfterGame(streak: number, input: { readonly hasHelpless: boolean; readonly morale: number }): number {
  if (!input.hasHelpless) return streak
  return input.morale >= HIGH_MORALE ? toInt8(streak + 1) : 0
}

/**
 * 경기 뒤 카운터 (A-4 · 116 진입 12bc2~12c3c) — 인기도 변화가 정해진 다음에 부른다.
 *   +0x1c2 이번 시즌 인기도 변화 합 · +0x1c0/+0x1cd 먹튀 보유 중 합/경기 수
 *   +0x1c7 무력감 보유 중 "경기 뒤 사기 ≥ 90" 연속 경기 수 (`countSkillGameCounters`)
 * 먹튀 카운터는 그 스킬이 **없으면 0** 으로 되돌리고, 무력감 카운터는 없으면 **그대로 둔다**(12bee~12bfc).
 */
export function countGameForSkills(career: PlayerCareer, popularityChange: number): PlayerCareer {
  return {
    ...career,
    seasonPopularityGain: addSeasonPopularityGain(career.seasonPopularityGain, popularityChange),
    ...countSkillGameCounters(career, {
      hasHelpless: hasSkill(career, HELPLESS_SKILL),
      hasMoneyGrubber: hasSkill(career, MONEY_GRUBBER_SKILL),
      morale: career.morale,
      popularityChange,
    }),
    reputationZeroGames: countReputationZeroGame(career.reputationZeroGames, career.reputation),
  }
}

/**
 * `0xa4d08(S)` — 평판(+0x62)이 0 이면 +0x184 를 한 칸 올리고(u8, 255 → 0), 아니면 0 (0xa4d08~0xa4d24).
 * ⚠️ 원본은 연속 기록 0x8a6fc(@0x12b6e) 뒤에 부른다. 웹은 연속 기록이 주는 평판을 이 카운터 **뒤에** 더하므로
 *    그 평판이 0 을 벗어나게 하는 경기에선 한 칸 어긋날 수 있다 — 0x8a6fc 가 평판을 그 자리에서 바꾸는지 아직 안 읽었다.
 */
export function countReputationZeroGame(count: number, reputation: number): number {
  return reputation === 0 ? (count + 1) & 0xff : 0
}
