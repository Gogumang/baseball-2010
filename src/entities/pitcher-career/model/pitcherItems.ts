import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  BATTER_GP_ITEMS,
  applyGpItemWith,
  gpItemBlockReasonWith,
  gpItemNoticeWith,
  purchaseGpItemWith,
} from '@/entities/career/model/gpItems'
import type { GpItem, GpItemResultOf, GpItemRules, GpPurchaseOf, LotteryPrize } from '@/entities/career/model/gpItems'
import { SUB_ITEMS } from '@/entities/career/model/subItems'
import type { SubItem } from '@/entities/career/model/subItems'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCHER_ABILITY_NAMES,
  PITCHER_ABILITY_ORDER,
  applyPitcherAbilityItem,
} from '@/entities/pitcher-career/model/pitcherAbility'
import { applyStaminaTonic, canBuyStaminaTonic } from '@/entities/pitcher-career/model/pitcherStamina'

/**
 * 투수편(모드 3) **서브 아이템 · GP 아이템** — 타자편과 같은 코드를 탄다. 모드로 갈리는 자리만 여기 모았다
 * (모두 디스어셈 확정).
 *
 * **서브 아이템 (창 종류 1)**
 *   - 상점 키 0x1364e · 구매 확정 0x14c8c 에 모드 갈림이 없다 — 가격 `0xcc430`(10칸뿐) × 10 · 보유 `기록[0x58+k]` ·
 *     가드 보유(StrMODE[78]) → 소지금([77]) 이 타자편과 같다. 이름도 StrITEM[88+k] 그대로 (0x845d4).
 *   - 다른 것은 설명 줄뿐: 칸 0~3 의 "%s 훈련 시 +2"(StrITEM[148]) 에 투수면 StrMODE[40+k] 가 들어간다 (0x82938~0x8296a).
 *   - 효과: 훈련 0x17f5c(모드 공용)가 `기록[0x58 + 훈련 칸 k]` 로 +2 (0x187f6), 자동안마기 `+0x5c` 로 사기 감소 −1
 *     (0x188cc · 마구 0x18036) — `pitcherManagement.ts` 가 붙인다.
 *     칸 5~9(외출 보정, `기록[0x5d+장소]`)는 외출 효과 0x15234(모드 공용)가 더한다 — 타자편 `outing.ts` 를 그대로 탄다.
 *
 * **GP 아이템 (창 종류 2)**
 *   - 가격 `0xcc41b[k (모드 4 면 +10)]` × 100 — 두 블록이 같은 값이라 타자편 가격 그대로 (0x14e42~0x14e5e).
 *   - 이름 0x826b0: 칸 9 는 모드 4 면 StrITEM[108] 이글아이, **아니면 StrITEM[98+9] = 십전대보탕**.
 *   - 설명 0x828c8~0x829e8: 칸 0~3 은 StrITEM[165] "%s 능력치 + 10" 에 StrMODE[40+k] (0x7b984 투수 갈래),
 *     칸 9 는 StrITEM[162+9] "스태미나 100% 회복".
 *   - 아이콘 0x82464: 모드 4 아니면 표 0xd4676 = [10..18, **20**] (칸 9 = 20).
 *   - 가드 0x13460 kind 2: 한계 표 0xcc4fa(= 0xd80be) 를 `0xb6705`(보직) 로 고르고 이름은 StrMODE[40+i].
 *     칸 9 는 `(s16)[0x1fbd1(app)+0x2c] == 10000` 이면 StrMODE[211] (이글아이 안내줄 224 는 안 붙는다).
 *   - 효과 0xa4488(기록, 모드==4, k): 능력치는 투수 칸(+0xc~) · 보직 한계 · 알림 이름 StrMODE[40+k] (0xa456a),
 *     칸 9 는 `[0x1fbd1(app)+0x2c] = 10000` + StrMODE[125] (0xa49ec). 나머지(복권·영지버섯·건강진단·최면요법)는 같다.
 */

/** 서브 아이템 — 이름·가격은 타자편 그대로, 칸 0~3 설명만 투수 능력치 이름 */
export const PITCHER_SUB_ITEMS: readonly SubItem[] = SUB_ITEMS.map((item) =>
  item.id < PITCHER_ABILITY_NAMES.length
    ? { ...item, effectText: `${PITCHER_ABILITY_NAMES[item.id]} 훈련 시 +2` }
    : item,
)

const STAMINA_TONIC_ID = 9

/** GP 아이템 — 칸 0~3 설명·칸 9 이름/설명만 투수 것 */
export const PITCHER_GP_ITEMS: readonly GpItem[] = BATTER_GP_ITEMS.map((item) => {
  if (item.id < PITCHER_ABILITY_NAMES.length) {
    return { ...item, effectText: `${PITCHER_ABILITY_NAMES[item.id]} 능력치 + 10` } // StrITEM[165]
  }
  if (item.id === STAMINA_TONIC_ID) return { ...item, name: '십전대보탕', effectText: '스태미나 100% 회복' } // StrITEM[107] · [171]
  return item
})

/** GP 아이콘 표 0xd4676 (투수) — 칸 9 십전대보탕만 20 이다 (타자 0xd468a 는 19) */
export const PITCHER_GP_ICON_FRAMES: readonly number[] = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20]

/** 0xa4488 의 투수 갈래 */
const PITCHER_GP_RULES: GpItemRules<PitcherCareer> = {
  applyAbilityItem: (career, id) => ({ ...career, ability: applyPitcherAbilityItem(career.ability, id, career.role) }),
  applyNinthItem: (career) => ({ ...career, stamina: applyStaminaTonic() }),
}

export function applyPitcherGpItem(
  career: PitcherCareer,
  id: number,
  random: RandomPort,
): GpItemResultOf<PitcherCareer> {
  return applyGpItemWith(PITCHER_GP_RULES, career, id, random)
}

/** G 부족이면 거절, 아니면 G 를 빼고 곧바로 쓴다 (0x14a74 kind 2) */
export function purchasePitcherGpItem(
  career: PitcherCareer,
  id: number,
  random: RandomPort,
): GpPurchaseOf<PitcherCareer> {
  return purchaseGpItemWith(PITCHER_GP_RULES, career, id, random)
}

/** 구매 가드 (0x13460 kind 2) — G 부족(StrMODE[65])은 부르는 쪽이 먼저 본다 */
export function pitcherGpItemBlockReasonOf(career: PitcherCareer, id: number): string | null {
  const limits = pitcherAbilityLimitsOf(career)
  return gpItemBlockReasonWith(
    {
      abilities: PITCHER_ABILITY_ORDER.map((key) => career.ability[key]),
      limits: PITCHER_ABILITY_ORDER.map((key) => limits[key]),
      abilityNames: PITCHER_ABILITY_NAMES,
      morale: career.morale,
      isInjured: career.isInjured,
      isSick: career.isSick,
      skillIds: career.skillIds,
      // StrMODE[211]
      ninthItemBlock: canBuyStaminaTonic(career.stamina) ? null : '스태미나가 최대입니다 구매 할 수 없습니다',
    },
    id,
  )
}

/** 사용 알림 — 능력치 이름 StrMODE[40+k] · 모든능력치 [39] · 십전대보탕 [125] */
export function pitcherGpItemNoticeOf(id: number, prize: LotteryPrize | null, prizeItemId?: number): string {
  return gpItemNoticeWith(
    {
      abilityNames: [...PITCHER_ABILITY_NAMES, '모든능력치'],
      ninthItemNotice: '스태미나가 100% 회복되었습니다',
    },
    id,
    prize,
    prizeItemId,
  )
}
