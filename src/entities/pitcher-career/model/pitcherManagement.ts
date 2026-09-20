import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import {
  GAMES_PER_MANAGEMENT_CYCLE,
  gainPitcherAbility,
  gainPitcherMorale,
  hasPitcherSkill,
  pitcherAbilityLimitsOf,
  spendPitcherCycleAction,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'

/**
 * 투수편 **관리 주기·훈련** — 타자편과 다른 점만 모았다.
 *
 * **같은 것** (한 코드가 모드 3·4 를 함께 돈다):
 *   - 관리 화면은 **2경기마다** 열린다 (StrHOWTO[11] · 관리 장면 상태 116, R9 요약).
 *   - 한 주기에 트레이닝·휴식·외출 중 **한 가지**만 (r_event_txt[176]).
 *   - 훈련 한 번의 상승·사기 감소 수치는 훈련 함수 `0x17f5c` → `0xa3bac` 종류 0~3 로 **칸 번호로만 갈린다**.
 *   - 사기 0 이면 막힘 StrMODE[193] · 능력치가 한계면 StrMODE[192] (0x12e40).
 *
 * **다른 것**:
 *   - 능력 칸이 제구·구속·변화·체력이고, **한계 표를 보직으로 고른다** (0xa44f4, R7 3절).
 *   - 훈련 **칸 4** 가 필살타법 창(상태 0x6c)이 아니라 **상태 0x78** 을 연다 (0x12dc0, R7 4절 149행) —
 *     그 창에 마구(필살 창 탭 0·1 의 투수 쪽)와 **구질 훈련**(`pitchTraining.ts`)이 함께 있다.
 *
 * **못 채운 것**: 투수 타입(3가지)에 붙는 훈련 보너스 칸이 문서에 없다. 타자편은 "배팅 타입 → 히트/파워
 * +1"(StrMODE[194], 0x186e0)인데 투수 쪽 대응을 찾지 못했다 — **보너스를 0 으로 두고 자리만 남긴다**.
 */

interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

const GAIN_RANGE: IntegerRange = BALANCE.training.gainRange
const SLOW_GAIN_RANGE: IntegerRange = BALANCE.training.legGainRange
const MORALE_LOSS_RANGE: IntegerRange = BALANCE.training.moraleLossRange
const ROOKIE_SKILL = BALANCE.training.rookieSkillId
const WEAK_BODY_SKILL = BALANCE.training.weakBodySkillId

/** 마구 레벨 훈련 — 필살타법 창(0x17828)이 투수 탭에도 같은 표를 쓴다 (H-4 · R7 4절) */
const MAGIC_REQUIRED_SESSIONS: readonly number[] = BALANCE.specialSwing.requiredSessions
const MAGIC_GAME_POINT_COST: readonly number[] = BALANCE.specialSwing.gamePointCost
const MAGIC_MORALE_RANGE: IntegerRange = BALANCE.specialSwing.moraleLossRange
/** 레벨마다 필요한 인기도 — 표 0xcc3ea = [1,5,10,15] × 100 (R7 4절) */
export const MAGIC_REQUIRED_POPULARITY: readonly number[] = [100, 500, 1000, 1500]
export const MAGIC_MAXIMUM_LEVEL = MAGIC_REQUIRED_SESSIONS.length

export interface PitcherTrainingMenu {
  readonly id: string
  readonly name: string
  /** 올리는 능력치 칸. 비어 있으면 **마구 칸**(상태 0x78 창) */
  readonly ability: keyof PitcherAbility | null
}

/**
 * 훈련 메뉴 다섯 칸. 칸 0~3 결과 글은 StrMODE[40+칸] 이름을 쓴다 (R7 3절 — 타자는 [35+칸]).
 * 칸 4 이름 "마구" 는 H-4 의 "필살타법(투수는 마구)" 표기를 따른다.
 */
export const PITCHER_TRAINING_MENUS: readonly PitcherTrainingMenu[] = [
  ...PITCHER_ABILITY_ORDER.map((ability, slot) => ({
    id: PITCHER_ABILITY_NAMES[slot],
    name: PITCHER_ABILITY_NAMES[slot],
    ability,
  })),
  { id: '마구', name: '마구', ability: null },
]

export type PitcherTrainingBlockReason = '이미행동함' | '사기부족' | '능력치최대' | '훈련완료' | '인기도부족'

/**
 * 막힘 판정.
 * 마구 칸은 **창이 막는다** — 레벨 i 칸은 `i == 배운 수` 일 때만 열리고(StrMODE[63]/[64]),
 * 인기도 조건과 G포인트 부족([65])도 창에 있다 (R7 4절).
 */
export function pitcherTrainingBlockReasonOf(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
): PitcherTrainingBlockReason | null {
  if (career.hasActedThisCycle) return '이미행동함'
  if (career.morale <= 0) return '사기부족'
  if (menu.ability === null) {
    if (career.magicLevel >= MAGIC_MAXIMUM_LEVEL) return '훈련완료'
    if (career.popularity < (MAGIC_REQUIRED_POPULARITY[career.magicLevel] ?? 0)) return '인기도부족'
    if (career.gamePoint < (MAGIC_GAME_POINT_COST[career.magicLevel] ?? 0)) return '훈련완료'
    return null
  }
  const limits = pitcherAbilityLimitsOf(career)
  return career.ability[menu.ability] >= limits[menu.ability] ? '능력치최대' : null
}

export interface PitcherMagicProgress {
  /** 이번 훈련까지 누적 횟수 (StrMODE[86] "%d/%d회") */
  readonly sessions: number
  readonly required: number
  readonly isLevelUp: boolean
}

export interface PitcherTrainingOutcome {
  readonly menuId: string
  readonly gains: Partial<PitcherAbility>
  readonly moraleLoss: number
  readonly magic: PitcherMagicProgress | null
  readonly career: PitcherCareer
}

function roll(random: RandomPort, range: IntegerRange): number {
  return randomIntegerBelow(random, range.minimum, range.maximumExclusive)
}

/**
 * 훈련 한 번 (0x17f5c → 0xa3bac).
 *
 * ⚠️ **근사**: 칸 0·1 은 `bfa55(4,7)`, 칸 2·3 은 `bfa55(5,8)` 로 둔다. 원본은 칸 **번호**로 갈리는
 * 한 코드(0x186e0)라 투수도 같은 갈림을 탈 것으로 본다 — 투수 전용 수치는 문서에 없다 (**추정**).
 * 타입 보너스는 대응 칸을 못 찾아 0 이다 (위 모듈 주석 참조).
 */
export function runPitcherTraining(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
  random: RandomPort,
): PitcherTrainingOutcome {
  const blockReason = pitcherTrainingBlockReasonOf(career, menu)
  if (blockReason !== null) throw new Error(`훈련을 실행할 수 없습니다 (${blockReason}): ${menu.name}`)
  return menu.ability === null
    ? runMagicTraining(career, menu, random)
    : runAbilityTraining(career, menu, menu.ability, random)
}

function moraleLossOf(career: PitcherCareer, random: RandomPort, range: IntegerRange): number {
  return (
    roll(random, range) -
    (hasPitcherSkill(career, ROOKIE_SKILL) ? 1 : 0) +
    (hasPitcherSkill(career, WEAK_BODY_SKILL) ? 2 : 0)
  )
}

function runAbilityTraining(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
  ability: keyof PitcherAbility,
  random: RandomPort,
): PitcherTrainingOutcome {
  const slot = PITCHER_ABILITY_ORDER.indexOf(ability)
  const rolled = roll(random, slot >= 2 ? SLOW_GAIN_RANGE : GAIN_RANGE)
  const skillGain =
    (hasPitcherSkill(career, ROOKIE_SKILL) ? 1 : 0) - (hasPitcherSkill(career, WEAK_BODY_SKILL) ? 2 : 0)
  const gains: Partial<PitcherAbility> = { [ability]: rolled + skillGain }
  const moraleLoss = moraleLossOf(career, random, MORALE_LOSS_RANGE)
  const spent = spendPitcherCycleAction(gainPitcherMorale(career, -moraleLoss))
  return {
    menuId: menu.id,
    gains,
    moraleLoss,
    magic: null,
    career: countPitcherTraining(gainPitcherAbility(spent, gains), menu.id),
  }
}

function runMagicTraining(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
  random: RandomPort,
): PitcherTrainingOutcome {
  const level = career.magicLevel
  const required = MAGIC_REQUIRED_SESSIONS[level]
  const sessions = career.magicSessions + 1
  const isLevelUp = sessions >= required
  const moraleLoss = moraleLossOf(career, random, MAGIC_MORALE_RANGE)
  const spent = spendPitcherCycleAction(gainPitcherMorale(career, -moraleLoss))
  const trained: PitcherCareer = {
    ...spent,
    // G포인트는 0 에서 바닥을 친다 (0xa3c84)
    gamePoint: Math.max(0, career.gamePoint - (MAGIC_GAME_POINT_COST[level] ?? 0)),
    magicLevel: isLevelUp ? level + 1 : level,
    magicSessions: isLevelUp ? 0 : sessions,
  }
  return {
    menuId: menu.id,
    gains: {},
    moraleLoss,
    magic: { sessions, required, isLevelUp },
    career: countPitcherTraining(trained, menu.id),
  }
}

/**
 * 훈련 한 번을 센다 (0x18a80) — 통산 수와 **칸별 연속 훈련 수**(같은 칸 +1, 나머지 0).
 * 몹쓸몸·유리몸을 가진 채로 한 훈련은 타자편과 같은 칸이 세지만, 투수 스킬 번호가 문서에 없어
 * 여기서는 세지 않는다 (필요해지면 `badBodyTrainings` 자리에 붙인다).
 */
export function countPitcherTraining(career: PitcherCareer, menuId: string): PitcherCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: (career.trainingCounts[menuId] ?? 0) + 1 },
    consecutiveTrainingCounts: { [menuId]: (career.consecutiveTrainingCounts[menuId] ?? 0) + 1 },
  }
}

/** 이번 시즌 훈련 수 = 통산 − 새 시즌 사본 (A-4) */
export function seasonPitcherTrainingCountOf(career: PitcherCareer, menuId: string): number {
  return (career.trainingCounts[menuId] ?? 0) - (career.seasonStartTrainingCounts[menuId] ?? 0)
}

/** 관리 화면이 열리기까지 남은 경기 수 (2경기 주기) */
export function gamesUntilManagementOf(career: PitcherCareer): number {
  const played = career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE
  return played === 0 ? 0 : GAMES_PER_MANAGEMENT_CYCLE - played
}
