import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { BALANCE } from '@/shared/config/original/balance'

/** 마구 레벨 훈련 — 필살타법 창(0x17828)이 투수 탭에도 같은 표를 쓴다 (H-4 · R7 4절) */
export const MAGIC_REQUIRED_SESSIONS: readonly number[] = BALANCE.specialSwing.requiredSessions
const MAGIC_GAME_POINT_COST: readonly number[] = BALANCE.specialSwing.gamePointCost
/** 레벨마다 필요한 인기도 — 표 0xcc3ea = [1,5,10,15] × 100 (R7 4절) */
export const MAGIC_REQUIRED_POPULARITY: readonly number[] = [100, 500, 1000, 1500]
export const MAGIC_MAXIMUM_LEVEL = MAGIC_REQUIRED_SESSIONS.length

/** 108 마구 창(탭 1)의 칸 하나를 확인했을 때 막는 까닭 — StrMODE[63] · [62] · [64] · [65] */
export type MagicTrainingCellBlock = '훈련완료' | '인기도부족' | '선행필요' | 'G포인트부족'

/** 마구 칸 수 — 그리기 0x807ba 의 `cmp r7,#3` 루프 · 표 넷 (R7 4절) */
export const MAGIC_TRAINING_CELL_COUNT = 4

/**
 * **108 창 진입 0x17730 의 처음 커서** — 탭이 2(구질)가 아니면 `min(s8 [저장+0x201], 3)` 칸(177c8~17806). 배운 수 L 칸이다.
 * G 충전(139)에서 돌아와도 108 이 다시 들어서 같은 칸이 된다.
 */
export function magicTrainingCursorOf(career: Pick<PitcherCareer, 'magicLevel'>): number {
  return Math.min(career.magicLevel, MAGIC_TRAINING_CELL_COUNT - 1)
}

/**
 * **108 창 확인 키 0x17828** — 탭 `[gfx+0x188]` 이 0(타자 필살타법) · 1(투수 마구)이면 같은 갈래(17858~17a42)를 탄다:
 * ```
 * L = s8 [저장+0x201]            i = 격자 커서
 * L > i                          → StrMODE[63] (팝업 1,1)
 * 인기도 0xb6e79 < 0xcc3ea[i]×100 → StrMODE[62] (%d = 그 값)
 * L < i                          → StrMODE[64]
 * |0xcc3e6[i]|×100 > G(전역 +0x64) → StrMODE[65] (팝업 2,2 — 예 → 139)
 * 그 밖                          → StrMODE[66] (팝업 2,3 — 예 → 125)
 * ```
 */
export function magicTrainingCellBlockOf(
  career: Pick<PitcherCareer, 'magicLevel' | 'popularity' | 'gamePoint'>,
  cell: number,
): MagicTrainingCellBlock | null {
  const learned = career.magicLevel
  if (learned > cell) return '훈련완료'
  if (career.popularity < (MAGIC_REQUIRED_POPULARITY[cell] ?? 0)) return '인기도부족'
  if (learned < cell) return '선행필요'
  if (magicTrainingCellCostOf(cell) > career.gamePoint) return 'G포인트부족'
  return null
}

/** 칸 i 의 G — `|0xcc3e6[i]| × 100` (500 · 700 · 900 · 1200) */
export function magicTrainingCellCostOf(cell: number): number {
  return MAGIC_GAME_POINT_COST[cell] ?? 0
}
