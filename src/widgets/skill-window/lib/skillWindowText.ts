/** 아이템/스킬 창의 문구 — StrMODE · StrCOMMON · StrSKILL · StrITEM 에서 고른다 */
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { pitcherSkillTableIdOf } from '@/entities/pitcher-career/model/pitcherCareer'

/** 0x7b970 — 모드 4(타자편)인가. 이름 딱지 149/150 · 스킬 이름표 · 서브아이템 능력치 이름이 갈린다 */
export type SkillWindowSide = '타자' | '투수'

/** 이 창이 쓰는 StrMODE 번호 (`modeText.json` 과 번호가 같다) */
export const SKILL_WINDOW_TEXT = {
  G포인트부족: 65,
  해제불가: 129,
  사용확인: 130,
  해제확인: 131,
  최대: 132,
  확장앞: 133,
  확장뒤: 134,
  확장됨: 136,
} as const

export const modeTextOf = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''

/**
 * 스킬 비트 → 표 번호 (0x8457c). 모드 4 거나 s ≤ 7 이면 그대로, 투수편 8~23 은 +16 (`pitcherSkillTableIdOf`).
 * 칸 이름은 StrCOMMON[0x37 + 표 번호] = `ORIGINAL_SKILLS[표].name`, 설명은 StrSKILL[표]·[40 + 표] (0x82eb2~0x82ebe).
 */
export const skillTableIdOf = (side: SkillWindowSide, skillId: number): number => (side === '타자' ? skillId : pitcherSkillTableIdOf(skillId))

export const skillNameOf = (side: SkillWindowSide, skillId: number): string => ORIGINAL_SKILLS[skillTableIdOf(side, skillId)]?.name ?? ''

/** StrITEM — 서브아이템 이름 첫 번호 (88 + i) · 설명 머리 (155 + i) · 4~9 효과 (145 + i) · 0~3 효과 꼴 148 */
const ITEM_NAME_BASE = 88
const ITEM_TITLE_BASE = 155
const ITEM_EFFECT_BASE = 145
const ITEM_TRAINING_EFFECT = 148
/** 0~3 효과의 능력치 이름 StrMODE[35+i] (모드 3 이면 40+i) */
const ABILITY_NAME_BASE = { 타자: 35, 투수: 40 } as const
/** 훈련 효과 꼴(148)을 쓰는 마지막 서브아이템 */
const LAST_TRAINING_ITEM = 3

export const subItemNameOf = (index: number): string | undefined => ORIGINAL_ITEMS[ITEM_NAME_BASE + index]

/** 서브아이템 설명 (0x82a48~0x82b6e): "!cFFFFFF" + StrITEM[155+i] + "!N효과 : !cFFFF00" + 효과 */
export function subItemDescriptionOf(side: SkillWindowSide, index: number): string {
  // 0~3 은 sprintf(StrITEM[148] "%s 훈련 시 +2", StrMODE[35+i] (모드 3 이면 40+i)) — 표 [win+0x164] 를 StrMODE 로 읽었다
  // (히트·파워·수비·주루 / 제구·구속·변화·체력 이 번호와 맞아 유력). 4~9 는 StrITEM[145+i].
  const effect =
    index <= LAST_TRAINING_ITEM
      ? (ORIGINAL_ITEMS[ITEM_TRAINING_EFFECT] ?? '').replace('%s', modeTextOf(ABILITY_NAME_BASE[side] + index))
      : (ORIGINAL_ITEMS[ITEM_EFFECT_BASE + index] ?? '')
  return `!cFFFFFF${ORIGINAL_ITEMS[ITEM_TITLE_BASE + index] ?? ''}!N효과 : !cFFFF00${effect}`
}
