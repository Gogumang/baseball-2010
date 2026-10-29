import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { applySkillReward, isMinusSkill, isSkillEquipped, MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import type { BatterAbility } from '@/entities/career/model/gpItems/otherSlices'
import { ITEM, type GpItemCareer, type GpItemRules } from '@/entities/career/model/gpItems/types'

const ABILITY_ORDER: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const ABILITY_ITEM_GAIN = 10
const MAXIMUM_ABILITY = 999
const MORALE_ITEM_GAIN = 40
const CURE_COOLDOWN = 20
/** 이글아이 한 번에 +20경기 · 상한 99 (0xa49a6) */
export const EAGLE_EYE_GAMES = 20
const MAXIMUM_EAGLE_EYE_GAMES = 99

/**
 * 기본값 +10 (999 로 자름) 뒤, **기본값이** 한계보다 크면 한계로 내린다 (0xa4488, G-5 확정).
 * 비교에 쓰는 값은 **장비·스킬을 뺀 기본 능력치**다 — 앞서 웹은 `effectiveAbilityOf`(장착 보너스 포함)로
 * 비교해서, 장비가 있으면 기본값을 한계 **아래로** 깎아 버렸다.
 */
function raiseWithinLimit(career: PlayerCareer, abilities: readonly (keyof BatterAbility)[]): PlayerCareer {
  const limits = abilityLimitOf(career.battingTypeIndex)
  let next = career
  for (const key of abilities) {
    const raised = Math.min(MAXIMUM_ABILITY, next.ability[key] + ABILITY_ITEM_GAIN)
    const capped = raised > limits[key] ? Math.min(limits[key], MAXIMUM_ABILITY) : raised
    next = { ...next, ability: { ...next.ability, [key]: capped } }
  }
  return next
}

/**
 * 종합건강진단(7)·복권 메디카상 (0xa4888 · 0xa492e, 같은 코드 두 벌) — 원본은 조건 없이 지운다:
 * 질병 +5 = 0 · 기간 +6 = [0xd80d2] = 0 · 쿨다운 +0x7c = 20 · 부상 기간 +0x1b5 = 0 · +0x1ce = 0 · 부상 경기 수 +0x1b6 = 0.
 * 원본 부상 판정은 +0x1b5 > 0 (0xb57b4) 이라 남은 기간도 반드시 0 으로 맞춘다.
 */
const cure = <T extends GpItemCareer>(career: T): T => ({
  ...career,
  isInjured: false,
  injuryRemaining: 0,
  injuredGamesPlayed: 0,
  isSick: false,
  illnessName: null,
  illnessRemaining: 0,
  illnessCooldown: CURE_COOLDOWN,
})

/** 0xa4970~0xa499e 가 도는 스킬 번호 0~23 (`cmp r4,#0x17`) */
const LAST_HYPNOSIS_SKILL_ID = 23

/**
 * 최면요법(8) — 0xa4970: 스킬 0~23 중 **장착(0xb62b4)이고 마이너스** 인 것마다 제거 0xa4430 을 부른다.
 * 0xa4430 은 보유·장착을 끄고 해제 이력(+0x1d0, 0xa43fc)을 남긴다 — 보상 4 의 음수 갈래와 같은 함수다.
 * 마이너스 스킬은 늘 장착이라 결과적으로 가진 마이너스 스킬이 다 지워진다.
 */
function removeEquippedMinusSkills<T extends GpItemCareer>(career: T): T {
  let next = career
  for (let skillId = 0; skillId <= LAST_HYPNOSIS_SKILL_ID; skillId += 1) {
    if (isSkillEquipped(next, skillId) && isMinusSkill(skillId)) next = applySkillReward(next, -(skillId + 1))
  }
  return next
}

/** 타자편 규칙 — 타입 한계 표 · 이글아이 */
export const BATTER_GP_RULES: GpItemRules<PlayerCareer> = {
  applyAbilityItem: (career, id) => raiseWithinLimit(career, id === ITEM.도시락 ? ABILITY_ORDER : [ABILITY_ORDER[id]]),
  applyNinthItem: (career) => ({
    ...career,
    eagleEyeGamesRemaining: Math.min(MAXIMUM_EAGLE_EYE_GAMES, career.eagleEyeGamesRemaining + EAGLE_EYE_GAMES),
  }),
}

/** 영지버섯 사기 +40 — 0xa3a24 로 읽고 0xa3a44 로 쓴다 (0~100) */
const gainItemMorale = <T extends GpItemCareer>(career: T): T => ({
  ...career,
  morale: Math.min(MAXIMUM_MORALE, Math.max(0, career.morale + MORALE_ITEM_GAIN)),
})

type ItemEffect = <T extends GpItemCareer>(rules: GpItemRules<T>, career: T) => T

/** 아이템 6~9 의 효과 (0~4 는 능력치 규칙, 5 는 복권) */
const ITEM_EFFECTS: Readonly<Record<number, ItemEffect>> = {
  [ITEM.영지버섯]: (_rules, career) => gainItemMorale(career),
  [ITEM.건강진단]: (_rules, career) => cure(career),
  [ITEM.최면요법]: (_rules, career) => removeEquippedMinusSkills(career),
  [ITEM.이글아이]: (rules, career) => rules.applyNinthItem(career),
}

export function applyEffect<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, id: number): T {
  if (id <= ITEM.도시락) return rules.applyAbilityItem(career, id)
  const effect = ITEM_EFFECTS[id]
  if (effect === undefined) throw new Error(`알 수 없는 GP 아이템 번호입니다 (0~9): ${id}`)
  return effect(rules, career)
}
