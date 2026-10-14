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

/**
 * **실투 "!"** — 투수 그리기 0x38d1c 의 38ee0~38f3e (2026-10-14 직접 떴다). 체력 그림과 같은 함수, 모드 7 거름(38ed6) 뒤 · 체력 거름(38f42) 앞:
 * ```
 * 38ee0  c = 투구 객체 [+0xf98] 바이트 +8
 * 38eec  c ≠ 0 이면 +8 = c − 1 하고 player_effect(+0x1030) 애니 13 을 (투수 x, 투수 y − 0x34) 에 효과 0 · 깊이 [0xcfa8c+8] 로,
 *        그린 뒤 0x93d91([애니표 +0x34]) 로 한 칸
 * ```
 * +8 을 쓰는 곳은 놓기 0x4dc78 둘뿐이다(Q1 노트 · `strb #8` 전수): 4de9c 에서 0 으로 지우고, 실투 판정 0x33cbc 가 참이면 4deae 에서 4.
 * 곧 **실투 공이 손을 떠난 틱부터 네 번** 머리 위에 "!" 가 뜬다. 상태 0x16 · 던지는 동작 · 마투수 거름(38f42~38f62)은 이 뒤라 안 받는다
 * — 마투수도 실투면 뜬다. 효과 0 이라 좌투도 안 뒤집고 x 는 좌투 + 1 (0x38db8) 자리 그대로다.
 * 애니 13 은 프레임 50 네 칸(지연 0, dy 0 · +2 · −1 · −2)이고 0xf 진입 0x3d954 가 player_effect 애니를 모두 되감으며 돌림 비트
 * 0x1a610(비트 4 · 9 · 10 · 13 · 15 · 16 — 즉치 마스크)으로 13 을 돌림으로 켠다. k 번째 그림은 k 칸 나아간 칸이다(체력 그림과 같은 셈).
 * 홈런 갈래의 "!"(39136 — 0x357e0 · 투수 단계 13 · +0x199a)는 웹이 투수 단계 13 을 몰라 옮기지 않았다(⚠️ 미이식).
 * ⚠️ 근사: +8 은 그림마다 1 줄지만 웹은 놓은 틱(0x11 틱 10)부터 장면 틱으로 센다.
 */
export const MISTAKE_MARK_ANIMATION = 13
/** 4deae — 실투면 +8 = 4 */
export const MISTAKE_MARK_DRAWS = 4
/** 38f22 `subs r2, #0x34` — 투수 y 위 52 */
export const MISTAKE_MARK_OFFSET_Y = -0x34

/** 놓은 틱부터 k 번째(1 부터) 그림이면 "!" 를 그리는가 (38ed6 모드 7 거름 · 38eec +8 ≠ 0) */
export function showsPitcherMistakeMark(gameMode: number | undefined, drawCall: number | null): boolean {
  if (gameMode === HOME_RUN_DERBY_MODE || drawCall === null) return false
  return drawCall >= 1 && drawCall <= MISTAKE_MARK_DRAWS
}
