/** 투수 비트 번호 (8 이상은 표 번호 비트+16). 하위 표 칸 = 비트 − 2 (0xad292 `subs r0, r4, #3` = v − 3) */
export const PITCHER_SKILL = {
  먹튀: 2,
  몹쓸몸: 3,
  유리몸: 4,
  무력감: 5,
  전설: 7,
  끈기: 10,
  닥터K: 11,
  좌타UP: 12,
  우타UP: 13,
  투지: 14,
  안정감: 16,
  비겁자: 18,
  깃털: 19,
  더티볼: 20,
} as const

/** 0xb6705 — 보직 0 = 선발 */
export const STARTER_ROLE = 0

/** `0xa4f31(S, k)` — 그 해 이미 해제한 마이너스 스킬이면 획득 불발 (연초 115 의 0xa4ee8 이 지운다) */
export function wasRemoved(career: { readonly removedMinusSkillIds: readonly number[] }, skill: number): boolean {
  return career.removedMinusSkillIds.includes(skill)
}
