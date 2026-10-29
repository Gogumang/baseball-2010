import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** GP 아이템 칸 번호 — 0~3 능력치 · 4 모든 능력치 · 5 또또상품권 · 6 영지버섯 · 7 종합건강진단 · 8 최면요법 · 9 이글아이/십전대보탕 */
export const ITEM = { 도시락: 4, 또또상품권: 5, 영지버섯: 6, 건강진단: 7, 최면요법: 8, 이글아이: 9 } as const

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

export type LotteryPrize = 1 | 2 | 3 | 4 | 5 | 6 | '엄마상' | '메디카상' | '우정상' | '아차상'

export interface GpItemResultOf<T> {
  readonly career: T
  readonly lotteryPrize: LotteryPrize | null
  /** 상(엄마상 등)으로 받은 GP 아이템 번호 */
  readonly prizeItemId?: number
}
