import { BALANCE } from '@/shared/config/original/balance'
import { isLiveGameFightingSpiritSituation } from '@/shared/lib/liveGameState/liveGameState'
import { nariRecordTeamIdOf } from '@/entities/career/model/nariMorale'
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

/** 0xb62b5(선수, 0xe) — 투수 비트 14 투지 (skills.json 30) */
const FIGHTING_SPIRIT_SKILL_BIT = 14
/** 0xb5b06 — 맨 끝 자르기 */
const ABILITY_MAXIMUM = 999

/** 0xb5a28~0xb5a72 스킬 14 갈래 → 0xb5b06 자르기 (칸 ≠ 3 · 0 쪽 버림) */
function withFightingSpirit(career: PitcherCareer, ability: PitcherAbility): PitcherAbility {
  if (!isPitcherSkillEquipped(career, FIGHTING_SPIRIT_SKILL_BIT)) return ability
  if (!isLiveGameFightingSpiritSituation(nariRecordTeamIdOf(career))) return ability
  const raised = { ...ability }
  PITCHER_ABILITY_ORDER.forEach((key, slot) => {
    if (slot === FIGHTING_SPIRIT_EXCLUDED_SLOT) return
    raised[key] = Math.min(ABILITY_MAXIMUM, Math.max(0, ability[key] + Math.trunc(ability[key] / 10)))
  })
  return raised
}
/** 스킬 14 에서 빠지는 칸 — 체력 3 (b5a48 `cmp r7, #3`) */
const FIGHTING_SPIRIT_EXCLUDED_SLOT = 3

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
 * 실효값은 피로 없는 0xb570c = `effectivePitcherAbilityOf` 에 **스킬 14(투지) 갈래**(0xb5a28~0xb5a72, A-11)를 얹은 것:
 * 투수 · 장착 14(0xb62b5(rec, 0xe)) · 칸 ≠ 3(체력) · 전역 경기 상태 [0x1552d0c] +0x6b > 4 · 0xb6a4d(상태) == 0xb6be9(상태, 팀)
 * 이면 `v += v/10` — 관리 화면이라 **마지막으로 돈 사람 경기**(모드 불문)의 이닝 · 측별 팀 · 점수를 본다
 * (`isLiveGameFightingSpiritSituation`). 팀은 0x1f989(저장, S[1]) 레코드 +0 (`nariRecordTeamIdOf` — 대회 중이면 상대국 칸).
 * 모드 3 은 팀 정액(0xb592c)도 코치(0xb5a74)도 없어 이 값 뒤로는 0..999 자르기(0xb5b06)뿐이다.
 */
export function pitcherAbilityDetailViewOf(career: PitcherCareer): DetailView {
  const limits = pitcherAbilityLimitsOf(career)
  const effective = withFightingSpirit(career, effectivePitcherAbilityOf(career))
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
