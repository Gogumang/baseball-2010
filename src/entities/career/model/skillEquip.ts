import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  equippedPlusSkillCountOf, isMinusSkill, isSkillEquipped, MAXIMUM_GAME_POINT, PLUS_SKILL_SLOT_LIMITS,
  plusSkillSlotLimitOf, setSkillEquipped,
} from '@/entities/career/model/playerCareer'

/**
 * 스킬 창(선수정보 칸 "아이템/스킬", 상태 122)의 장착·해제·슬롯 확장 — H-modes 6절 (확정).
 *
 * 확인 키 0x13140 이 고른 스킬 s 로 질문을 고르고, 그 답을 대화 0x147b0 이 받는다
 * (대화 번호 `[저장+0x248]` − 2 로 점프표 0xcc6b0): **3 해제 · 4 장착 · 6 확장**.
 */

/** 슬롯 확장 비용 표 0xcc4f7 = [5, 10] — 원본이 `× 1000`(0xfa<<2) 해서 G 로 쓴다 */
const SLOT_EXPANSION_COST_UNITS: readonly number[] = [5, 10]
const SLOT_EXPANSION_COST_SCALE = 1000
/** 확장 뒤 단계는 `min(L + 1, 2)` (0x148ec~0x148f8) */
export const MAXIMUM_SKILL_SLOT_LEVEL = 2

/** 지금 단계에서 다음 단계로 넓히는 값 (G) — 0xcc4f7[L] × 1000 */
export function skillSlotExpansionCostOf(career: Pick<PlayerCareer, 'skillSlotLevel'>): number {
  return (SLOT_EXPANSION_COST_UNITS[career.skillSlotLevel] ?? 0) * SLOT_EXPANSION_COST_SCALE
}

/**
 * 확인 키 0x13140 의 갈래 — 고른 스킬 s 에 무슨 질문/알림을 띄우나.
 *   `'해제불가'` 마이너스 스킬 → "[" + 이름 + StrMODE[129] (알림 1,1)
 *   `'해제확인'` 이미 장착(0xa4bf8) → "[" + 이름 + StrMODE[131] (예/아니오 2,3)
 *   `'장착확인'` 장착 수 < 상한(0xcc4f4[L]) → "[" + 이름 + StrMODE[130] (2,4)
 *   `'확장확인'` 가득 찼고 L ≤ 1 → 비용 + [133] + " " + 0xcc4f4[L+1] + " " + [134] (2,6)
 *   `'최대'`     가득 찼고 L = 2 → StrMODE[132] %d = 상한 (1,5)
 * 순서도 원본 그대로다 — 마이너스 검사가 장착 검사보다 먼저다.
 */
export type SkillConfirmKind = '해제불가' | '해제확인' | '장착확인' | '확장확인' | '최대'

/** 창·확장이 보는 칸 — 모드 3(투수편)도 같은 0x13140·0x147b0 을 타므로 칸 꼴만 받는다 */
export type SkillSlots = Pick<PlayerCareer, 'equippedSkillIds' | 'skillSlotLevel'>

export function skillConfirmKindOf(career: SkillSlots, skillId: number): SkillConfirmKind {
  if (isMinusSkill(skillId)) return '해제불가'
  if (isSkillEquipped(career, skillId)) return '해제확인'
  if (equippedPlusSkillCountOf(career) < plusSkillSlotLimitOf(career)) return '장착확인'
  // 0x13300 `cmp L,#1 ; bgt` — L ≤ 1 이면 확장을 묻는다
  if (career.skillSlotLevel <= 1) return '확장확인'
  return '최대'
}

/** 대화 번호 3(해제)·4(장착) — 0x1483c `0xa4b04(P, s, on)` */
export function equipSkill(career: PlayerCareer, skillId: number): PlayerCareer {
  return setSkillEquipped(career, skillId, true)
}

export function unequipSkill(career: PlayerCareer, skillId: number): PlayerCareer {
  return setSkillEquipped(career, skillId, false)
}

export type SkillSlotExpansion<T = PlayerCareer> =
  /** StrMODE[65] "G포인트가 부족합니다 … 구매 페이지로 이동하시겠습니까?" (2,2) */
  | { readonly kind: 'G포인트부족' }
  /** StrMODE[136] "플러스 스킬 장착 슬롯이 %d개로 확장되었습니다" — `slots` = 0xcc4f4[새 L] */
  | { readonly kind: '확장'; readonly career: T; readonly slots: number }

/**
 * 대화 번호 6 — 슬롯 확장 (0x1484c, 확정).
 *   비용 = 0xcc4f7[L] × 1000. `G < 비용` 이면 StrMODE[65].
 *   아니면 G −= 비용(0~99999 로 자름), **L = min(L + 1, 2)** 를 +0x1c6 에 쓰고 StrMODE[136].
 * ⚠️ 그 사이 0x22c29(저장, 모드 4 면 1 아니면 2, 비용) 을 부르는데 뜻을 못 짚었다 — 웹은 두지 않는다(미해결).
 */
export function expandSkillSlots<T extends SkillSlots & Pick<PlayerCareer, 'gamePoint'>>(career: T): SkillSlotExpansion<T> {
  const cost = skillSlotExpansionCostOf(career)
  if (career.gamePoint < cost) return { kind: 'G포인트부족' }
  const level = Math.min(career.skillSlotLevel + 1, MAXIMUM_SKILL_SLOT_LEVEL)
  const next: T = {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, Math.max(0, career.gamePoint - cost)),
    skillSlotLevel: level,
  }
  return { kind: '확장', career: next, slots: PLUS_SKILL_SLOT_LIMITS[level] }
}
