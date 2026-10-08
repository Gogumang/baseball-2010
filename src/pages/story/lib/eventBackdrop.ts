import type { EventCommand } from '@/shared/config/original/eventTypes'
import { screenEffectCommandOf } from '@/entities/story/model/screenEffect'
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
  const endingFrame = effectorEndingFrameOf(kind)
  if (frame < 0 || frame > endingFrame + 1) return '없음'
  if (frame === 0) return '시작'
  return frame === endingFrame + 1 ? '끝' : '도는중'
}

/** 효과기 진행이 끝(+0x10 = 2)을 세우는 프레임 — 흔들기 6(0xbd9bc) · 밝아짐 · 어두워짐 8(0xbd918 · 0xbd908) */
export function effectorEndingFrameOf(kind: ScreenEffectKind): number {
  return kind === '흔들기' ? 6 : 8
}

/**
 * **명령 5 의 기다림 0x8b564** (실행기 꼬리 0x8d90a 표 0xd4efc[3] = 0x8d9a6, 직접 떴다):
 * ```
 * 8b56e  id = [mgr+0x2c4]; id > 10 이면 기다린다(끝나지 않음)
 * 8b578  (1 << id) & 0x402 (1 · 10) · & 0x30c (2 · 3 · 8 · 9) → [mgr+8] = 1 (곧바로 다음 명령)
 * 8b586  (1 << id) & 0xf0 (4 · 5 · 6 · 7) → 효과기 [0x140007c] 가 돌고(+4 ≠ 0) +0x10 == 2(끝)일 때만 [mgr+8] = 1
 * ```
 * [mgr+8] 은 다음 0x8cf64 머리(0x8cf7e)에서 다음 명령으로 넘긴다. 갱신(0x8cf64)이 그리기(0x8b5ac)보다 먼저라
 * 끝을 본 틀에 대화창은 '끝' 그리기(id 6 · 7 이면 상자 · 글 · 초상화 처음으로)를 마치고, **그다음 틀에** 다음 명령이 돈다 —
 * 곧 id 6 · 7 의 처음으로 돌리기는 늘 뒤 명령(대사 · system 창 · 경기)보다 먼저다. 그동안 키 0x8b804 는 지금 명령이
 * say · 선택지가 아니라 아무 일도 안 한다.
 * ⚠️ id 0 · 11 이상은 원본에서 영영 기다리지만(0x8b56e · 0x8b58a) 원본 데이터에 없어 곧바로 넘긴다.
 */
export function isBlockingEffectId(id: number): boolean {
  return id >= 4 && id <= 7
}

/** 한 걸음에 지나온 명령 5 하나 — `start` 는 그 걸음을 시작한 뒤 몇 번째 틀에 걸리는가 */
export interface EffectTimelineEntry {
  readonly id: number
  /** 효과기에 거는 종류 — null 이면 효과기를 안 건드린다(id 1 진동 · 1~7 밖) */
  readonly kind: ScreenEffectKind | null
  readonly color: '검정' | '흰색'
  readonly vibrationMilliseconds: number
  readonly start: number
  /** 지나온 명령 가운데 몇 번째인가 — 바로 뒤 명령(0x8d9c2 가 보는 [mgr+0x14 + 4(i + 1)])을 찾는다 */
  readonly commandIndex: number
}

export interface EffectTimeline {
  readonly entries: readonly EffectTimelineEntry[]
  /** 멈출 명령(대사 · 창 · 경기 · 끝)이 도는 틀 — 0 이면 곧바로 */
  readonly releaseFrame: number
}

/**
 * 지나온 명령들의 차례 — **명령 하나가 적어도 한 틀**이다. 실행기 0x8cf64 는 틀마다 [mgr+8] 이 서 있으면 다음 명령으로 넘겨
 * 그 틀에 돌리고(0x8d1be · 0x8d1e2), 같은 틀에 기다림 표 0xd4efc 를 본다 — 소리(0x8dac2) · 막지 않는 효과(0x8b564) ·
 * 창 없는 system(0x8d91c) · 하위 ≠ 0 예아니오(0x8d954)는 그 자리에서 [mgr+8] = 1 을 세우므로 다음 명령은 **다음 틀**에 돈다.
 * 4~7 은 효과가 끝날 때까지 다음 명령을 막는다(`isBlockingEffectId`) — 프레임 `start + 끝 세움 + 1` 이 '끝' 그리기,
 * 그다음 틀에 다음 명령이 돈다. 그동안 앞 say 상자 · 초상화는 그대로다(`isStepHeld`).
 * ⚠️ 보상(명령 7)은 원본에서 보상 알림 창(0x8beb8 글 → 0xbbef8 → 0x74ef4 종류 1 · 첫 종류 4 는 0x741a0)을 띄우고 확인까지 기다린다
 * (0x8daa0). 웹은 그 창을 아직 안 옮겨 한 틀로 둔다.
 */
/** 지나온 명령 가운데 소리(명령 6)가 도는 틀 — `effectTimelineOf` 와 같은 셈(명령 하나에 한 틀, 막는 효과는 끝까지) */
export function soundTimelineOf(commands: readonly EventCommand[]): readonly { readonly id: number; readonly start: number }[] {
  const sounds: { id: number; start: number }[] = []
  let frame = 0
  for (const command of commands) {
    if (command.op === 'sound') sounds.push({ id: command.id, start: frame })
    frame += commandFramesOf(command)
  }
  return sounds
}

/** 명령 하나가 차지하는 틀 — 막는 효과(4~7)는 효과기 '끝' 다음 틀까지, 그 밖은 한 틀 */
function commandFramesOf(command: EventCommand): number {
  if (command.op !== 'effect') return 1
  const effect = screenEffectCommandOf(command.id)
  return effect?.kind != null && isBlockingEffectId(command.id) ? effectorEndingFrameOf(effect.kind) + 2 : 1
}

export function effectTimelineOf(commands: readonly EventCommand[]): EffectTimeline {
  const entries: EffectTimelineEntry[] = []
  let frame = 0
  commands.forEach((command, commandIndex) => {
    if (command.op !== 'effect') {
      frame += 1
      return
    }
    const effect = screenEffectCommandOf(command.id)
    entries.push({
      id: command.id,
      kind: effect?.kind ?? null,
      color: effect?.color ?? '검정',
      vibrationMilliseconds: effect?.vibrationMilliseconds ?? 0,
      start: frame,
      commandIndex,
    })
    frame += commandFramesOf(command)
  })
  return { entries, releaseFrame: frame }
}

/** 지나온 명령 가운데 마지막 명령 5 의 id — 없으면 null (0x8d456 이 [mgr+0x2c4] 에 넣는다) */
export function lastEffectIdIn(commands: readonly EventCommand[]): number | null {
  let id: number | null = null
  for (const command of commands) if (command.op === 'effect') id = command.id
  return id
}

/**
 * **0x8d9a6~0x8da0a** — 명령 5 의 기다림이 [mgr+8] 을 세운 틀(막는 효과면 효과기 '끝'을 본 갱신)에 [mgr+0x2c4] == 6 이고
 * 바로 뒤 명령([mgr+0x14 + 4(i + 1)] 의 종류)이 8(경기)이면 대사 상자를 비운다:
 * ```
 * 0x8d9e2  0x7b870(창)        ; 초상화 셋 비우기
 * 0x8d9ea  0x7f7cc(창)        ; 높이 0
 * 0x8d9f0  0x7b824(창, 0 · 1 · 2) ; 글 칸 셋 길이 0
 * ```
 * 갱신이 그리기보다 먼저라 같은 틀의 '끝' 그리기 0x7fbc4 는 칸 0 이 비어 상자도 초상화도 안 그린다(0x7fbe0) — 다음 틀에 경기로 나간다.
 * 경기 명령 자신(0x8d8c4~0x8d8f0)도 같은 셋을 다시 부른다.
 */
export function clearsDialogueBeforeMatch(effectId: number, nextCommand: EventCommand | null | undefined): boolean {
  return effectId === 6 && nextCommand?.op === 'match'
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
