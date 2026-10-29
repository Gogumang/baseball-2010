import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { SCHEDULE_ACTIVITIES } from '@/shared/config/original/modeMenus'

/** `rand(a, b)` = **[a, b)**. 문서의 "14~18" 은 `[14, 19)` 다 */
export type OutingRange = readonly [number, number]

/** 장소 p = `this+0xf8` (P4 3절) */
export const SEASON_OUTING_PLACES = ['경기장', '번화가', '병원', '학교', '방송국'] as const

export type SeasonOutingPlace = (typeof SEASON_OUTING_PLACES)[number]

/**
 * 장소별 기능 이름 = **StrMODE[54 + p]** = 친선경기·회식·입원·야구교실·구단CF.
 * 웹 생성표 `SCHEDULE_ACTIVITIES` 는 앞 5개가 나리(팬미팅·외식·…), **뒤 5개가 시즌**이다.
 */
export const SEASON_OUTING_ACTIVITIES: readonly string[] = SCHEDULE_ACTIVITIES.slice(5)

/**
 * 비용 (100만 원 단위) — 가드 `0xbd38` 2번이 읽는 값. p1 **4** · p2 **5** · p4 **10**,
 * p0·p3 은 0 이다. 효과표의 소지금 기본값과 부호만 다른 같은 값이다.
 */
export const SEASON_OUTING_COSTS: readonly number[] = [0, 4, 5, 0, 10]

/**
 * 필요 인기도 — **p0 친선경기 200 · p4 구단CF 400 뿐**이다 (StrMODE[62]).
 * 나머지 장소에는 인기도 조건이 없다 (나리 쪽과 다른 점).
 */
export const SEASON_OUTING_REQUIRED_POPULARITY: readonly number[] = [200, 0, 0, 0, 400]

/**
 * 효과표 `0xc81c` (P4 3절 확정). 난수 순서는 **사기 → (p0 소지금 | p3 인기도 → 평판 | p4 인기도)**.
 *
 * - `morale` 은 `0xcbbf6` s8 의 [a, b) 이고, **p0·p3 은 부호를 뒤집는다**(0xc8b0).
 * - `money` 는 `0xcbc00` s16 기본값. p0 만 난수(`rand(8,11)`)라 `moneyRange` 로 따로 뒀다.
 * - 적용 자리: 인기도 SR+0x48(0..9999) · 평판 SR+0x62(0..999) · 소지금 SR+2(0..9999) ·
 *   팀 사기 = **팀 레코드 +2**(0..100).
 */
export interface SeasonOutingEffect {
  /** 사기 난수 [a, b) — `negatesMorale` 이면 뺀다 */
  readonly moraleRange: OutingRange
  /** ⚠️ p0 친선경기·p3 야구교실은 사기 난수의 **부호를 뒤집는다** (0xc8b0) */
  readonly negatesMorale: boolean
  /** 소지금 정액 변화 (100만 단위). p0 은 `moneyRange` 를 굴린다 */
  readonly money: number
  readonly moneyRange?: OutingRange
  readonly popularityRange?: OutingRange
  readonly reputationRange?: OutingRange
}

export const SEASON_OUTING_EFFECTS: readonly SeasonOutingEffect[] = [
  // 0 친선경기 — 사기 −(14~18) · 소지금 +(8~10)
  { moraleRange: [14, 19], negatesMorale: true, money: 0, moneyRange: [8, 11] },
  // 1 회식 — 사기 +25~30 · 소지금 −4
  { moraleRange: [25, 31], negatesMorale: false, money: -4 },
  // 2 입원 — 사기 +3~5 · 소지금 −5 (+ 질병 치료 굴림 0xcc6a)
  { moraleRange: [3, 6], negatesMorale: false, money: -5 },
  // 3 야구교실 — 사기 −(8~10) · 인기도 +1~3 · 평판 +3~5
  { moraleRange: [8, 11], negatesMorale: true, money: 0, popularityRange: [1, 4], reputationRange: [3, 6] },
  // 4 구단CF — 사기 +2(`rand(2,3)`) · 소지금 −10 · 인기도 +4~6
  { moraleRange: [2, 3], negatesMorale: false, money: -10, popularityRange: [4, 7] },
]

/**
 * 서브 아이템 보너스 (`SR+0x5d+p`, 점프표 `0xcbe6c`) — StrITEM[220]~[224] 와 같다.
 * **부호 뒤집기 뒤에** 더한다 (P4 3절 · G 171행).
 *
 * 보유 플래그는 모델의 `SeasonRecord.outingSubItems` 다. 서브아이템 상점은 이 칸들을
 * `rec[0x58 + 줄×5 + 칸]` 2×5 격자로 다루고(R12), **외출 쪽이 두 번째 줄 `+0x5d`~`+0x61`** 이다.
 */
export interface SeasonOutingSubItemBonus {
  readonly money?: number
  readonly morale?: number
  readonly popularity?: number
  readonly reputation?: number
  /** StrITEM[220+p] 원문 그대로의 설명 */
  readonly text: string
}

/** StrITEM[220 + p] — 시즌 서브 아이템 칸 5~9 의 효과 글 (상점 설명 0x82b20 `StrITEM[0xd7 + k]`, 원문 `!N` · 들여쓰기 그대로) */
const SEASON_OUTING_EFFECT_TEXT_BASE = 220

const SEASON_OUTING_BONUSES: readonly Omit<SeasonOutingSubItemBonus, 'text'>[] = [
  { money: 5 },
  { morale: 4 },
  { money: 5, morale: 1 },
  { popularity: 1, reputation: 1 },
  { popularity: 2 },
]

export const SEASON_OUTING_SUB_ITEMS: readonly SeasonOutingSubItemBonus[] = SEASON_OUTING_BONUSES.map((bonus, place) => ({
  ...bonus,
  text: ORIGINAL_ITEMS[SEASON_OUTING_EFFECT_TEXT_BASE + place] ?? '',
}))

/** 장소 2 = 병원 [입원] */
export const HOSPITAL_PLACE = 2
