import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE, MINUS_SKILL_IDS } from '@/entities/career/model/playerCareer'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { abilityMaxTextOf, LINE_BREAK, maxedAbilityNamesOf } from '@/entities/career/model/gpItems/guard/abilityMaxText'
import { ITEM } from '@/entities/career/model/gpItems/types'

/** 가드 문구에 쓰는 능력치 이름 — StrMODE[35+i] 히트·파워·수비·주루 (0x13820) */
const LIMIT_ABILITY_NAMES = ['히트', '파워', '수비', '주루'] as const
const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const
/** 이글아이는 99 회가 상한이고 98 을 넘으면 맥스로 본다 (0x13a5c) */
const EAGLE_EYE_MAX_THRESHOLD = 98

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

const modeTextAt = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''

/** 엄마의도시락 — 일부만 최대면 살 수 있다. 네 개 다 최대일 때만 막는다. 줄마다 뒤에 "!N"(0x13932~0x1393a) — 끝 줄 뒤에도 붙는다 */
function lunchBoxBlockOf(view: GpGuardView): string | null {
  const maxedNames = maxedAbilityNamesOf(view)
  if (maxedNames.length !== view.abilities.length) return null
  return maxedNames.map((name) => abilityMaxTextOf(name) + LINE_BREAK).join('')
}

/** 칸 4 · 6~9 의 가드 (칸 5 또또상품권은 G 말고 막는 것이 없다) */
const ITEM_GUARDS: Readonly<Record<number, (view: GpGuardView) => string | null>> = {
  [ITEM.도시락]: lunchBoxBlockOf,
  [ITEM.영지버섯]: (view) => (view.morale >= MAXIMUM_MORALE ? modeTextAt(91) : null),
  [ITEM.건강진단]: (view) => (!view.isInjured && !view.isSick ? modeTextAt(208) : null),
  [ITEM.최면요법]: (view) => (view.skillIds.some((skill) => MINUS_SKILL_IDS.includes(skill)) ? null : modeTextAt(209)),
  [ITEM.이글아이]: (view) => view.ninthItemBlock,
}

export function gpItemBlockReasonWith(view: GpGuardView, id: number): string | null {
  if (id < view.abilities.length) {
    // StrMODE[192] "[%s] 능력치가 최대입니다"
    return view.abilities[id] >= view.limits[id] ? abilityMaxTextOf(view.abilityNames[id] ?? '') : null
  }
  return ITEM_GUARDS[id]?.(view) ?? null
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

export function batterGpGuardViewOf(career: PlayerCareer): GpGuardView {
  const limits = abilityLimitOf(career.battingTypeIndex)
  return {
    abilities: ABILITY_KEYS.map((key) => career.ability[key]),
    limits: ABILITY_KEYS.map((key) => limits[key]),
    abilityNames: LIMIT_ABILITY_NAMES,
    morale: career.morale,
    isInjured: career.isInjured,
    isSick: career.isSick,
    skillIds: career.skillIds,
    ninthItemBlock: career.eagleEyeGamesRemaining > EAGLE_EYE_MAX_THRESHOLD ? modeTextAt(210) : null,
  }
}

/** 이글아이 확인창에만 덧붙는 안내줄 StrMODE[224] — 가드가 아니다 (0x13ab4) */
export const EAGLE_EYE_NOTICE = '최대 99회 누적 가능합니다'
export const EAGLE_EYE_ITEM_ID = ITEM.이글아이
