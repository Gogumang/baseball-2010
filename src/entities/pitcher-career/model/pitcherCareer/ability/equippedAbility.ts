import { balanceNumber } from '@/shared/config/balance'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { mapPitcherAbility } from '@/entities/pitcher-career/model/pitcherCareer/ability/mapPitcherAbility'
import { MAXIMUM_ABILITY } from '@/entities/pitcher-career/model/pitcherCareer/constants'
import { isPitcherSkillEquipped } from '@/entities/pitcher-career/model/pitcherCareer/skills/pitcherSkills'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 실효 능력치 스킬 보정 (0xb6414 — 0xb64b0~0xb653c). 모두 **장착** 비트 0xb62b4(선수기록 +0x14) 를 본다.
 *   5 −100 · 7 +50 은 네 칸 모두, 22 는 `0xb6278(선수)`(투수인가) 참이고 칸 0(제구)일 때만.
 *   타자 스킬 20(수비 −100)은 `0xb6278` 거짓일 때만이라 투수 레코드에는 붙지 않는다.
 */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7
const COOL_SKILL = 22
// 5 의 −100 · 7 의 +50 은 숨은 판정값 표 `ability.skillPenalty` · `ability.legendSkillBonus`
/** 냉정 22: `v += v / 10` (0xb6506~0xb6510, 나눗셈 0xca7b5 = 0 쪽 버림) */
const COOL_CONTROL_DIVISOR = 10

/** 0xb6414 가 읽는 칸 — 밑 능력치 · 장비 니블 · 장착 비트 */
type EquippedAbilitySource = Pick<PitcherCareer, 'ability' | 'equipmentLevels' | 'equippedSkillIds'>

/**
 * `0xb6414(기록, i, 1)` — 육성 선수라 마선수 배율(0xb63a0 = −1)은 건너뛰고, 원본 차례 그대로:
 *   1. 장비 니블 보너스 0xd8890[n−1] 을 더하고 999 로 자른다 (0xb6494~0xb64a8, 바닥 없음)
 *   2. 5 장착이면 −100, 0 아래면 0 (0xb64b0~0xb64c8)
 *   3. 7 장착이면 +50, 999 로 자른다 (0xb64ca~0xb64e4)
 *   4. 투수이고 22 장착이고 칸 0(제구)이면 `v += trunc(v/10)` — **자르지 않는다** (0xb64e6~0xb6510)
 *      그래서 제구는 999 를 넘을 수 있다(최대 999 + 99). 칭호 0x1ad7e 는 이 값을 `> 998` 로 보고,
 *      경기용 0xb570c 는 맨 끝(0xb5b06)에서야 0..999 로 자른다.
 */
export function equippedPitcherAbilityOf(career: EquippedAbilitySource): PitcherAbility {
  return mapPitcherAbility((key) => equippedAbilityValueOf(career, key))
}

function equippedAbilityValueOf(career: EquippedAbilitySource, key: keyof PitcherAbility): number {
  let value = Math.min(MAXIMUM_ABILITY, career.ability[key] + equipmentBonusOf(career.equipmentLevels[key]))
  if (isPitcherSkillEquipped(career, POWERLESS_SKILL)) value = Math.max(0, value - balanceNumber('ability.skillPenalty'))
  if (isPitcherSkillEquipped(career, LEGEND_SKILL)) value = Math.min(MAXIMUM_ABILITY, value + balanceNumber('ability.legendSkillBonus'))
  const isCoolControl = key === 'control' && isPitcherSkillEquipped(career, COOL_SKILL)
  if (isCoolControl) value += Math.trunc(value / COOL_CONTROL_DIVISOR)
  return value
}
