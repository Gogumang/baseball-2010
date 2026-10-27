import { isBugFixed } from '@/shared/config/bugfixes'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { applySkillReward, isMinusSkill, isSkillEquipped, MAXIMUM_MORALE, MINUS_SKILL_IDS } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'

/**
 * GP 아이템 (binary.mod 0xa4488 — 누락 탐색 5차). **타자편·투수편이 같은 함수**를 탄다 (구매 확정 0x14fda 가
 * `0xa4488(기록, 모드==4, k, …)` 로 부른다). 모드로 갈리는 곳은 셋뿐이라 `GpItemRules` 로 뺐다:
 *   0~3  능력치 +10 · 4 모든 능력치 +10 — 한계치를 넘지 않는다 (타자 타입 표 0xd80c6 / 투수 보직 표 0xd80be × 10)
 *   9    타자 이글아이 +20경기(상한 99) / 투수 십전대보탕 스태미나 10000 (0xa49a6 `cmp 모드==4`)
 *   알림 글의 능력치 이름 StrMODE[35+k] / [40+k] (0xa455c)
 * 나머지는 두 모드 같다:
 *   5    또또상품권 — 누적 확률 표 0xd80b1(%) · 상금 표 0xd80a7(100만원) · 기록 +0x185(1등)·+0x186(구매, 상한 200)
 *   6    영지버섯 사기 +40 · 7 종합건강진단 치료 · 8 최면요법 마이너스 스킬 삭제
 * GP 가격은 상점 0x14e54 가 `0xcc41b`[k (모드 4 면 +10)] × 100 G 로 읽는다 — 두 블록 모두 [3,3,3,3,10,3,3,5,20,5] 확정.
 */
export interface GpItem {
  readonly id: number
  readonly name: string
  /** 설명 첫 줄 — StrITEM[0xad + k] (타자 칸 9 는 [0xb7]) — 원문 `!N` 그대로 */
  readonly descriptionText: string
  /** 효과 글 — `gpItemEffectTextOf` (원문 `!N` · 들여쓰기 그대로) */
  readonly effectText: string
  /** G포인트 (표 0xcc41b × 100) */
  readonly price: number
}

const PRICE_TABLE = [3, 3, 3, 3, 10, 3, 3, 5, 20, 5]
const PRICE_UNIT = 100
const MAXIMUM_GAME_POINT = 99_999

/** 이름 StrITEM[0x62 + k] — 칸 9 는 타자(모드 4)면 [0x6c] 이글아이, 투수면 [0x62 + 9] 십전대보탕 (0x826b0) */
const NAME_BASE = 0x62
const BATTER_NINTH_NAME = 0x6c
const DESCRIPTION_BASE = 0xad
const BATTER_NINTH_DESCRIPTION = 0xb7
const ABILITY_EFFECT_FORMAT = 0xa5
const OTHER_EFFECT_BASE = 0xa2
const BATTER_NINTH_EFFECT = 0xac
const ABILITY_ITEM_COUNT = 4
const NINTH_ITEM = 9
/** 능력치 이름 StrMODE[0x23 + k] (타자) — 투수는 [0x28 + k] */
const BATTER_ABILITY_NAME_BASE = 0x23

const itemText = (index: number): string => ORIGINAL_ITEMS[index] ?? ''

/**
 * GP 아이템 설명 조립 — 아이템 창 0x81dc0 창 종류 2 의 나만의리그 갈래 (직접 떴다, 0x828a6~0x829ea):
 * ```
 * 82890  "!cFFFFFF"
 * 828c8  + StrITEM[0xad + k]  (k == 9 이고 모드 4(0x7b970) 면 [0xb7])
 * 82906  + "!N효과 : !cFFFF00"(0xcc9f0)
 * 82932  k ≤ 3: + sprintf(StrITEM[0xa5], StrMODE[0x23 + k])  ; 투수(0x7b984)면 [0x28 + k]
 * 829a2  k == 9 이고 모드 4: + StrITEM[0xac]
 * 829d0  그 밖: + StrITEM[0xa2 + k]
 * ```
 */
export function gpItemEffectTextOf(id: number, isBatter = true): string {
  if (id < ABILITY_ITEM_COUNT) {
    const nameBase = isBatter ? BATTER_ABILITY_NAME_BASE : BATTER_ABILITY_NAME_BASE + 5
    return itemText(ABILITY_EFFECT_FORMAT).replace('%s', ORIGINAL_MODE_TEXT[nameBase + id] ?? '')
  }
  if (id === NINTH_ITEM && isBatter) return itemText(BATTER_NINTH_EFFECT)
  return itemText(OTHER_EFFECT_BASE + id)
}

/** 이름 · 설명 · 효과를 원문 표에서 (모드 4 = 타자) */
export function gpItemOf(id: number, isBatter = true): GpItem {
  const isBatterNinth = id === NINTH_ITEM && isBatter
  return {
    id,
    name: itemText(isBatterNinth ? BATTER_NINTH_NAME : NAME_BASE + id),
    descriptionText: itemText(isBatterNinth ? BATTER_NINTH_DESCRIPTION : DESCRIPTION_BASE + id),
    effectText: gpItemEffectTextOf(id, isBatter),
    price: PRICE_TABLE[id] * PRICE_UNIT,
  }
}

export const BATTER_GP_ITEMS: readonly GpItem[] = PRICE_TABLE.map((_price, id) => gpItemOf(id))

const ABILITY_ORDER: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const ABILITY_ITEM_GAIN = 10
const ALL_ABILITY_ITEM = 4
export { abilityLimitOf }

/** GP 아이템이 건드리는 칸 — 두 모드의 선수 기록이 같은 자리에 둔다 */
export type GpItemCareer = Pick<
  PlayerCareer,
  | 'money'
  | 'gamePoint'
  | 'morale'
  | 'lotteryPurchases'
  | 'lotteryFirstPrizes'
  | 'isInjured'
  | 'injuryRemaining'
  | 'injuredGamesPlayed'
  | 'isSick'
  | 'illnessName'
  | 'illnessRemaining'
  | 'illnessCooldown'
  | 'skillIds'
  | 'equippedSkillIds'
  | 'removedMinusSkillIds'
  | 'skillSlotLevel'
>

/** 모드로 갈리는 효과 둘 (0xa4488 안의 `기록[0] == 4` · 둘째 인자 갈림) */
export interface GpItemRules<T extends GpItemCareer> {
  /** 능력치 아이템 0~3 · 4(모든 능력치) — 칸 +10 뒤 한계로 자른다 */
  readonly applyAbilityItem: (career: T, id: number) => T
  /** 아이템 9 — 타자 이글아이 · 투수 십전대보탕 */
  readonly applyNinthItem: (career: T) => T
}

const MAXIMUM_ABILITY = 999

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

const MORALE_ITEM_GAIN = 40
const CURE_COOLDOWN = 20
const EAGLE_EYE_GAMES = 20
const MAXIMUM_EAGLE_EYE_GAMES = 99

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

export type LotteryPrize = 1 | 2 | 3 | 4 | 5 | 6 | '엄마상' | '메디카상' | '우정상' | '아차상'

/** 누적 기준 (% × 100) */
const LOTTERY_THRESHOLDS = [2, 5, 10, 20, 40, 70, 71, 75, 85, 100].map((percent) => percent * 100)
const LOTTERY_PRIZES: readonly LotteryPrize[] = [1, 2, 3, 4, 5, 6, '엄마상', '메디카상', '우정상', '아차상']
/** 1~6등 상금 (100만원) — 웹판 소지금은 만원 */
const LOTTERY_MONEY = [100, 50, 20, 10, 5, 2]
const MONEY_UNIT = 100
const MAXIMUM_MONEY = 9999 * MONEY_UNIT
const MAXIMUM_LOTTERY_PURCHASES = 200
const LOTTERY_ROLL_RANGE = 10_000
/** 아차상 — bfa55(0,4) = 능력치 아이템 0~3 (0xa46ec) */
const RANDOM_ABILITY_ITEM_COUNT = 4

export function lotteryPrizeOf(roll: number): LotteryPrize {
  const index = LOTTERY_THRESHOLDS.findIndex((threshold) => roll < threshold)
  return LOTTERY_PRIZES[index < 0 ? LOTTERY_PRIZES.length - 1 : index]
}

export interface GpItemResultOf<T> {
  readonly career: T
  readonly lotteryPrize: LotteryPrize | null
  /** 상(엄마상 등)으로 받은 GP 아이템 번호 */
  readonly prizeItemId?: number
}
export type GpItemResult = GpItemResultOf<PlayerCareer>

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
const BATTER_GP_RULES: GpItemRules<PlayerCareer> = {
  applyAbilityItem: (career, id) =>
    raiseWithinLimit(career, id === ALL_ABILITY_ITEM ? ABILITY_ORDER : [ABILITY_ORDER[id]]),
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

function applyEffect<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, id: number): T {
  if (id <= ALL_ABILITY_ITEM) return rules.applyAbilityItem(career, id)
  switch (id) {
    case 6:
      return gainItemMorale(career)
    case 7:
      return cure(career)
    case 8:
      return removeEquippedMinusSkills(career)
    case 9:
      return rules.applyNinthItem(career)
    default:
      throw new Error(`알 수 없는 GP 아이템 번호입니다 (0~9): ${id}`)
  }
}

const LOTTERY_EFFECT_OF: Readonly<Record<string, number>> = { 엄마상: 4, 메디카상: 7, 우정상: 6 }

function drawLottery<T extends GpItemCareer>(rules: GpItemRules<T>, career: T, random: RandomPort): GpItemResultOf<T> {
  const prize = lotteryPrizeOf(random.rand(0, LOTTERY_ROLL_RANGE))
  const counted: T = {
    ...career,
    lotteryPurchases: Math.min(MAXIMUM_LOTTERY_PURCHASES, career.lotteryPurchases + 1),
    lotteryFirstPrizes: career.lotteryFirstPrizes + (prize === 1 ? 1 : 0),
  }
  if (typeof prize === 'number') {
    const money = Math.min(MAXIMUM_MONEY, counted.money + LOTTERY_MONEY[prize - 1] * MONEY_UNIT)
    return { career: { ...counted, money }, lotteryPrize: prize }
  }
  const effectId =
    prize === '아차상' ? random.rand(0, RANDOM_ABILITY_ITEM_COUNT) : LOTTERY_EFFECT_OF[prize]
  return { career: applyEffect(rules, counted, effectId), lotteryPrize: prize, prizeItemId: effectId }
}

const LOTTERY_ITEM = 5

/** 0xa4488 — 모드 규칙을 받아 아이템 하나를 쓴다 (투수편 `pitcherItems.ts` 도 이것을 부른다) */
export function applyGpItemWith<T extends GpItemCareer>(
  rules: GpItemRules<T>,
  career: T,
  id: number,
  random: RandomPort,
): GpItemResultOf<T> {
  if (id === LOTTERY_ITEM) return drawLottery(rules, career, random)
  return { career: applyEffect(rules, career, id), lotteryPrize: null }
}

export function applyGpItem(career: PlayerCareer, id: number, random: RandomPort): GpItemResult {
  return applyGpItemWith(BATTER_GP_RULES, career, id, random)
}

export type GpPurchaseOf<T> =
  | { readonly kind: '구입'; readonly result: GpItemResultOf<T> }
  | { readonly kind: '거절'; readonly reason: 'G포인트부족' }
export type GpPurchase = GpPurchaseOf<PlayerCareer>

/** 사면 곧바로 쓴다 (0x14a74 탭 2 — 전역 G 차감, 0~99999) */
/** 가드 문구에 쓰는 능력치 이름 — StrMODE[35+i] 히트·파워·수비·주루 (0x13820) */
const LIMIT_ABILITY_NAMES = ['히트', '파워', '수비', '주루'] as const
const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const
/** 이글아이는 99 회가 상한이고 98 을 넘으면 맥스로 본다 (0x13a5c) */
const EAGLE_EYE_MAX_THRESHOLD = 98
/**
 * StrMODE[192] "[%s] 능력치가 최대입니다" — R12 1b: 칸 0~3 은 한 줄, 엄마의도시락은 최대인 칸마다 이 줄을
 * "!N"(0xcc330) 으로 잇는다. %s 는 능력치 이름 StrMODE[35+k](투수 40+k)
 */
const abilityMaxTextOf = (name: string): string => (ORIGINAL_MODE_TEXT[192] ?? '').replace('%s', name)
const ITEM = { 도시락: 4, 영지버섯: 6, 건강진단: 7, 최면요법: 8, 이글아이: 9 } as const

/**
 * 가드가 보는 값 — 모드로 갈리는 것은 능력치(기본값)·한계·이름(StrMODE[35+i] / [40+i])과 아이템 9 가드뿐이다 (0x13460 kind 2).
 * 최면요법 가드 0xa4f00 은 표 0xd7e10(= `MINUS_SKILL_IDS`) 의 **보유** 비트를 센다 — 두 모드 같다.
 */
export interface GpGuardView {
  readonly abilities: readonly number[]
  readonly limits: readonly number[]
  readonly abilityNames: readonly string[]
  readonly morale: number
  readonly isInjured: boolean
  readonly isSick: boolean
  readonly skillIds: readonly number[]
  /** 아이템 9 가 막히면 그 글 (타자 StrMODE[210] · 투수 [211]) */
  readonly ninthItemBlock: string | null
}

export function gpItemBlockReasonWith(view: GpGuardView, id: number): string | null {
  const maxedNames = view.abilityNames.filter((_name, i) => view.abilities[i] >= view.limits[i])
  if (id < view.abilities.length) {
    // StrMODE[192] "[%s] 능력치가 최대입니다"
    return view.abilities[id] >= view.limits[id] ? abilityMaxTextOf(view.abilityNames[id] ?? '') : null
  }
  if (id === ITEM.도시락) {
    // 일부만 최대면 살 수 있다 — 네 개 다 최대일 때만 막는다. 줄마다 뒤에 "!N"(0x13932~0x1393a) — 끝 줄 뒤에도 붙는다
    return maxedNames.length === view.abilities.length
      ? maxedNames.map((name) => abilityMaxTextOf(name) + LINE_BREAK).join('')
      : null
  }
  if (id === ITEM.영지버섯) return view.morale >= MAXIMUM_MORALE ? ORIGINAL_MODE_TEXT[91] ?? '' : null
  if (id === ITEM.건강진단) return !view.isInjured && !view.isSick ? ORIGINAL_MODE_TEXT[208] ?? '' : null
  if (id === ITEM.최면요법) {
    return view.skillIds.some((skill) => MINUS_SKILL_IDS.includes(skill))
      ? null
      : ORIGINAL_MODE_TEXT[209] ?? ''
  }
  if (id === ITEM.이글아이) return view.ninthItemBlock
  return null
}

/**
 * GP 아이템 구매 가드 (0x13460, R12 1b 확정). G 부족을 뺀 나머지 여섯이 여기 있다:
 *   k ≤ 3  능력치 아이템 — **기본 능력치**(장비·스킬 제외)가 타입 한계 이상이면 StrMODE[192]
 *   k == 4 엄마의도시락 — 한계에 닿은 능력만 줄로 나열하고, **네 개 모두** 닿았을 때만 막는다
 *   k == 6 영지버섯 — 사기 100 이면 StrMODE[91]
 *   k == 7 종합건강진단 — 부상도 질병도 없으면 StrMODE[208]
 *   k == 8 최면요법 — 마이너스 스킬이 없으면 StrMODE[209]
 *   k == 9 이글아이 — 98 회를 넘으면 StrMODE[210]
 * 앞서 웹은 G 부족 하나만 보고 나머지를 통째로 빼먹었다.
 */
export function gpItemBlockReasonOf(career: PlayerCareer, id: number): string | null {
  return gpItemBlockReasonWith(batterGpGuardViewOf(career), id)
}

function batterGpGuardViewOf(career: PlayerCareer): GpGuardView {
  const limits = abilityLimitOf(career.battingTypeIndex)
  return {
    abilities: ABILITY_KEYS.map((key) => career.ability[key]),
    limits: ABILITY_KEYS.map((key) => limits[key]),
    abilityNames: LIMIT_ABILITY_NAMES,
    morale: career.morale,
    isInjured: career.isInjured,
    isSick: career.isSick,
    skillIds: career.skillIds,
    ninthItemBlock: career.eagleEyeGamesRemaining > EAGLE_EYE_MAX_THRESHOLD ? (ORIGINAL_MODE_TEXT[210] ?? '') : null,
  }
}

/** 이글아이 확인창에만 덧붙는 안내줄 StrMODE[224] — 가드가 아니다 (0x13ab4) */
export const EAGLE_EYE_NOTICE = '최대 99회 누적 가능합니다'
export const EAGLE_EYE_ITEM_ID = ITEM.이글아이
/** 줄 구분 `0xcc330` */
const LINE_BREAK = '!N'

/**
 * GP 칸 구매 확인 글 — 0x13460 kind 2 의 끝(가드를 다 지난 뒤, 직접 떴다). 두 모드 공용이고 머리만 칸으로 갈린다:
 * ```
 * 칸 4(엄마의도시락) 0x138ca~0x13998  글 = ""(0xda908) · 한계에 닿은 칸마다 += [192](이름) + "!N"
 *                                      닿은 칸이 3 이하면 += "!N" + [82](가격) → 0xbbef9(글, 2, 3, 1)   ; 0 칸이어도 "!N" 이 앞에 선다
 * 타자 칸 9(이글아이) 0x13ab4~0x13afc  글 = [224] + "!N" + "!N" + [82](가격)                               ; 모드 4 일 때만
 * 그 밖                0x13b06          [82](가격)
 * ```
 * (예전 웹은 칸 4 의 줄 나열과 앞 "!N" 을 빼고, 이글아이는 "!N" 하나에 [82] 의 머리 "!C" 를 뺐다.)
 */
export function gpItemQuestionWith(
  view: Pick<GpGuardView, 'abilities' | 'limits' | 'abilityNames'>,
  id: number,
  price: number,
  withEagleEyeNotice: boolean,
): string {
  const question = (ORIGINAL_MODE_TEXT[82] ?? '').replace('%d', String(price))
  if (id === ITEM.도시락) {
    const maxedLines = view.abilityNames
      .filter((_name, i) => view.abilities[i] >= view.limits[i])
      .map((name) => abilityMaxTextOf(name) + LINE_BREAK)
    return maxedLines.join('') + LINE_BREAK + question
  }
  if (id === ITEM.이글아이 && withEagleEyeNotice) return (ORIGINAL_MODE_TEXT[224] ?? '') + LINE_BREAK + LINE_BREAK + question
  return question
}

/** 타자편 GP 칸 구매 확인 글 (`gpItemQuestionWith`, 칸 9 는 이글아이 안내줄) */
export function gpItemQuestionOf(career: PlayerCareer, id: number): string {
  return gpItemQuestionWith(batterGpGuardViewOf(career), id, BATTER_GP_ITEMS[id].price, true)
}

/** 사면 곧바로 쓴다 (0x14a74 탭 2 — 전역 G 차감 0~99999 뒤 0xa4488). 가격 표는 두 모드 같은 값이다 */
export function purchaseGpItemWith<T extends GpItemCareer>(
  rules: GpItemRules<T>,
  career: T,
  id: number,
  random: RandomPort,
): GpPurchaseOf<T> {
  const price = BATTER_GP_ITEMS[id].price
  if (career.gamePoint < price) return { kind: '거절', reason: 'G포인트부족' }
  const paid = { ...career, gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint - price) }
  return { kind: '구입', result: applyGpItemWith(rules, paid, id, random) }
}

export function purchaseGpItem(career: PlayerCareer, id: number, random: RandomPort): GpPurchase {
  return purchaseGpItemWith(BATTER_GP_RULES, career, id, random)
}

const ABILITY_NAMES = ['히트', '파워', '수비', '주루', '모든능력치']
/**
 * ⚠️ **원본 버그를 그대로 옮긴다** (G 2절 확정 · DECISIONS 2026-09-20):
 * 능력치는 실제로 **+10** 오르는데, 알림 글에는 **칸별 아이템 6 · 엄마의도시락 8** 이라고 찍힌다.
 * 글 = StrMODE[35+k] + " " + 숫자 + " " + StrMODE[83] 이고, 그 숫자 인자가 6·8 로 박혀 있다.
 *
 * **고침(`bugfixes.json` B-45, 기본 켬)**: 글의 숫자를 실제 상승 **10** 으로 — 복권 상 갈래(0xa4868 `movs r1,#0xa`)와 상점 설명
 * StrITEM[165] "능력치 + 10" 이 이미 10 이라 그쪽에 맞췄다. 능력치 · 굴림은 그대로.
 */
const ABILITY_NOTICE_NUMBERS = [6, 6, 6, 6, 8]
const modeText = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''
/** StrMODE[83] " 상승하였습니다"(색 마크업) · [116] " 당첨!!!N[" · [117] "] 획득!" · [126] "%d게임 동안 상대 투구…" */
const RISE_TEXT = 83
const LOTTERY_HEAD_TEXT = 116
const LOTTERY_TAIL_TEXT = 117
const EAGLE_EYE_USED_TEXT = 126
/** 아이템 6~8 의 알림 — StrMODE[122] 사기 +40 · [123] 부상 및 질병 치료 · [124] 마이너스 스킬 삭제 (0xa48e2 · 0xa4956 · 0xa49a2) */
const STATIC_NOTICES: Readonly<Record<number, string>> = {
  6: modeText(122),
  7: modeText(123),
  8: modeText(124),
}

/**
 * 이글아이 알림 — 0xa49a6~0xa49e2: 남은 경기 `min(SR+0x54 + 20, 99)` 를 저장하고 그 **새 값**을
 * sprintf(StrMODE[126], 값) 에 끼운다 (`ldrsb r2,[r5]` → 0x1400468). 처음 사면 20, 쌓이면 40 · 60 … 99.
 */
export function eagleEyeNoticeOf(gamesRemaining: number): string {
  return modeText(EAGLE_EYE_USED_TEXT).replace('%d', String(gamesRemaining))
}

function prizeLabelOf(prize: LotteryPrize, prizeItemId: number | undefined): string {
  // 아이템 상의 이름 StrITEM[0x62 + n] — 모드 갈림이 없다 (0xa4720~0xa4730, n 은 0~7 이라 칸 9 이름 갈래를 안 탄다)
  if (typeof prize !== 'number') return itemText(NAME_BASE + (prizeItemId ?? LOTTERY_EFFECT_OF[prize]))
  const amount = LOTTERY_MONEY[prize - 1]
  return amount >= MONEY_UNIT ? `${amount / MONEY_UNIT}억` : `${amount * MONEY_UNIT}만`
}

/** 상으로 받은 능력치 아이템 알림의 숫자 — 복권 갈래는 0xbc73d 에 **10** 을 넘긴다 (0xa4868 `movs r1,#0xa`, 일반 갈래 6·8 과 다르다) */
const LOTTERY_ABILITY_NOTICE_NUMBER = 10
const LOTTERY_LINE_BREAK = '!N'

/**
 * 아이템 상의 뒷줄 — 0xa474e~0xa48ee (직접 떴다). 효과를 그 자리에서 다시 적용하고(일반 갈래와 같은 계산) 글을 잇는다:
 * ```
 * a474e  n ≤ 3 (아차상): StrMODE[0x23 + n](모드 4) / [0x28 + n] + " " + "10" + " " + StrMODE[83]
 * a480c  n == 4 (엄마상): StrMODE[0x27] "모든능력치" + " " + "10" + " " + StrMODE[83]
 * a4888  n == 7 (메디카상): StrMODE[0x7b]
 * a48cc  n == 6 (우정상): StrMODE[0x7a]
 * ```
 */
function lotteryPrizeEffectNoticeOf(texts: GpNoticeTexts, prizeItemId: number): string {
  if (prizeItemId <= ALL_ABILITY_ITEM) {
    return `${texts.abilityNames[prizeItemId] ?? ''} ${LOTTERY_ABILITY_NOTICE_NUMBER} ${modeText(RISE_TEXT)}`
  }
  return STATIC_NOTICES[prizeItemId] ?? ''
}

/** 모드로 갈리는 알림 조각 — 능력치 이름 5칸(0~3 + 모든능력치 StrMODE[39]) 과 아이템 9 글 */
export interface GpNoticeTexts {
  readonly abilityNames: readonly string[]
  readonly ninthItemNotice: string
}

/** 사용 알림 — 원문 조각을 이어 붙인다 (StrMODE[35+k]/[40+k]+[83] · [116]/[117] · [122~126]). 상의 아이템 이름은 StrITEM[98+k] */
export function gpItemNoticeWith(
  texts: GpNoticeTexts,
  id: number,
  prize: LotteryPrize | null,
  prizeItemId?: number,
): string {
  // 실제 상승은 +10 이지만 글에는 6·8 이 찍힌다 (원본 그대로).
  // 0xa455c~0xa45fe: StrMODE[35+k](투수 40+k · 모든능력치 39) + " "(0xd80bc) + 0xbc73d(6 · 8) + " "(0xd80bc) + StrMODE[83]
  if (id < texts.abilityNames.length) {
    // 고침(B-45): 실제 상승 10 을 쓴다
    const number = isBugFixed('B-45') ? LOTTERY_ABILITY_NOTICE_NUMBER : ABILITY_NOTICE_NUMBERS[id]
    return `${texts.abilityNames[id]} ${number} ${modeText(RISE_TEXT)}`
  }
  if (id === LOTTERY_ITEM && prize !== null) {
    // 돈 상: sprintf("%d등 "(0xd7e08), 등수) + StrMODE[116] + 금액 + StrMODE[117] (0xa4658~0xa46c0)
    // 아이템 상: StrMODE[0x70 + 칸](118 엄마상 …) + [116] + StrITEM[0x62 + n] + [117] + "!N"(0xd80a4) (0xa46f8~0xa474a)
    //          뒤에 그 아이템의 효과 알림을 잇는다 (0xa474e~0xa48ee — `lotteryPrizeEffectNoticeOf`)
    const title = typeof prize === 'number' ? `${prize}등 ` : prize
    const head = `${title}${modeText(LOTTERY_HEAD_TEXT)}${prizeLabelOf(prize, prizeItemId)}${modeText(LOTTERY_TAIL_TEXT)}`
    if (typeof prize === 'number') return head
    return `${head}${LOTTERY_LINE_BREAK}${lotteryPrizeEffectNoticeOf(texts, prizeItemId ?? LOTTERY_EFFECT_OF[prize])}`
  }
  if (id === ITEM.이글아이) return texts.ninthItemNotice
  return STATIC_NOTICES[id] ?? ''
}

/** `eagleEyeGamesRemaining` — 이글아이를 쓴 **뒤** 남은 경기 (알림 [126] 의 %d) */
export function gpItemNoticeOf(
  id: number,
  prize: LotteryPrize | null,
  prizeItemId?: number,
  eagleEyeGamesRemaining: number = EAGLE_EYE_GAMES,
): string {
  return gpItemNoticeWith({ abilityNames: ABILITY_NAMES, ninthItemNotice: eagleEyeNoticeOf(eagleEyeGamesRemaining) }, id, prize, prizeItemId)
}
