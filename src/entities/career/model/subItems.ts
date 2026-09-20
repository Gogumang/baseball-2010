import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RolledOutingEffect } from '@/shared/config/outingPlaces'

/**
 * 서브 아이템 10종 (누락 탐색 5차).
 *   이름   StrITEM[88~97] · 효과 문구 StrITEM[148~154]
 *   가격   표 0xcc430 × 10 (100만원 단위) — 웹판 소지금은 만원이라 × 1000
 *   보유   선수 +0x58+k 플래그, 영구 (0x14d12)
 *   효과   k 0~4 는 코드에서 확인. k 5~9 는 효과 문구대로 넣었고 **값은 원본과 같음이 확정**됐다 (G 0절) —
 *          다만 코드에서 어디에 적용되는지는 아직 못 짚었다
 */
export interface SubItem {
  readonly id: number
  readonly name: string
  /** 만원 */
  readonly price: number
  readonly effectText: string
}

const PRICE_TABLE = [15, 20, 15, 15, 10, 25, 20, 10, 20, 20]
const PRICE_UNIT = 1000
const NAMES = ['표적판', '1톤 바벨', '모래주머니', '하드타이어', '자동안마기', '화보집', '외식회원증', '보험증서', '야구교본', '명품정장']
const EFFECT_TEXTS = [
  '히트 훈련 시 +2',
  '파워 훈련 시 +2',
  '수비 훈련 시 +2',
  '주루 훈련 시 +2',
  '훈련 시 사기 감소량 -1',
  '경기장 [팬미팅] 시 인기도 +2',
  '번화가 [외식] 시 사기회복 +4',
  '병원 [입원] 시 소지금 감소없음 / 사기회복+1',
  '학교 [야구교실] 시 인기도 +1 / 평판 +1',
  '방송국 [CF촬영] 시 소지금 +400만',
]

export const SUB_ITEMS: readonly SubItem[] = NAMES.map((name, id) => ({
  id,
  name,
  price: PRICE_TABLE[id] * PRICE_UNIT,
  effectText: EFFECT_TEXTS[id],
}))

/** 원문 알림 — StrMODE[77] · [78] */
export const SUB_ITEM_BLOCK_TEXT: Readonly<Record<'소지금부족' | '이미보유', string>> = {
  소지금부족: '소지금이 부족합니다',
  이미보유: '이미 가지고 있는 아이템입니다',
}

export type SubItemBlockReason = '소지금부족' | '이미보유'

export const hasSubItem = (career: PlayerCareer, id: number) => career.subItemIds.includes(id)

export function subItemBlockReasonOf(career: PlayerCareer, id: number): SubItemBlockReason | null {
  if (hasSubItem(career, id)) return '이미보유'
  return career.money < SUB_ITEMS[id].price ? '소지금부족' : null
}

export function purchaseSubItem(career: PlayerCareer, id: number): PlayerCareer {
  const blockReason = subItemBlockReasonOf(career, id)
  if (blockReason !== null) throw new Error(`서브 아이템을 살 수 없습니다 (${blockReason}): ${SUB_ITEMS[id].name}`)
  return { ...career, money: career.money - SUB_ITEMS[id].price, subItemIds: [...career.subItemIds, id] }
}

/** 훈련 +2 아이템 — 능력치 인덱스 k 와 아이템 k 가 같다 */
const TRAINING_ITEM_OF: Readonly<Record<keyof BatterAbility, number>> = { hit: 0, power: 1, defense: 2, run: 3 }
const TRAINING_ITEM_BONUS = 2
const MASSAGE_CHAIR = 4

export function subItemTrainingBonus(career: PlayerCareer, ability: keyof BatterAbility): number {
  return hasSubItem(career, TRAINING_ITEM_OF[ability]) ? TRAINING_ITEM_BONUS : 0
}

/** 자동안마기 — 훈련 사기 감소량 −1 (+0x5c) */
export function subItemMoraleRelief(career: PlayerCareer): number {
  return hasSubItem(career, MASSAGE_CHAIR) ? 1 : 0
}

const OUTING_ITEM = { 팬미팅: 5, 외식: 6, 입원: 7, 야구교실: 8, CF촬영: 9 } as const
const CF_BONUS_MONEY = 400

/** 외출 기능 효과에 서브 아이템 보정을 더한다 — 값은 확정, 원본의 적용 지점만 미확인 (G 0절) */
export function applyOutingSubItems(career: PlayerCareer, functionId: string, effect: RolledOutingEffect): RolledOutingEffect {
  const owns = (name: keyof typeof OUTING_ITEM) => functionId === name && hasSubItem(career, OUTING_ITEM[name])
  if (owns('팬미팅')) return { ...effect, popularityGain: effect.popularityGain + 2 }
  if (owns('외식')) return { ...effect, moraleGain: effect.moraleGain + 4 }
  if (owns('입원')) return { ...effect, moneyCost: 0, moraleGain: effect.moraleGain + 1 }
  if (owns('야구교실')) return { ...effect, popularityGain: effect.popularityGain + 1, reputationGain: effect.reputationGain + 1 }
  if (owns('CF촬영')) return { ...effect, moneyCost: effect.moneyCost - CF_BONUS_MONEY }
  return effect
}
