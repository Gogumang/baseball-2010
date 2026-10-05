import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import {
  GAMES_PER_MANAGEMENT_CYCLE,
  gainPitcherAbility,
  gainPitcherMorale,
  isPitcherSkillEquipped,
  pitcherAbilityLimitsOf,
  spendPitcherCycleAction,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_TYPE_BONUS_ABILITY } from '@/entities/pitcher-career/model/pitcherRegistration'

/**
 * 투수편 **관리 주기·훈련** — 타자편과 다른 점만 모았다.
 *
 * **같은 것** (한 코드가 모드 3·4 를 함께 돈다):
 *   - 관리 화면은 **2경기마다** 열린다 (StrHOWTO[11] · 관리 장면 상태 116, R9 요약).
 *   - 한 주기에 트레이닝·휴식·외출 중 **한 가지**만 (r_event_txt[176]).
 *   - 훈련 함수 `0x17f5c` 하나가 두 모드를 돈다. 칸 0~3 은 0x186c4 로 가서 **사기 감소 bfa55(5,8) 를 먼저**
 *     ([sp+0x38]) 굴리고 **상승을 다음**([sp+0x34], 0x18704) 굴린다 — 타자편과 같은 차례다.
 *   - 사기 0 이면 막힘 StrMODE[193] · 능력치가 한계면 StrMODE[192] (0x12e40).
 *
 * **다른 것** (0x17f5c 안의 `[장면+0xcc] == 4` 갈림, 디스어셈 확정):
 *   - 능력 칸이 제구·구속·변화·체력이고, **한계 표를 보직으로 고른다** (0xa44f4, R7 3절).
 *   - 상승 범위 (0x186d6~0x18702): 타자는 칸 2·3(수비·주루)이 bfa55(5,8) 인데, 투수는 **칸 3(체력)만** (5,8) 이고
 *     칸 0·1·2 는 (4,7) 이다.
 *   - 타입 보너스 +1 (0x18786~0x187a6): 투수는 칸 0(제구)·타입 1 · 칸 1(구속)·타입 0 · 칸 2(변화)·타입 2.
 *     타입 = 기록 `+0xb >> 5` (등록 시작 보너스 `PITCHER_TYPE_BONUS_ABILITY` 와 같은 짝). 글은 "[타입 이름] 타입 보너스 +1"
 *     (이름 = 표 0x1400080 [2 + 타입] 오버핸드·사이드암·언더스로, StrMODE[194]).
 *   - 훈련 **칸 4** 가 필살타법 창(상태 0x6c)이 아니라 **상태 0x78** 을 연다 (0x12dc0, R7 4절 149행) —
 *     그 창에 마구(필살 창 탭 0·1 의 투수 쪽)와 **구질 훈련**(`pitchTraining.ts`)이 함께 있다.
 */

interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

const GAIN_RANGE: IntegerRange = BALANCE.training.gainRange
/** 투수는 칸 3(체력)만 bfa55(5,8) — 0x186f4 `cmp k,#3` */
const SLOW_GAIN_RANGE: IntegerRange = BALANCE.training.legGainRange
const STAMINA_SLOT = 3
/** 타입 보너스 +1 (0x18750 · 0x187a8 의 [sp+0xe8+k] += 1) */
const TYPE_BONUS = 1
/** 타입 이름 — 표 0x1400080 [2 + 타입] (0x187be `ldr r1,[r3,#8]`) */
export const PITCHER_TYPE_NAMES: readonly string[] = ['오버핸드', '사이드암', '언더스로']
const MORALE_LOSS_RANGE: IntegerRange = BALANCE.training.moraleLossRange
const ROOKIE_SKILL = BALANCE.training.rookieSkillId
const WEAK_BODY_SKILL = BALANCE.training.weakBodySkillId
/*
 * 병아리(0)·몹쓸몸(3)은 훈련 함수 0x17f5c 가 **장착** 비트(0xa4bf8 — 0x17ffc·0x1827a·0x182e2·0x18384·
 * 0x185ae·0x18612·0x18922)로 본다. 함수가 모드 3·4 공용이라 투수도 같다 (타자편 training.ts 와 같은 갈래).
 */

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
  /** 타입 보너스 (0 또는 1) — 글 "[타입] 타입 보너스 +1" 을 붙일지 */
  readonly typeBonus: number
  readonly moraleLoss: number
  /**
   * 굴린 값 그대로 — 보너스(타입·스킬)와 자르기 전. 타자편 `TrainingOutcome.rolledGain` 과 같은 칸이다
   * (0x18d14 훈련 칸 [sp+0x34] · 0x18d36 사기 칸 −[sp+0x38], 결과 창 0x872a1 은 두 모드 공용).
   * 마구는 상승 굴림이 없어 0. ⚠️ 투수편엔 아직 상세 결과 창이 없어 알림만 쓴다.
   */
  readonly rolledGain: number
  readonly rolledMoraleLoss: number
  readonly magic: PitcherMagicProgress | null
  readonly career: PitcherCareer
}

function roll(random: RandomPort, range: IntegerRange): number {
  return randomIntegerBelow(random, range.minimum, range.maximumExclusive)
}

/** 훈련 한 번 (0x17f5c → 0xa3bad). 범위·타입 보너스 갈림은 위 모듈 주석 (디스어셈 확정) */
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

/** 굴린 사기 감소에 병아리 −1 · 몹쓸몸 +2 ([sp+0xf8]) 를 더한다 */
function moraleLossOf(career: PitcherCareer, rolledMoraleLoss: number): number {
  return (
    rolledMoraleLoss -
    (isPitcherSkillEquipped(career, ROOKIE_SKILL) ? 1 : 0) +
    (isPitcherSkillEquipped(career, WEAK_BODY_SKILL) ? 2 : 0)
  )
}

function runAbilityTraining(
  career: PitcherCareer,
  menu: PitcherTrainingMenu,
  ability: keyof PitcherAbility,
  random: RandomPort,
): PitcherTrainingOutcome {
  const slot = PITCHER_ABILITY_ORDER.indexOf(ability)
  // 굴리는 차례: 사기 bfa55(5,8) → [sp+0x38] (0x186c4) 이 **먼저**, 상승 bfa55 → [sp+0x34] (0x18704) 가 다음
  const rolledMoraleLoss = roll(random, MORALE_LOSS_RANGE)
  const rolled = roll(random, slot === STAMINA_SLOT ? SLOW_GAIN_RANGE : GAIN_RANGE)
  const typeBonus = PITCHER_TYPE_BONUS_ABILITY[career.typeIndex] === ability ? TYPE_BONUS : 0
  const skillGain =
    (isPitcherSkillEquipped(career, ROOKIE_SKILL) ? 1 : 0) - (isPitcherSkillEquipped(career, WEAK_BODY_SKILL) ? 2 : 0)
  const gains: Partial<PitcherAbility> = { [ability]: rolled + typeBonus + skillGain }
  const moraleLoss = moraleLossOf(career, rolledMoraleLoss)
  const spent = spendPitcherCycleAction(gainPitcherMorale(career, -moraleLoss))
  return {
    menuId: menu.id,
    gains,
    typeBonus,
    moraleLoss,
    rolledGain: rolled,
    rolledMoraleLoss,
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
  const rolledMoraleLoss = roll(random, MAGIC_MORALE_RANGE)
  const moraleLoss = moraleLossOf(career, rolledMoraleLoss)
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
    typeBonus: 0,
    moraleLoss,
    rolledGain: 0,
    rolledMoraleLoss,
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
