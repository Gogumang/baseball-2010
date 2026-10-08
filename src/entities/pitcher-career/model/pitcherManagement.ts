import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
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
import { subItemMoraleRelief, subItemSlotTrainingBonus } from '@/entities/career/model/subItems'
import { applyPitchTypeTraining } from '@/entities/pitcher-career/model/pitchTraining'
import type { PitchTrainingProgress } from '@/entities/pitcher-career/model/pitchTraining'

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

/** 108 마구 창(탭 1)의 칸 하나를 확인했을 때 막는 까닭 — StrMODE[63] · [62] · [64] · [65] */
export type MagicTrainingCellBlock = '훈련완료' | '인기도부족' | '선행필요' | 'G포인트부족'

/** 마구 칸 수 — 그리기 0x807ba 의 `cmp r7,#3` 루프 · 표 넷 (R7 4절) */
export const MAGIC_TRAINING_CELL_COUNT = 4

/**
 * **108 창 진입 0x17730 의 처음 커서** — 탭이 2(구질)가 아니면 `min(s8 [저장+0x201], 3)` 칸(177c8~17806). 배운 수 L 칸이다.
 * G 충전(139)에서 돌아와도 108 이 다시 들어서 같은 칸이 된다.
 */
export function magicTrainingCursorOf(career: Pick<PitcherCareer, 'magicLevel'>): number {
  return Math.min(career.magicLevel, MAGIC_TRAINING_CELL_COUNT - 1)
}

/**
 * **108 창 확인 키 0x17828** — 탭 `[gfx+0x188]` 이 0(타자 필살타법) · 1(투수 마구)이면 같은 갈래(17858~17a42)를 탄다:
 * ```
 * L = s8 [저장+0x201]            i = 격자 커서
 * L > i                          → StrMODE[63] (팝업 1,1)
 * 인기도 0xb6e79 < 0xcc3ea[i]×100 → StrMODE[62] (%d = 그 값)
 * L < i                          → StrMODE[64]
 * |0xcc3e6[i]|×100 > G(전역 +0x64) → StrMODE[65] (팝업 2,2 — 예 → 139)
 * 그 밖                          → StrMODE[66] (팝업 2,3 — 예 → 125)
 * ```
 */
export function magicTrainingCellBlockOf(
  career: Pick<PitcherCareer, 'magicLevel' | 'popularity' | 'gamePoint'>,
  cell: number,
): MagicTrainingCellBlock | null {
  const learned = career.magicLevel
  if (learned > cell) return '훈련완료'
  if (career.popularity < (MAGIC_REQUIRED_POPULARITY[cell] ?? 0)) return '인기도부족'
  if (learned < cell) return '선행필요'
  if (magicTrainingCellCostOf(cell) > career.gamePoint) return 'G포인트부족'
  return null
}

/** 칸 i 의 G — `|0xcc3e6[i]| × 100` (500 · 700 · 900 · 1200) */
export function magicTrainingCellCostOf(cell: number): number {
  return MAGIC_GAME_POINT_COST[cell] ?? 0
}

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
   * 마구는 상승 굴림이 없어 0. 창 줄은 `pages/pitcher-league/lib/pitcherDetailPopup.ts` 가 세운다.
   */
  readonly rolledGain: number
  readonly rolledMoraleLoss: number
  readonly magic: PitcherMagicProgress | null
  readonly career: PitcherCareer
}

function roll(random: RandomPort, range: IntegerRange): number {
  return random.rand(range.minimum, range.maximumExclusive)
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

/**
 * 굴린 사기 감소에 병아리 −1 · 몹쓸몸 +2 · 자동안마기(서브 4, `기록+0x5c`) −1 ([sp+0xf8]) 을 더한다.
 * 자동안마기는 능력치 갈래 0x188cc · 필살/마구 갈래 0x18036 모두 모드 갈림 없이 본다.
 */
function moraleLossOf(career: PitcherCareer, rolledMoraleLoss: number): number {
  return (
    rolledMoraleLoss -
    (isPitcherSkillEquipped(career, ROOKIE_SKILL) ? 1 : 0) +
    (isPitcherSkillEquipped(career, WEAK_BODY_SKILL) ? 2 : 0) -
    subItemMoraleRelief(career)
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
  // 서브 아이템 0~3 은 훈련 칸 k 로 `기록[0x58+k]` 를 본다 (0x187f6, 모드 공용) — 표적판 = 제구 … 하드타이어 = 체력
  const subItemGain = subItemSlotTrainingBonus(career, slot)
  const gains: Partial<PitcherAbility> = { [ability]: rolled + typeBonus + skillGain + subItemGain }
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
    career: countReleaseTrainingStreak(countPitcherTraining(gainPitcherAbility(spent, gains), menu.id), slot),
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

/** 구질 훈련(108 탭 2)의 사기 감소 굴림 `bfa55(6,10)` — 0x1836a */
const PITCH_TYPE_MORALE_RANGE: IntegerRange = { minimum: 6, maximumExclusive: 10 }
/** 훈련 칸 4 — 마구와 구질 훈련이 같은 칸 [sp+0x40] = 4 로 0x17f5c 를 돈다(훈련 수 +0x4b+4) */
const MAGIC_TRAINING_MENU = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]

export interface PitchTypeTrainingOutcome {
  readonly progress: PitchTrainingProgress
  readonly rolledMoraleLoss: number
  readonly moraleLoss: number
  readonly career: PitcherCareer
}

/**
 * **구질 훈련 한 번** — 108 탭 2 확인 [예] → 125 → 훈련 0x17f5c 칸 4 의 탭 2 갈래(0x17fd0 `[[this+0xe0]+0x188] == 2` →
 * 0x1836a, 직접 떴다):
 * ```
 * 1836a  사기 감소 = bfa55(6,10)
 * 18384  병아리(장착 0xa4bf8 0) −1 · 몹쓸몸(장착 3) +2 · 자동안마기(기록 +0x5c) −1
 * 18408  0xa3bad(S, 5, 0, 사기 감소, 행, 열)        ; `applyPitchTypeTraining` 뒤 사기 a3a44(사기 − 감소)
 * 18474  알림 글 — 단계 > 열/2 면 StrMODE[88], 아니면 [89] "해당 구질 %d/%d회 훈련" · "사기 n 하락" (`pitchTypeTrainingLinesOf`)
 * 18a5c  훈련 수 +0x4b+4 += 1 · 해제 카운터 · 몹쓸몸/유리몸 카운터
 * 18bd8  칸 4 → 알림 창 0xbbef9(코드 4) → 18d66 S+4 = 1(행동함) · 저장 → 창이 닫히면 125 틀 0x18dd8 이 105
 * ```
 */
export function runPitchTypeTraining(
  career: PitcherCareer,
  row: number,
  column: number,
  random: RandomPort,
): PitchTypeTrainingOutcome {
  const rolledMoraleLoss = roll(random, PITCH_TYPE_MORALE_RANGE)
  const moraleLoss = moraleLossOf(career, rolledMoraleLoss)
  const applied = applyPitchTypeTraining(career, row, column)
  const trained = spendPitcherCycleAction(gainPitcherMorale(applied.career, -moraleLoss))
  return {
    progress: applied.progress,
    rolledMoraleLoss,
    moraleLoss,
    career: countPitcherTraining(trained, MAGIC_TRAINING_MENU.id),
  }
}

/**
 * 구질 훈련 알림 글 (0x18474~0x1858c) — 첫 줄 StrMODE[88] "구질 훈련 완료!" / [89] "해당 구질 %d/%d회 훈련", 다음 줄 사기.
 * ⚠️ 원본은 그 뒤에 병아리 · 몹쓸몸 · 자동안마기 "효과" 줄(0x185a8~0x186c2 — 이름 표 [0x1552cf8] 0x37 · 0x3a · 0x845d5)을
 *    붙이는데 그 줄과 색 표시는 옮기지 않았다 — 타자편 `trainingOutcomeLinesOf` 와 같은 근사 글이다.
 */
export function pitchTypeTrainingLinesOf(outcome: PitchTypeTrainingOutcome): string[] {
  const head = outcome.progress.isLearned
    ? ['구질 훈련 완료!', '[선수정보]에서 사용 여부 변경 가능']
    : [`해당 구질 ${outcome.progress.sessions}/${outcome.progress.required}회 훈련`]
  return [...head, `사기 -${outcome.moraleLoss}`]
}

/** 몹쓸몸 · 유리몸 보유 비트 — 투수 비트 0~7 은 타자와 같은 공통 스킬이다(2 먹튀 · 5 무력감과 같은 짝) */
const BAD_BODY_SKILL = 3
const FRAGILE_SKILL = 4

/**
 * 훈련 한 번을 센다 (0x18a80) — 통산 수와 **칸별 연속 훈련 수**(같은 칸 +1, 나머지 0).
 * 이어서 0x18b86~0x18bd6(모드 갈림 없음, 직접 떴다): `0xa3a75(S, 3)` 보유면 u8 S+0x75 += 1 · 아니면 S+0x75 = 0,
 * `0xa3a75(S, 4)` 보유면 S+0x76 += 1 · 아니면 0 — 몹쓸몸 · 유리몸을 **가진 채** 이어 한 훈련 수.
 */
export function countPitcherTraining(career: PitcherCareer, menuId: string): PitcherCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: (career.trainingCounts[menuId] ?? 0) + 1 },
    consecutiveTrainingCounts: { [menuId]: (career.consecutiveTrainingCounts[menuId] ?? 0) + 1 },
    badBodyTrainings: career.skillIds.includes(BAD_BODY_SKILL) ? ((career.badBodyTrainings ?? 0) + 1) & 0xff : 0,
    fragileTrainings: career.skillIds.includes(FRAGILE_SKILL) ? ((career.fragileTrainings ?? 0) + 1) & 0xff : 0,
  }
}

/**
 * 이번 시즌 훈련 수 합 T — 조건 20 의 몹쓸몸 · 유리몸 식(0xad32e~0xad34c · 0xad3fc~0xad41a):
 * `Σ i=0..4 (u8 S+0x4b+i − s8 S+0x6b+i)` — 통산 칸은 ldrb, 새 시즌 사본은 ldrsb 로 읽는다(사본이 128 을 넘으면 음수로 읽히는 원본 그대로).
 */
export function seasonPitcherTrainingTotalOf(career: PitcherCareer): number {
  const menuIds = new Set([...Object.keys(career.trainingCounts), ...Object.keys(career.seasonStartTrainingCounts)])
  let total = 0
  for (const menuId of menuIds) {
    total += ((career.trainingCounts[menuId] ?? 0) & 0xff) - toInt8((career.seasonStartTrainingCounts[menuId] ?? 0) & 0xff)
  }
  return total
}

/** 해제 카운터를 올리는 (스킬 비트, 훈련 칸) 짝 — 0x18a80~0x18b58 의 모드 3 갈래 (0xa3a75 = **보유** 비트) */
const RELEASE_STREAK_PAIRS: readonly (readonly [skill: number, slot: number])[] = [
  [18, 3], // 비겁자 · 체력
  [19, 2], // 깃털 · 변화
  [20, 0], // 더티볼 · 제구
]
const RELEASE_STREAK_SLOTS = 5
/** 칸은 s8 (ldrsb · strb) */
const toInt8 = (value: number) => ((value & 0xff) << 24) >> 24

/**
 * 능력치 훈련 뒤 해제 카운터 `+0x70 + 칸` (0x18b5a · 0x18b70) — 맞는 짝이면 그 칸 +1, 아니면 다섯 칸 모두 0.
 * ⚠️ 미해결: 마구 칸(상태 0x78 창)이 이 자리(0x17f5c 의 0x18a5c 뒤)를 지나는지 못 짚었다 — 마구 훈련은 건드리지 않는다.
 */
export function countReleaseTrainingStreak(career: PitcherCareer, slot: number): PitcherCareer {
  const counts = career.releaseTrainingStreaks ?? new Array<number>(RELEASE_STREAK_SLOTS).fill(0)
  const matches = RELEASE_STREAK_PAIRS.some(([skill, pairSlot]) => pairSlot === slot && career.skillIds.includes(skill))
  const next = matches
    ? counts.map((count, index) => (index === slot ? toInt8(count + 1) : count))
    : new Array<number>(RELEASE_STREAK_SLOTS).fill(0)
  return { ...career, releaseTrainingStreaks: next }
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
