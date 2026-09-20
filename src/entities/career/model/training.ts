import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { BALANCE } from '@/shared/config/original/balance'
import { countTraining, gainAbility, gainMorale, hasSkill, spendCycleAction } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { subItemMoraleRelief, subItemTrainingBonus } from '@/entities/career/model/subItems'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'

/**
 * 타자 훈련 (binary.mod 0x17f5c — 누락 탐색 4·5차).
 * 능력치 칸 0~3 (0xa3bac 종류 0~3):
 *   난수는 원본 bfa55(a, b) = [a, b) 정수다 (점검 10차) — 표기 4~7 은 실제로 4·5·6
 *   상승   bfa55(4,7), 수비·주루는 bfa55(5,8) (0x186e0) + 타입 보너스 +1 (StrMODE[194])
 *          스킬 0 병아리 +1 (사기 −1, StrMODE[201]) · 스킬 3 몹쓸몸 −2 (사기 +2, StrMODE[202]) — 0x1891c·0x1898e
 *   사기   bfa55(5,8) 만큼 떨어진다 (0x186c4). G포인트·소지금은 들지 않는다
 *   막힘   사기 0 (StrMODE[193]) · 능력치가 타입 한계치 이상 (StrMODE[192], 0x12e40 — 장비·스킬 보정 전 값)
 *          실제 상승은 999 로만 자르므로 한계 직전이면 한 번은 넘을 수 있다 (원본 동작)
 * 필살타법 칸 4 (0xa3bac 종류 4):
 *   레벨마다 필요 횟수 4/5/6/7 (0xd7e92) · 한 번에 G포인트 500/700/900/1200 (0xd80e1)
 *   사기 bfa55(9,13), 병아리(스킬 0) −1 · 몹쓸몸(스킬 3) +2
 * 서브 아이템: 표적판 등 훈련 +2 (StrITEM[148]) · 자동안마기 사기 감소 −1 (StrITEM[149], +0x5c)
 */
export interface TrainingMenu {
  readonly id: string
  readonly name: string
  readonly description: string
  /** 올리는 능력치. 비어 있으면 필살타법 칸 */
  readonly abilities: readonly (keyof BatterAbility)[]
}

export interface SpecialSwingProgress {
  /** 이번 훈련까지 누적 횟수 (StrMODE[86] "%d/%d회") */
  readonly sessions: number
  readonly required: number
  readonly isLevelUp: boolean
}

export interface TrainingOutcome {
  readonly menuId: string
  readonly gains: Partial<BatterAbility>
  readonly typeBonus: number
  readonly moraleLoss: number
  readonly specialSwing: SpecialSwingProgress | null
  readonly career: PlayerCareer
}

export type TrainingBlockReason = '이미행동함' | '사기부족' | '능력치최대' | '훈련완료'

/** [minimum, maximumExclusive) */
interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

const GAIN_RANGE: IntegerRange = BALANCE.training.gainRange
const LEG_GAIN_RANGE: IntegerRange = BALANCE.training.legGainRange
const LEG_ABILITIES: ReadonlySet<keyof BatterAbility> = new Set(['defense', 'run'])
const MORALE_LOSS_RANGE: IntegerRange = BALANCE.training.moraleLossRange
/** 배팅 타입 첫 선택 → 보너스 능력치 (0 → 히트, 1 → 파워) */
const TYPE_BONUS_ABILITY: readonly (keyof BatterAbility)[] = ['hit', 'power']
const TYPE_BONUS = BALANCE.training.typeBonus

const SPECIAL_SWING_REQUIRED_SESSIONS = BALANCE.specialSwing.requiredSessions
const SPECIAL_SWING_GAME_POINT_COST = BALANCE.specialSwing.gamePointCost

/** 이번 레벨 필살타법 훈련 한 번의 G포인트 (최고 레벨이면 0) */
export function specialSwingCostOf(career: PlayerCareer): number {
  return SPECIAL_SWING_GAME_POINT_COST[career.specialSwingLevel] ?? 0
}
export const SPECIAL_SWING_MAXIMUM_LEVEL = SPECIAL_SWING_REQUIRED_SESSIONS.length
const SPECIAL_SWING_MORALE_RANGE: IntegerRange = BALANCE.specialSwing.moraleLossRange
const ROOKIE_SKILL = BALANCE.training.rookieSkillId
const WEAK_BODY_SKILL = BALANCE.training.weakBodySkillId

function roll(random: RandomPort, range: IntegerRange): number {
  return randomIntegerBelow(random, range.minimum, range.maximumExclusive)
}

const isSpecialSwingMenu = (menu: TrainingMenu) => menu.abilities.length === 0

export function blockReasonOf(career: PlayerCareer, menu: TrainingMenu): TrainingBlockReason | null {
  if (career.hasActedThisCycle) return '이미행동함'
  if (career.morale <= 0) return '사기부족'
  // 원본은 G포인트가 모자라도 막지 않는다 (0xa3c84 가 0 에서 바닥을 친다).
  // 최고 레벨 가드는 **원본에도 있다** (R7 4절 확정): 필살타법 창 0x17828 이 "칸 i == 배운 수" 일 때만
  // 훈련시키므로, 최고 레벨이면 모든 칸이 StrMODE[63] 으로 막힌다. 우리가 넣은 안전장치가 아니다.
  if (isSpecialSwingMenu(menu)) {
    return career.specialSwingLevel >= SPECIAL_SWING_MAXIMUM_LEVEL ? '훈련완료' : null
  }
  const limits = abilityLimitOf(career.battingTypeIndex)
  if (menu.abilities.every((ability) => career.ability[ability] >= limits[ability])) return '능력치최대'
  return null
}

/** 막힌 상태로 부르면 예외 — 조용히 넘기면 무엇이 잘못됐는지 알 수 없다 */
export function runTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const blockReason = blockReasonOf(career, menu)
  if (blockReason !== null) throw new Error(`훈련을 실행할 수 없습니다 (${blockReason}): ${menu.name}`)
  const outcome = isSpecialSwingMenu(menu)
    ? runSpecialSwingTraining(career, menu, random)
    : runAbilityTraining(career, menu, random)
  // 훈련 횟수는 칭호 23·24 의 조건이라 능력 훈련·필살타법 양쪽 모두 센다
  return { ...outcome, career: countTraining(outcome.career, menu.id) }
}

function runAbilityTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const [ability] = menu.abilities
  const rolled = roll(random, LEG_ABILITIES.has(ability) ? LEG_GAIN_RANGE : GAIN_RANGE)
  const typeBonus = TYPE_BONUS_ABILITY[career.battingTypeIndex] === ability ? TYPE_BONUS : 0
  const skillGain = (hasSkill(career, ROOKIE_SKILL) ? 1 : 0) - (hasSkill(career, WEAK_BODY_SKILL) ? 2 : 0)
  const gains = { [ability]: rolled + typeBonus + skillGain + subItemTrainingBonus(career, ability) }
  const moraleLoss =
    roll(random, MORALE_LOSS_RANGE) -
    (hasSkill(career, ROOKIE_SKILL) ? 1 : 0) +
    (hasSkill(career, WEAK_BODY_SKILL) ? 2 : 0) -
    subItemMoraleRelief(career)
  const spent = spendCycleAction(gainMorale(career, -moraleLoss))
  return { menuId: menu.id, gains, typeBonus, moraleLoss, specialSwing: null, career: gainAbility(spent, gains) }
}

function runSpecialSwingTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const level = career.specialSwingLevel
  const required = SPECIAL_SWING_REQUIRED_SESSIONS[level]
  const sessions = career.specialSwingSessions + 1
  const isLevelUp = sessions >= required
  const moraleLoss =
    roll(random, SPECIAL_SWING_MORALE_RANGE) -
    (hasSkill(career, ROOKIE_SKILL) ? 1 : 0) +
    (hasSkill(career, WEAK_BODY_SKILL) ? 2 : 0) -
    subItemMoraleRelief(career)
  const spent = spendCycleAction(gainMorale(career, -moraleLoss))
  const trained: PlayerCareer = {
    ...spent,
    // G포인트는 0 에서 바닥을 친다 (0xa3c84)
    gamePoint: Math.max(0, career.gamePoint - SPECIAL_SWING_GAME_POINT_COST[level]),
    specialSwingLevel: isLevelUp ? level + 1 : level,
    specialSwingSessions: isLevelUp ? 0 : sessions,
  }
  return {
    menuId: menu.id,
    gains: {},
    typeBonus: 0,
    moraleLoss,
    specialSwing: { sessions, required, isLevelUp },
    career: trained,
  }
}
