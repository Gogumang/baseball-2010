import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { loopingAnimationStepAt } from '@/widgets/batting-stage/lib/baseRunners'

/**
 * **마운드 투수 체력 그림** — 투수 그리기 0x38d1c 의 0x38f42~0x39086 (2026-10-14 직접 떴다).
 *
 * 체력 4단계 0x3493c(`min(trunc(체력%/25), 3)`)는 **부르는 곳이 없다**(BL · 리터럴 · 함수 포인터 전수 — 죽은 코드). 타석 공용 HUD
 * 0x4c4bc 도 체력(0xaebb1)을 읽지 않는다. 장면에서 체력을 그리는 곳은 투수 그리기 0x38d1c 하나다:
 * ```
 * 38ed6  모드 [+0x1104] == 7(홈런더비) → 건너뜀
 * 38f42  상태 [+0x1c] ≠ 0x16 ∧ 투구 객체 [+0xf98]+0x14 == 0(던지는 동작 아님) ∧ 투수가 마선수(0xb633d) 아님
 * 38f68  s = 0xaebb1(수비 팀) — 마운드 투수 체력 %
 *        s ≤ 19      → player_effect(+0x1030) 애니 10 을 (투수 x, 투수 y) 에, 좌투(0xb63c1)면 효과 0x11 · 깊이 [0xcfa8c+8](24500)
 *        20 ≤ s ≤ 34 → 애니 9 를 같은 식으로
 *        그린 뒤 0x93d91 로 한 칸
 * ```
 * 투수 점 (x, y) 는 0x38e6c 가 투수 그림에 쓰는 자리(좌투면 x + 1)다. 애니 9 · 10 은 0xf 진입 0x3d954 가 되감고 돌림을 켠다
 * (돌림 비트표 0x1a610 의 비트 9 · 10). 그리기 목록은 그 뒤 비울 때 그려 k 번째 그림이 k 칸 나아간 칸이다.
 * ⚠️ 근사: 되감기 · 그린 수는 웹 장면 단계 틱으로 센다 · 던지는 동작(+0x14)은 웹 `pitcherTick` 이 있는 동안으로 본다.
 */
export const PLAYER_EFFECT_FRAMES = './sprites/player_effect/frames'
const EXHAUSTED_ANIMATION = 10
const TIRED_ANIMATION = 9
const EXHAUSTED_MAX = 19
const TIRED_MAX = 34
const HOME_RUN_DERBY_MODE = 7

/** 이 체력이면 그릴 player_effect 애니 — 없으면 null */
export function pitcherFatigueAnimationOf(staminaPercent: number): number | null {
  if (staminaPercent <= EXHAUSTED_MAX) return EXHAUSTED_ANIMATION
  if (staminaPercent <= TIRED_MAX) return TIRED_ANIMATION
  return null
}

/** 체력 그림을 그리는 장면인가 (38ed6 · 38f42) */
export function showsPitcherFatigue(input: {
  readonly gameMode: number | undefined
  readonly isAcePitcher: boolean
  readonly isThrowing: boolean
}): boolean {
  return input.gameMode !== HOME_RUN_DERBY_MODE && !input.isAcePitcher && !input.isThrowing
}

/** k 번째 그림(1 부터)의 칸 — 돌림 애니라 끝 없이 돈다 */
export function pitcherFatigueFrameAt(entries: readonly StageAnimationEntry[], drawCall: number): { frame: number; dx: number; dy: number } | null {
  return loopingAnimationStepAt(entries, Math.max(0, drawCall))
}
