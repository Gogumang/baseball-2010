import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { isSkillEquipped, MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { BATTER_DETAIL_LABEL_FRAMES, detailRowsFromSlots } from '@/pages/management/lib/detailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'

/**
 * **능력치 상세 창** — 나리 상태 **120** (기본정보 119 에서 '0'). 시즌 0xda 도 같은 창이지만 글은 0x897e8 이 따로 만든다.
 *
 * 진입 0x1b624: 글 버퍼 0x1552af4 를 0x200 바이트 비우고 **0x88fe8(창)** 으로 표와 글 줄을 채운다 (직접 떴다, 0x88fe8~0x897d4).
 * 그리기 0x1b2e4: 기본정보 카드 0x15e20 → 창 0x8a0a4(표 0x872d4 + 글 상자) → 0x7f4ed(머리띠, 틀 0x16928 "그 밖" = 바닥 5).
 * 키 0x1b654: 취소(−16)·'0'(0x30) → 119, 그 밖은 0x8a044(창, 키) 글 스크롤.
 *
 * **표** (0x890a2~0x8911c → 0x872a0, 다섯 줄 × 네 칸):
 *   - 현재  `0xb6415(기록, k, 0)` — 장비·스킬을 뺀 **기본** 능력치
 *   - 최대  창 +0x14c (0x5e865 가 채운 타입 한계)
 *   - 변화  `0xb570c(…, k, 기록, 1, 체력 100, 1)` − 현재 — 장비·스킬·질병·부상·사기를 모두 먹인 실효값과의 차이
 *   - 넷째 칸(보너스) 은 0 으로 비운 배열 그대로
 *   - 사기 줄: 현재 0xa3a25 · 최대 100 · 변화 0
 *
 * **글 줄** (창 +0x354 + 4i, 개수 +0x37c, 스크롤 +0x380 = 0) — 이 차례로 조건이 맞는 것만:
 *   1. 장비 니블 k(기록 +0x19 윗·아랫, +0x1a 윗·아랫) n ≥ 1 이면
 *      `"[!cFFFF00" + StrITEM[(n−1) + 11k (+44 투수)] + "!cFFFFFF] " + StrMODE[35+k (투수 40+k)] + " +" + 표0xd41ae[n−1]`
 *   2. 스킬 5 장착(0xb62b5) → `"[" + StrCOMMON[60] + "] " + StrMODE[39] + " -100"` · 3. 스킬 7 → StrCOMMON[62] … `" +50"`
 *   4. 질병(선수 +5 ≠ 0) → `"[!cFFFF00질병!cFFFFFF] " + StrMODE[39] + " 30% 감소"`
 *   5. 부상(s8 선수 +0x1b5 > 0) → `"[…부상…] " + StrMODE[39] + " 60% 감소"`
 *   6. 사기 ≤ 50 → `"[…사기…] " + StrMODE[39] + " " + (사기 > 30 ? 10 : 사기 > 10 ? 20 : 50) + "% 감소"`
 * 모드 갈림은 0x7b970(창 +0x20 == 4, 타자편)뿐이다 — 투수편은 `pages/pitcher-league/lib/pitcherDetailPopup` 이 같은 함수에 값을 넣는다.
 */

/** 0xd41ae — 장비 니블 n 의 보너스 (0xb6414 가 쓰는 0xd8890 과 같은 값이다) */
const equipmentLineBonusOf = equipmentBonusOf

/** StrITEM 은 부위마다 11칸 (레벨 0~10) */
const ITEMS_PER_PART = 11
/** 투수편 장비 이름은 StrITEM 44 칸부터 (0x8914c `adds r4, #0x2b` = (n−1) + 0x2c) */
const PITCHER_ITEM_BASE = 44
/** StrMODE[35..38] 히트·파워·수비·주루 / [40..43] 제구·구속·변화·체력 / [39] 모든능력치 */
const BATTER_ABILITY_NAME_BASE = 35
const PITCHER_ABILITY_NAME_BASE = 40
const ALL_ABILITIES_NAME = 39
/** StrCOMMON[55 + 스킬 번호] = 스킬 이름 — 0x89506 `[0x1552cf8][0x3c]` · 0x895a4 `[0x3e]` */
const POWERLESS_SKILL = 5
const LEGEND_SKILL = 7

const highlighted = (name: string) => `[!cFFFF00${name}!cFFFFFF] `

/** 사기 감소 줄의 % — 0x8973c~0x897a2: 기본 50, 사기 > 30 이면 10, 그 밖 사기 > 10 이면 20 */
function moraleCutPercentOf(morale: number): number {
  if (morale > 30) return 10
  if (morale > 10) return 20
  return 50
}

/** 0x88fe8 이 읽는 값 — 모드와 상관없는 꼴 (칸 k = 능력치 k) */
export interface AbilityDetailSource {
  /** 0x7b970 — 창 +0x20 == 4(타자편) */
  readonly isBatter: boolean
  /** `0xb6415(기록, k, 0)` 기본 능력치 네 칸 */
  readonly base: readonly number[]
  /** 창 +0x14c 타입 한계 네 칸 */
  readonly limits: readonly number[]
  /** 피로 없는 `0xb570c` 실효 능력치 네 칸 */
  readonly effective: readonly number[]
  /** 0xa3a25 */
  readonly morale: number
  /** 장비 니블 네 칸 (0 = 없음, n = 레벨 + 1) */
  readonly equipmentNibbles: readonly number[]
  readonly isPowerlessEquipped: boolean
  readonly isLegendEquipped: boolean
  /** 선수 +5 */
  readonly isSick: boolean
  /** s8 선수 +0x1b5 > 0 */
  readonly isInjured: boolean
}

/** 0x88fe8 — 표 줄은 `labelFrames`(타자 336~339 · 투수 340~343, 사기 84)로 세운다 */
export function abilityDetailViewOf(source: AbilityDetailSource, labelFrames: readonly number[]): DetailView {
  const rows = detailRowsFromSlots(
    labelFrames,
    { ability: source.base, morale: source.morale },
    { ability: source.limits, morale: MAXIMUM_MORALE },
    { ability: source.effective.map((value, k) => value - (source.base[k] ?? 0)), morale: 0 },
  )

  const allAbilities = ORIGINAL_MODE_TEXT[ALL_ABILITIES_NAME]
  const messages: string[] = []
  source.equipmentNibbles.forEach((nibble, k) => {
    if (nibble < 1) return
    const itemIndex = nibble - 1 + ITEMS_PER_PART * k + (source.isBatter ? 0 : PITCHER_ITEM_BASE)
    const abilityName = ORIGINAL_MODE_TEXT[(source.isBatter ? BATTER_ABILITY_NAME_BASE : PITCHER_ABILITY_NAME_BASE) + k]
    messages.push(`${highlighted(ORIGINAL_ITEMS[itemIndex] ?? '')}${abilityName} +${equipmentLineBonusOf(nibble)}`)
  })
  if (source.isPowerlessEquipped) messages.push(`${highlighted(ORIGINAL_SKILLS[POWERLESS_SKILL].name)}${allAbilities} -100`)
  if (source.isLegendEquipped) messages.push(`${highlighted(ORIGINAL_SKILLS[LEGEND_SKILL].name)}${allAbilities} +50`)
  if (source.isSick) messages.push(`${highlighted('질병')}${allAbilities} 30% 감소`)
  if (source.isInjured) messages.push(`${highlighted('부상')}${allAbilities} 60% 감소`)
  if (source.morale <= 50) messages.push(`${highlighted('사기')}${allAbilities} ${moraleCutPercentOf(source.morale)}% 감소`)

  return { rows, messages }
}

/** 글 상자에 한 번에 보이는 줄 — 0x8a044 는 줄 수 > 4 일 때만 민다 */
export const ABILITY_DETAIL_VISIBLE_LINES = 4

/**
 * 0x8a044(창, 키) — 글 스크롤. ↑(−1)·'2' 는 위로(0 아래면 줄 수 − 4 로 감는다), ↓(−2)·'8' 은 아래로
 * (줄 수 − 4 를 넘으면 0 으로 감는다). 줄 수가 4 이하면 그대로.
 */
export function scrollAbilityDetail(offset: number, lineCount: number, direction: 'up' | 'down'): number {
  if (lineCount <= ABILITY_DETAIL_VISIBLE_LINES) return offset
  const last = lineCount - ABILITY_DETAIL_VISIBLE_LINES
  if (direction === 'up') return offset - 1 < 0 ? last : offset - 1
  return offset + 1 > last ? 0 : offset + 1
}

/** 웹 키 → 0x8a044 방향 (↑ −1 · '2' / ↓ −2 · '8') */
export function abilityDetailScrollKeyOf(key: string): 'up' | 'down' | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  return null
}

const BATTER_ORDER: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']

/** 타자편 120 — 실효값은 피로 없는 0xb570c(`effectiveAbilityOf`) */
export function batterAbilityDetailViewOf(career: PlayerCareer): DetailView {
  const limits = abilityLimitOf(career.battingTypeIndex)
  const effective = effectiveAbilityOf(career)
  return abilityDetailViewOf(
    {
      isBatter: true,
      base: BATTER_ORDER.map((key) => career.ability[key]),
      limits: BATTER_ORDER.map((key) => limits[key]),
      effective: BATTER_ORDER.map((key) => effective[key]),
      morale: career.morale,
      equipmentNibbles: BATTER_ORDER.map((key) => career.equipmentLevels[key]),
      isPowerlessEquipped: isSkillEquipped(career, POWERLESS_SKILL),
      isLegendEquipped: isSkillEquipped(career, LEGEND_SKILL),
      isSick: career.isSick,
      isInjured: career.isInjured,
    },
    BATTER_DETAIL_LABEL_FRAMES,
  )
}
