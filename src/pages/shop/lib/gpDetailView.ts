import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import type { GpItem } from '@/entities/career/model/gpItems'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedPitcherAbilityOf, pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_GP_ITEMS } from '@/entities/pitcher-career/model/pitcherItems'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import {
  BATTER_DETAIL_LABEL_FRAMES,
  detailRowsFromSlots,
  gpItemDetailChangesOf,
  PITCHER_DETAIL_LABEL_FRAMES,
} from '@/pages/management/lib/detailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'

/**
 * 상점 GP 아이템 결과 창 — 구매 확정 0x14a74 의 창 갈래(0x14e8e~0x15180, 두 모드 공용, 디스어셈 확정).
 *   현재값  능력치 네 칸 = 효과 **뒤** `0xb6415(기록, k, 1)`(0x1504a 다시 읽기 — 장비·장착 스킬까지),
 *           사기 칸 = 효과 **전** 0xa3a25(0x14f92 — 다시 안 읽는다. 영지버섯이면 오르기 전 사기가 보인다, 원본 그대로).
 *   최대값  0x14f22 `0x5e865` 가 채운 한계(창+0x118) — 타자 타입 표 · 투수 보직 표(모드 3 갈래) · 사기 100.
 *   변화량  `gpItemDetailChangesOf` (효과 전 기본값 `0xb6415(기록, k, 0)` 과 한계로). 넷째 칸은 0 (0x14ea8 비움).
 *   글      "" + "!cFFFFFF[!cFFFF00" + StrITEM[98+k] + "!cFFFFFF]" + " 구매" + "!N효과 : !cFFFF00" + 효과 (0x15096~0x15180)
 *           효과 = 칸 0~3 StrITEM[165] "%s 능력치 + 10"(%s = StrMODE[35+k], 투수 [40+k] — 0x150f8 모드 3 갈래)
 *                · 칸 4 StrITEM[166] · 칸 6 StrITEM[168] — 상점 설명 줄 `effectText` 와 같은 글이다.
 *           창 글 칸은 색을 안 그리므로(훈련 창과 같이) 색 표시는 빼고 `!N` 에서 줄을 나눈다.
 * 이름 StrITEM[0x62+k] 은 모드 갈림이 없다 — 창이 뜨는 칸(0~4·6)은 두 모드 이름이 같다.
 */

const BATTER_ABILITY_KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']

function messagesOf(item: GpItem): string[] {
  return [`[${item.name}] 구매`, `효과 : ${item.effectText}`]
}

export function batterGpDetailViewOf({ itemIndex, before, after }: GpDetailOf<PlayerCareer>): DetailView | null {
  const limits = abilityLimitOf(before.battingTypeIndex)
  const limitSlots = BATTER_ABILITY_KEYS.map((key) => limits[key])
  const change = gpItemDetailChangesOf(itemIndex, BATTER_ABILITY_KEYS.map((key) => before.ability[key]), limitSlots)
  if (change === null) return null
  const current = equippedAbilityOf(after)
  return {
    rows: detailRowsFromSlots(
      BATTER_DETAIL_LABEL_FRAMES,
      { ability: BATTER_ABILITY_KEYS.map((key) => current[key]), morale: before.morale },
      { ability: limitSlots, morale: MAXIMUM_MORALE },
      change,
    ),
    messages: messagesOf(BATTER_GP_ITEMS[itemIndex]),
  }
}

export function pitcherGpDetailViewOf({ itemIndex, before, after }: GpDetailOf<PitcherCareer>): DetailView | null {
  const limits = pitcherAbilityLimitsOf(before)
  const limitSlots = PITCHER_ABILITY_ORDER.map((key) => limits[key])
  const change = gpItemDetailChangesOf(itemIndex, PITCHER_ABILITY_ORDER.map((key) => before.ability[key]), limitSlots)
  if (change === null) return null
  const current = equippedPitcherAbilityOf(after)
  return {
    rows: detailRowsFromSlots(
      PITCHER_DETAIL_LABEL_FRAMES,
      { ability: PITCHER_ABILITY_ORDER.map((key) => current[key]), morale: before.morale },
      { ability: limitSlots, morale: MAXIMUM_MORALE },
      change,
    ),
    messages: messagesOf(PITCHER_GP_ITEMS[itemIndex]),
  }
}
