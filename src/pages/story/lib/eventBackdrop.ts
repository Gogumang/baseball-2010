import type { EventCommand } from '@/shared/config/original/eventTypes'
import type { ScreenEffectKind } from '@/entities/story/model/screenEffect'
import { SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'

/**
 * **이벤트 대화창 0x8b5ac 의 효과 칠 · 초상화 바닥 y** (직접 떴다).
 *
 * ```
 * 8b5d0  [gfx+0x174] − 0x70 ≤ 1 (외출 지도 112 · 장소 113) → 지도 0x7ea64(gfx, −1, 0)
 *        그 밖 → 공 무늬 0x5fd60 · 상태판 0x7d34c(gfx, [이벤트+0xb]) · 머리띠 0x7f4ec
 * 8b62e  효과 칠 r6 = 0. 효과기 e = [0x140007c] — +4 종류(0 = 없음) · +0x10 단계(0 건 직후 · 1 도는 중 · 2 끝, 0xbd844)
 *        e 가 돌고(+4 ≠ 0) +0x10 == 1 → 8b6f0: [mgr+0x2c4] ∈ {2, 3} 이고 [mgr+0x2c8] ≥ 0 이면 0x6a734([0x1400070], [mgr+0x2c8]) ·
 *                                              r6 = 1 — 그 밖은 칠하지 않고 r6 = 0 (→ 8b714)
 *        e 가 돌고 +0x10 == 2 → [mgr+0x2c4] 4 · 5 → [mgr+0x2c8] = −1 · 6 → 색(0, 0, 0) · 7 → 색(255, 255, 255)
 * 8b69a  [mgr+0x2c8] ≥ 0 → 0x6a734(…, [mgr+0x2c8]) · r6 = 1
 * 8b6b2  e 가 돌고 +0x10 == 2 이고 [mgr+0x2c4] ∈ {6, 7} → 0x7f7d4(글 찍기 처음부터) · 0x7f7a8(→ 0x7b870 초상화 셋 비우기) ·
 *        0x7f7cc(상자 높이 0 — 다시 올라온다) · r6 = 1
 * 8b726  0x7fbc4(gfx, [mgr+0xb9], r6, 1)
 * ```
 * - [mgr+0x2c4] 는 명령 5 의 id 를 그대로 둔다(0x8d456 — 1~7 밖이어도). [mgr+0x2c8] 은 관리자 비우기 0x8a380 이
 *   (0x2c4 = 0xb · 0x2c8 = −1) 로 둔다 — 이벤트 끝(0x8d8f6)마다 부르므로 재생은 늘 칠 없음으로 시작한다.
 * - 0x6a734(ctx, 색) 은 화면 전체 칠하기다(색 0 은 프레임 버퍼를 0 으로 메운다 — 0x6a73e). 밑그림 **뒤에** 그리므로 밑그림을 덮는다.
 * - r6(효과 칠)은 0x7fbc4 에서 **초상화 바닥 y 하나에만** 쓰인다 — 상자 0x7fad0 에 둘째 인자로 가지만 읽지 않는다(0x7fad0 은
 *   셋째 인자(장식)만 [sp+8] 에 둔다).
 *
 * 초상화 바닥 y — 0x7fbc4 끝 0x7fdee~0x7fe4c → 0x7f998(창, y) (클립 (0, 0, W, y + 1) 뒤 발밑을 y 에):
 * ```
 * 7fdee  [gfx+0x174] == 0x70 · 0x71 또는 효과 칠 ≠ 0 → y = H − 0x44 = 252
 * 7fe1a  그 밖 → mode_ui([gfx+0x138]) 프레임 10 박스 0 (0, 65, 240, 72) 의 y + h − 2 = 135
 * ```
 */

/** 7fe14 — 외출 지도 · 효과 칠 `H − 0x44` */
export const OUTING_MAP_PORTRAIT_BASE_Y = SCREEN_HEIGHT - 0x44
/** 7fe3e — mode_ui 프레임 10 박스 0 (0, 65, 240, 72) 의 y + h − 2 */
export const MANAGEMENT_PORTRAIT_BASE_Y = 65 + 72 - 2

/** 초상화 바닥 y (0x7fdee). `isOverOutingMap` = [gfx+0x174] 이 0x70 · 0x71 */
export function portraitBaseYOf(isOverOutingMap: boolean, isEffectFill: boolean): number {
  return isOverOutingMap || isEffectFill ? OUTING_MAP_PORTRAIT_BASE_Y : MANAGEMENT_PORTRAIT_BASE_Y
}

/** [mgr+0x2c8] — 화면 칠 색. null 은 −1(칠 없음) */
export type EventBackdropFill = '검정' | '흰색' | null

export interface EventBackdropState {
  /** [mgr+0x2c4] — 마지막 명령 5 의 id */
  readonly effectId: number
  /** [mgr+0x2c8] */
  readonly fill: EventBackdropFill
}

/** 관리자 비우기 0x8a380 — 0x8a3dc `[+0x2c4] = 0xb` · 0x8a3e0 `[+0x2c8] = −1` */
export const INITIAL_EVENT_BACKDROP: EventBackdropState = { effectId: 0xb, fill: null }

/**
 * 그리기 때 본 효과기 단계 — '없음' 은 +4 == 0, '시작' 은 +0x10 == 0(건 직후 첫 그리기), '도는중' 1, '끝' 2(비우기 전 한 번).
 */
export type EffectorPhase = '없음' | '시작' | '도는중' | '끝'

/**
 * 효과기를 건 뒤 `frame` 번째 그리기(0 부터)가 보는 단계. 효과기 진행 0xbd844 는 그리기 뒤에 돈다 —
 * 0 번째 그리기는 건 직후(+0x10 = 0), 진행이 끝(+0x10 = 2)을 세운 다음 그리기가 '끝', 그다음 진행이 비운다(0xbd85e).
 * 끝을 세우는 진행: 밝아짐 · 어두워짐은 9 번째 칠(단계 0 · 16, 프레임 8 — 0xbd918 · 0xbd908),
 * 흔들기는 단계 6 > 5 (프레임 6 — 0xbd9bc).
 */
export function effectorPhaseAt(kind: ScreenEffectKind, frame: number): EffectorPhase {
  const endingFrame = kind === '흔들기' ? 6 : 8
  if (frame < 0 || frame > endingFrame + 1) return '없음'
  if (frame === 0) return '시작'
  return frame === endingFrame + 1 ? '끝' : '도는중'
}

/** 지나온 명령 가운데 마지막 명령 5 의 id — 없으면 null (0x8d456 이 [mgr+0x2c4] 에 넣는다) */
export function lastEffectIdIn(commands: readonly EventCommand[]): number | null {
  let id: number | null = null
  for (const command of commands) if (command.op === 'effect') id = command.id
  return id
}

export interface EventBackdropDraw {
  /** 그린 뒤의 [mgr+0x2c4] · [mgr+0x2c8] */
  readonly state: EventBackdropState
  /** 이 그리기에서 밑그림 위에 칠하는 화면 전체 색 (0x6a734). null 이면 안 칠한다 */
  readonly fill: EventBackdropFill
  /** 0x7fbc4 셋째 인자 — 초상화 바닥 y 를 H − 0x44 로 */
  readonly isEffectFill: boolean
  /** 0x8b6d0~0x8b6ea — 글 찍기 · 초상화 · 상자 높이를 처음으로 (id 6 · 7 이 끝난 그리기) */
  readonly resetsDialogue: boolean
}

/** 0x8b5ac 의 0x8b62e~0x8b714 — 한 번 그릴 때의 효과 칠 */
export function drawEventBackdrop(state: EventBackdropState, phase: EffectorPhase): EventBackdropDraw {
  const { effectId } = state
  if (phase === '도는중') {
    // 8b6f0 — 흔들기(2 · 3)만 앞서 칠한 색을 다시 칠한다. 어두워짐 · 밝아짐이 도는 동안은 칠하지 않는다
    const isEffectFill = (effectId === 2 || effectId === 3) && state.fill !== null
    return { state, fill: isEffectFill ? state.fill : null, isEffectFill, resetsDialogue: false }
  }
  let fill = state.fill
  if (phase === '끝') {
    if (effectId === 4 || effectId === 5) fill = null
    else if (effectId === 6) fill = '검정'
    else if (effectId === 7) fill = '흰색'
  }
  const resetsDialogue = phase === '끝' && (effectId === 6 || effectId === 7)
  return { state: { effectId, fill }, fill, isEffectFill: fill !== null || resetsDialogue, resetsDialogue }
}
