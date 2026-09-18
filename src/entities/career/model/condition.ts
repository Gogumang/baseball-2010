import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, MAXIMUM_ABILITY } from '@/entities/career/model/playerCareer'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 선수 상태 — 부상·질병 (StrHOWTO[14]).
 *   "사기가 낮으면 부상이나 질병에 걸릴 확률이 높아집니다 … 추가 능력치 페널티를 받습니다"
 *   부상: StrMODE[212] "부상으로 선수 능력치가 60% 감소하였습니다"
 *   질병: r_event_txt[537] "질병으로 선수 능력치가 30% 감소하였습니다"
 *   질병 이름: StrMODE[186]~[189]
 * 질병은 원본에서 이벤트 490(조건 22 — 사기 구간 확률)로만 걸린다 → storyScene.
 * 부상은 훈련 결과 창을 닫을 때 굴린다 (rollTrainingInjury, 0x1b4c4).
 * 둘 다일 때 더 큰 감소만 적용하는 것은 추정이다.
 */
export const ILLNESS_NAMES: readonly string[] = ['감기', '몸살', '식중독', '배탈']

/** 부상 남은 기간 (0x1b4c4 가 +0x1b5 = 3) */
const INJURY_DURATION = 3
const INJURY_ABILITY_RATIO = 0.4
const ILLNESS_ABILITY_RATIO = 0.7

/** 실효 능력치 스킬 보정 (0xb6414, 누락 탐색 5차) — 스킬 20 은 수비(인덱스 2)만 */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7
const DEFENSE_PENALTY_SKILL = 20
const SKILL_PENALTY = 100
const LEGEND_BONUS = 50

const clampAbility = (value: number) => Math.min(MAXIMUM_ABILITY, Math.max(0, value))

/**
 * 경기에 쓰는 능력치 (0xb6414 순서, 단계마다 0~999 로 자른다 — 점검 10차):
 *   1. 비율(버림) — 원본 표 0xd88aa 는 마선수 레벨 배율이라 육성 선수는 100% 다 (누락 탐색 6차).
 *      부상 60%·질병 30% 감소는 문구(StrMODE[212]·r_event_txt[537])대로 이 자리에서 곱한다 (자리는 추정)
 *   2. 장착 레벨 보너스 +30~250
 *   3. 무력감 −100 · 전설 +50 · 스킬 20 수비 −100
 */
export function effectiveAbilityOf(career: PlayerCareer): BatterAbility {
  const ratio = career.isInjured ? INJURY_ABILITY_RATIO : career.isSick ? ILLNESS_ABILITY_RATIO : 1
  const adjust = (key: keyof BatterAbility) => {
    let value = Math.floor(career.ability[key] * ratio)
    value = clampAbility(value + equipmentBonusOf(career.equipmentLevels[key]))
    if (hasSkill(career, POWERLESS_SKILL)) value = clampAbility(value - SKILL_PENALTY)
    if (hasSkill(career, LEGEND_SKILL)) value = clampAbility(value + LEGEND_BONUS)
    if (key === 'defense' && hasSkill(career, DEFENSE_PENALTY_SKILL)) value = clampAbility(value - SKILL_PENALTY)
    return value
  }
  return { hit: adjust('hit'), power: adjust('power'), run: adjust('run'), defense: adjust('defense') }
}

/**
 * 훈련 부상 (0x1b4c4 — 훈련 결과 창을 닫을 때 한 번, 점검 12차).
 * 확률(%) = 훈련 뒤 사기 구간 표 (필살타법이면 오른쪽 열), 유리몸(4) +5 · 행운(6) −20, 0 미만은 0.
 * bfa55(0,10000) < 확률×100 이면 부상 — 기간 3 (+0x1b5·+0x1ce), 알림 문자열 0xcca24.
 * 경기 뒤에는 굴리지 않는다.
 */
const INJURY_CHANCE_BY_MORALE: readonly (readonly [number, number, number])[] = [
  [70, 0, 0],
  [50, 1, 3],
  [30, 3, 5],
  [10, 5, 8],
  [-Infinity, 10, 16],
]
const GLASS_BODY_SKILL = 4
const GLASS_BODY_BONUS = 5
const LUCK_SKILL = 6
const LUCK_REDUCTION = 20
const INJURY_ROLL_RANGE = 10_000

export function trainingInjuryChanceOf(career: PlayerCareer, isSpecialSwing: boolean): number {
  const row = INJURY_CHANCE_BY_MORALE.find(([floor]) => career.morale > floor) ?? INJURY_CHANCE_BY_MORALE[4]
  let chance = isSpecialSwing ? row[2] : row[1]
  if (hasSkill(career, GLASS_BODY_SKILL)) chance += GLASS_BODY_BONUS
  if (hasSkill(career, LUCK_SKILL)) chance -= LUCK_REDUCTION
  return Math.max(0, chance)
}

export function rollTrainingInjury(
  career: PlayerCareer,
  isSpecialSwing: boolean,
  random: RandomPort,
): { career: PlayerCareer; notice: string | null } {
  if (career.isInjured) return { career, notice: null }
  const roll = randomIntegerBelow(random, 0, INJURY_ROLL_RANGE)
  if (roll >= trainingInjuryChanceOf(career, isSpecialSwing) * 100) return { career, notice: null }
  return {
    career: { ...career, isInjured: true, injuryRemaining: INJURY_DURATION },
    notice: '부상을 당했습니다.',
  }
}
