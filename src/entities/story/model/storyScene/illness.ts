import type { OriginalEvent } from '@/shared/config/original/eventTypes'

/** 유리몸 — 질병 확률 +10 (0xadb32) */
const FRAGILE_SKILL = 4
const FRAGILE_BONUS = 10
/** 행운 — 질병 확률 −20 */
const LUCK_SKILL = 6
const LUCK_PENALTY = 20

/** 사기 구간표 — 사기가 문턱보다 크면 그 확률(위에서부터), 어디에도 안 걸리면 14 (0xadb32) */
const MORALE_ILLNESS_BANDS: readonly (readonly [threshold: number, chance: number])[] = [
  [70, 0],
  [50, 2],
  [30, 4],
  [10, 7],
]
const LOWEST_MORALE_ILLNESS_CHANCE = 14

function moraleIllnessChanceOf(morale: number): number {
  return MORALE_ILLNESS_BANDS.find(([threshold]) => morale > threshold)?.[1] ?? LOWEST_MORALE_ILLNESS_CHANCE
}

/**
 * 조건 22 질병 확률(%) — 사기 구간표에 **스킬 보정**이 붙는다 (0xadb32, G-8 확정):
 * 유리몸(스킬 4) +10 · 행운(스킬 6) −20, 0 미만은 0 으로 자른다.
 * 앞서 웹은 사기 구간만 보고 보정을 빼먹고 있었다.
 */
export function illnessChanceOf(morale: number, skillIds: readonly number[] = [], equippedSkillIds: readonly number[] = skillIds): number {
  // 유리몸은 보유(0xa3a74, 0xadba8) · 행운은 **장착**(0xa4bf8, 0xadbba)으로 본다
  const fragileBonus = skillIds.includes(FRAGILE_SKILL) ? FRAGILE_BONUS : 0
  const luckPenalty = equippedSkillIds.includes(LUCK_SKILL) ? LUCK_PENALTY : 0
  return Math.max(0, moraleIllnessChanceOf(morale) + fragileBonus - luckPenalty)
}

/** 질병 이벤트 — 판정 머리 ②의 쿨다운 검사 대상 (0xad026 `0xf5 << 1`) */
export const ILLNESS_EVENT_ID = 490
/** ②가 보는 대상 — 1(공통, 0xad02e) · 4(시즌, 0xad052) */
const ILLNESS_COOLDOWN_AUDIENCES: ReadonlySet<number> = new Set([1, 4])

/** s8 선수+0x7c(질병 쿨다운) — 부호 있는 바이트로 읽는다 */
const signedByteOf = (value: number) => (value << 24) >> 24

/**
 * 판정 0xacfbc 의 ② (0xad00e~0xad054, 직접 떴다):
 * ```
 * [reader+0x34] == 0 && s8 선수+0x7c(질병 쿨다운) > 0 && id == 490 && 대상 ∈ {1, 4} → 불발
 * ```
 * reader+0x34 는 자동 훑기 0x8be80 이 mgr+0x304 에서 베껴 온다. mgr+0x304 는 장면 셋업(나리 0xf684 fb7a · 시즌 0x3b14)이
 * **1** 로 두고, 관리 메뉴 확인 키(나리 105 0x12654 · 시즌 0xc9 0x8f82 — −5 · '5')만 0 으로 내린다. 그래서 장면이 새로 선 뒤
 * 관리 메뉴에서 아무것도 고르기 전의 훑기에서는 쿨다운이 490 을 막지 않는다(원본 그대로). `isFreshScene` 이 mgr+0x304 다.
 */
export function isIllnessCooldownBlocked(event: Pick<OriginalEvent, 'id' | 'audience'>, illnessCooldown: number, isFreshScene: boolean): boolean {
  return !isFreshScene && signedByteOf(illnessCooldown) > 0 && event.id === ILLNESS_EVENT_ID && ILLNESS_COOLDOWN_AUDIENCES.has(event.audience)
}
