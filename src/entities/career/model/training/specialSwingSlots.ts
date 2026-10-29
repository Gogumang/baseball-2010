import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { BALANCE } from '@/shared/config/original/balance'

export const SPECIAL_SWING_REQUIRED_SESSIONS = BALANCE.specialSwing.requiredSessions
export const SPECIAL_SWING_GAME_POINT_COST = BALANCE.specialSwing.gamePointCost

/** 이번 레벨 필살타법 훈련 한 번의 G포인트 (최고 레벨이면 0) */
export function specialSwingCostOf(career: PlayerCareer): number {
  return SPECIAL_SWING_GAME_POINT_COST[career.specialSwingLevel] ?? 0
}
/** 칸 i 를 배우는 데 드는 G포인트 — 표 `0xcc3e6` = [−5,−7,−9,−12] × 100 (R7 4절) */
export function specialSwingSlotCostOf(slot: number): number {
  return SPECIAL_SWING_GAME_POINT_COST[slot] ?? 0
}
export const SPECIAL_SWING_MAXIMUM_LEVEL = SPECIAL_SWING_REQUIRED_SESSIONS.length

/**
 * 필살타법 창(상태 0x6c) 칸 i 의 **필요 인기도** — 표 `0xcc3ea` = [1,5,10,15] × 100 (R7 4절 확정).
 * 비용 표 `0xcc3e6` = [−5,−7,−9,−12] × 100 은 `BALANCE.specialSwing.gamePointCost` 와 같은 값이다.
 */
export const SPECIAL_SWING_REQUIRED_POPULARITY: readonly number[] = [100, 500, 1000, 1500]

/** 칸 하나가 막히는 까닭 — 차례와 문구 번호가 원본 그대로다 */
export type SpecialSwingSlotBlock = '훈련완료' | '인기도부족' | '선행필요' | 'G포인트부족'

/**
 * 필살타법 창 칸 i 의 훈련 가드 — 키 처리 `0x17828` (0x17858~0x17a42, R7 4절 **확정**).
 *
 * ```
 * L = 배운 수(저장 +0x201)
 * if L > i:                          StrMODE[63] "이미 훈련 완료된 스킬입니다"      ; 0x1787a
 * elif 인기도 < 0xcc3ea[i] × 100:    StrMODE[62] "인기도가 부족합니다 …"            ; 0x1789a
 * elif L < i:                        StrMODE[64] "선행 스킬 훈련 완료 후 …"          ; 0x178de
 * elif 비용 > G:                     StrMODE[65] "G포인트가 부족합니다 …"            ; 예/아니오
 * else:                              StrMODE[66] "%d G포인트가 소모됩니다 …"         ; 예 → 0xa3bac
 * ```
 * 훈련할 수 있는 칸은 **i == L 한 칸뿐**이라, L = 4 면 네 칸이 모두 [63] 으로 막힌다.
 */
export function specialSwingSlotBlockOf(
  career: Pick<PlayerCareer, 'specialSwingLevel' | 'popularity' | 'gamePoint'>,
  slot: number,
): SpecialSwingSlotBlock | null {
  const learned = career.specialSwingLevel
  if (learned > slot) return '훈련완료'
  if (career.popularity < (SPECIAL_SWING_REQUIRED_POPULARITY[slot] ?? 0)) return '인기도부족'
  if (learned < slot) return '선행필요'
  if ((SPECIAL_SWING_GAME_POINT_COST[slot] ?? 0) > career.gamePoint) return 'G포인트부족'
  return null
}
