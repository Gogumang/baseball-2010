import { BALANCE } from '@/shared/config/original/balance'
import {
  effectivePitcherAbilityOf, equippedPitcherAbilityOf, isPitcherSkillEquipped, pitcherAbilityLimitsOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement'
import { detailRowsFromSlots, PITCHER_DETAIL_LABEL_FRAMES } from '@/pages/management/lib/detailPopup'
import type { DetailRow, DetailSlots, DetailView } from '@/pages/management/lib/detailPopup'
import { abilityDetailViewOf } from '@/pages/management/lib/abilityDetail'

/**
 * 투수편 상세 결과 창 줄 — 창 0x872a1 · 그리기 0x872d4 는 두 모드 공용이다 (타자편 `detailPopup.ts`).
 * 모드 3 에서 갈리는 것은 둘뿐이다 (디스어셈 확정):
 *   - 이름표: 0x87314 `0x7b984`(모드 3) → img_text 340~343 (`PITCHER_DETAIL_LABEL_FRAMES`).
 *   - 최대값: 0x5e864 의 모드 3 갈래(0x18c74 · 0x18f00) — 보직 0xb6705 로 표 0xd1743[보직 ? 4 : 0 + k] × 10
 *     (첫 여덟 바이트가 0xd80be 와 같다 = `pitcherAbilityLimitsOf`).
 * 현재값은 `0xb6415(기록, k, 1)` = `equippedPitcherAbilityOf`, 사기 칸은 0xa3a25 (훈련·휴식 뒤 값).
 */

const MAXIMUM_MORALE = BALANCE.limits.morale
/** 0xb62b5(기록, 5) 무력감 · (기록, 7) 전설 — 장착 비트 */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7

const abilitySlotsOf = (ability: PitcherAbility): readonly number[] => PITCHER_ABILITY_ORDER.map((key) => ability[key])

function rowsOf(after: PitcherCareer, change: DetailSlots, bonus?: DetailSlots): DetailRow[] {
  return detailRowsFromSlots(
    PITCHER_DETAIL_LABEL_FRAMES,
    { ability: abilitySlotsOf(equippedPitcherAbilityOf(after)), morale: after.morale },
    { ability: abilitySlotsOf(pitcherAbilityLimitsOf(after)), morale: MAXIMUM_MORALE },
    change,
    bonus,
  )
}

/**
 * 능력치 훈련(칸 0~3) 결과 창 — 0x18c58~0x18d4e.
 *   변화량: 훈련 칸 k 에 [sp+0x34](굴린 상승) · 사기 칸 −[sp+0x38](굴린 감소).
 *   넷째 칸: 보정 배열 [sp+0xe8+4k](타입 +1 · 병아리 +1 · 몹쓸몸 −2 · 서브 아이템 +2) · [sp+0xf8](사기 감소 보정).
 * 마구(칸 4)는 0x18bd8 에서 갈라져 이 창을 띄우지 않는다 → null.
 */
export function pitcherTrainingDetailRowsOf(outcome: PitcherTrainingOutcome): DetailRow[] | null {
  const [ability] = Object.keys(outcome.gains) as (keyof PitcherAbility)[]
  if (outcome.magic !== null || ability === undefined) return null
  const slot = PITCHER_ABILITY_ORDER.indexOf(ability)
  const only = (value: number) => [0, 1, 2, 3].map((k) => (k === slot ? value : 0))
  return rowsOf(
    outcome.career,
    { ability: only(outcome.rolledGain), morale: -outcome.rolledMoraleLoss },
    {
      ability: only((outcome.gains[ability] ?? 0) - outcome.rolledGain),
      morale: outcome.moraleLoss - outcome.rolledMoraleLoss,
    },
  )
}

/** 휴식 결과 창 — 0x18ede~0x18fc2: 능력치 칸 0, 사기 칸은 회복 굴림 그대로(100 자르기 전), 보너스 0 */
export function pitcherRestDetailRowsOf(after: PitcherCareer, moraleGain: number): DetailRow[] {
  return rowsOf(after, { ability: [0, 0, 0, 0], morale: moraleGain })
}

/**
 * 투수편 능력치 상세 창(120) — 0x88fe8 의 모드 3 갈래: 장비 이름 StrITEM 44 칸부터 · 능력치 이름 StrMODE[40..43] ·
 * 이름표 340~343. 최대값은 0x5e865 모드 3 갈래(보직 0xb6705) = `pitcherAbilityLimitsOf`.
 * 실효값은 피로 없는 0xb570c = `effectivePitcherAbilityOf`.
 * ⚠️ 미해결: 0xb570c 의 코치 갈래(0xb5a28~0xb5a72 — 투수 · 스킬 14 장착 · 칸 ≠ 3 · 경기 객체 [+0x6b] > 4 ·
 * 0xb6a4d(경기) == 팀이면 +v/10)는 관리 화면에서 **지난 경기 객체**를 읽는다. 웹에는 그 값이 없어 넣지 않았다.
 */
export function pitcherAbilityDetailViewOf(career: PitcherCareer): DetailView {
  const limits = pitcherAbilityLimitsOf(career)
  const effective = effectivePitcherAbilityOf(career)
  return abilityDetailViewOf(
    {
      isBatter: false,
      base: abilitySlotsOf(career.ability),
      limits: abilitySlotsOf(limits),
      effective: abilitySlotsOf(effective),
      morale: career.morale,
      equipmentNibbles: abilitySlotsOf(career.equipmentLevels),
      isPowerlessEquipped: isPitcherSkillEquipped(career, POWERLESS_SKILL),
      isLegendEquipped: isPitcherSkillEquipped(career, LEGEND_SKILL),
      isSick: career.isSick,
      isInjured: career.isInjured,
    },
    PITCHER_DETAIL_LABEL_FRAMES,
  )
}
