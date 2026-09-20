import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { gainMorale, MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'

/**
 * GP 아이템 (타자편, binary.mod 0xa4488 — 누락 탐색 5차).
 *   0~3  능력치 +10 · 4 모든 능력치 +10 — 타입 한계치(표 0xd80c6 × 10)를 넘지 않는다
 *   5    또또상품권 — 누적 확률 표 0xd80b1(%) · 상금 표 0xd80a7(100만원)
 *   6    영지버섯 사기 +40 · 7 종합건강진단 치료 · 8 최면요법 마이너스 스킬 삭제 · 9 이글아이 +20경기(상한 99)
 * GP 가격 표는 아직 못 찾았다 — 상점 연결은 가격을 찾은 뒤에 한다.
 */
export interface GpItem {
  readonly id: number
  readonly name: string
  readonly effectText: string
  /** G포인트 (표 0xcc41b × 100) */
  readonly price: number
}

const PRICE_TABLE = [3, 3, 3, 3, 10, 3, 3, 5, 20, 5]
const PRICE_UNIT = 100
const MAXIMUM_GAME_POINT = 99_999

const NAMES = ['장어구이', '붕붕드링크', '빌리언XZ', '고려인삼', '엄마의도시락', '또또상품권', '영지버섯', '종합건강진단', '최면요법', '이글아이']
const EFFECT_TEXTS = [
  '히트 능력치 + 10', '파워 능력치 + 10', '수비 능력치 + 10', '주루 능력치 + 10', '모든 능력치 + 10',
  '랜덤으로 아이템 및 소지금 획득', '사기 회복 + 40', '부상 / 질병 즉시 회복', '마이너스 스킬 모두 삭제',
  '20게임 동안 상대 투수가 던질 곳 보기',
]
export const BATTER_GP_ITEMS: readonly GpItem[] = NAMES.map((name, id) => ({
  id,
  name,
  effectText: EFFECT_TEXTS[id],
  price: PRICE_TABLE[id] * PRICE_UNIT,
}))

const ABILITY_ORDER: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']
const ABILITY_ITEM_GAIN = 10
const ALL_ABILITY_ITEM = 4
export { abilityLimitOf }

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
/** 마이너스 스킬 — 원본은 0x5f350 비트1 로 가른다. 표를 아직 못 읽어 효과 문구가 불리한 타자·공통 스킬로 둔다 (추정) */
const MINUS_SKILL_IDS: ReadonlySet<number> = new Set([2, 3, 4, 5, 17, 18, 19, 20])

const cure = (career: PlayerCareer): PlayerCareer => ({
  ...career,
  isInjured: false,
  injuredGamesPlayed: 0,
  isSick: false,
  illnessName: null,
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

export interface GpItemResult {
  readonly career: PlayerCareer
  readonly lotteryPrize: LotteryPrize | null
  /** 상(엄마상 등)으로 받은 GP 아이템 번호 */
  readonly prizeItemId?: number
}

function applyEffect(career: PlayerCareer, id: number): PlayerCareer {
  if (id < ALL_ABILITY_ITEM) return raiseWithinLimit(career, [ABILITY_ORDER[id]])
  switch (id) {
    case ALL_ABILITY_ITEM:
      return raiseWithinLimit(career, ABILITY_ORDER)
    case 6:
      return gainMorale(career, MORALE_ITEM_GAIN)
    case 7:
      return cure(career)
    case 8:
      return { ...career, skillIds: career.skillIds.filter((skill) => !MINUS_SKILL_IDS.has(skill)) }
    case 9:
      return { ...career, eagleEyeGamesRemaining: Math.min(MAXIMUM_EAGLE_EYE_GAMES, career.eagleEyeGamesRemaining + EAGLE_EYE_GAMES) }
    default:
      throw new Error(`알 수 없는 GP 아이템 번호입니다 (0~9): ${id}`)
  }
}

const LOTTERY_EFFECT_OF: Readonly<Record<string, number>> = { 엄마상: 4, 메디카상: 7, 우정상: 6 }

function drawLottery(career: PlayerCareer, random: RandomPort): GpItemResult {
  const prize = lotteryPrizeOf(randomIntegerBelow(random, 0, LOTTERY_ROLL_RANGE))
  const counted: PlayerCareer = {
    ...career,
    lotteryPurchases: Math.min(MAXIMUM_LOTTERY_PURCHASES, career.lotteryPurchases + 1),
    lotteryFirstPrizes: career.lotteryFirstPrizes + (prize === 1 ? 1 : 0),
  }
  if (typeof prize === 'number') {
    const money = Math.min(MAXIMUM_MONEY, counted.money + LOTTERY_MONEY[prize - 1] * MONEY_UNIT)
    return { career: { ...counted, money }, lotteryPrize: prize }
  }
  const effectId =
    prize === '아차상' ? randomIntegerBelow(random, 0, RANDOM_ABILITY_ITEM_COUNT) : LOTTERY_EFFECT_OF[prize]
  return { career: applyEffect(counted, effectId), lotteryPrize: prize, prizeItemId: effectId }
}

const LOTTERY_ITEM = 5

export function applyGpItem(career: PlayerCareer, id: number, random: RandomPort): GpItemResult {
  if (id === LOTTERY_ITEM) return drawLottery(career, random)
  return { career: applyEffect(career, id), lotteryPrize: null }
}

export type GpPurchase =
  | { readonly kind: '구입'; readonly result: GpItemResult }
  | { readonly kind: '거절'; readonly reason: 'G포인트부족' }

/** 사면 곧바로 쓴다 (0x14a74 탭 2 — 전역 G 차감, 0~99999) */
/** 가드 문구에 쓰는 능력치 이름 — StrMODE[35+i] 히트·파워·수비·주루 (0x13820) */
const LIMIT_ABILITY_NAMES = ['히트', '파워', '수비', '주루'] as const
const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const
/** 이글아이는 99 회가 상한이고 98 을 넘으면 맥스로 본다 (0x13a5c) */
const EAGLE_EYE_MAX_THRESHOLD = 98
const ITEM = { 도시락: 4, 영지버섯: 6, 건강진단: 7, 최면요법: 8, 이글아이: 9 } as const

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
  const limits = abilityLimitOf(career.battingTypeIndex)
  const maxedNames = LIMIT_ABILITY_NAMES.filter((_name, i) => career.ability[ABILITY_KEYS[i]] >= limits[ABILITY_KEYS[i]])

  if (id < ABILITY_KEYS.length) {
    const key = ABILITY_KEYS[id]
    // StrMODE[192] "[%s] 능력치가 최대입니다"
    return career.ability[key] >= limits[key] ? `[${LIMIT_ABILITY_NAMES[id]}] 능력치가 최대입니다` : null
  }
  if (id === ITEM.도시락) {
    // 일부만 최대면 살 수 있다 — 네 개 다 최대일 때만 막는다
    return maxedNames.length === ABILITY_KEYS.length
      ? maxedNames.map((name) => `[${name}] 능력치가 최대입니다`).join('!N')
      : null
  }
  if (id === ITEM.영지버섯) return career.morale >= MAXIMUM_MORALE ? '사기 최고 상태입니다' : null
  if (id === ITEM.건강진단) {
    return !career.isInjured && !career.isSick ? '건강한 상태입니다 구매 할 수 없습니다' : null
  }
  if (id === ITEM.최면요법) {
    return career.skillIds.some((skill) => MINUS_SKILL_IDS.has(skill))
      ? null
      : '마이너스 스킬이 없습니다 구매 할 수 없습니다'
  }
  if (id === ITEM.이글아이) {
    return career.eagleEyeGamesRemaining > EAGLE_EYE_MAX_THRESHOLD ? '[이글아이] 맥스 상태입니다' : null
  }
  return null
}

/** 이글아이 확인창에만 덧붙는 안내줄 StrMODE[224] — 가드가 아니다 (0x13ab4) */
export const EAGLE_EYE_NOTICE = '최대 99회 누적 가능합니다'
export const EAGLE_EYE_ITEM_ID = ITEM.이글아이

export function purchaseGpItem(career: PlayerCareer, id: number, random: RandomPort): GpPurchase {
  const price = BATTER_GP_ITEMS[id].price
  if (career.gamePoint < price) return { kind: '거절', reason: 'G포인트부족' }
  const paid = { ...career, gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint - price) }
  return { kind: '구입', result: applyGpItem(paid, id, random) }
}

const ABILITY_NAMES = ['히트', '파워', '수비', '주루', '모든능력치']
const STATIC_NOTICES: Readonly<Record<number, string>> = {
  6: '사기 +40 회복되었습니다', // StrMODE[122]
  7: '부상 및 질병이 모두 치료 되었습니다', // StrMODE[123]
  8: '마이너스 스킬이 모두 삭제 되었습니다', // StrMODE[124]
  9: '20게임 동안 상대 투구 목표점을 볼 수 있습니다', // StrMODE[126]
}

function prizeLabelOf(prize: LotteryPrize, prizeItemId: number | undefined): string {
  if (typeof prize !== 'number') return NAMES[prizeItemId ?? LOTTERY_EFFECT_OF[prize]] ?? ''
  const amount = LOTTERY_MONEY[prize - 1]
  return amount >= MONEY_UNIT ? `${amount / MONEY_UNIT}억` : `${amount * MONEY_UNIT}만`
}

/** 사용 알림 — 원문 조각을 이어 붙인다 (StrMODE[35+k]+[83] · [116]/[117] · [122~126]). 상의 아이템 이름은 StrITEM[98+k] */
export function gpItemNoticeOf(id: number, prize: LotteryPrize | null, prizeItemId?: number): string {
  // 원본: StrMODE[35+k] + " " + 숫자 + " " + [83] — 숫자 인자(6·8)의 뜻은 미확인이라 실제 증가량 +10 을 쓴다 (추정)
  if (id < ABILITY_NAMES.length) return `${ABILITY_NAMES[id]} +10 상승하였습니다`
  if (id === LOTTERY_ITEM && prize !== null) {
    const title = typeof prize === 'number' ? `${prize}등` : prize
    return `${title} 당첨!! [${prizeLabelOf(prize, prizeItemId)}] 획득!`
  }
  return STATIC_NOTICES[id] ?? ''
}
