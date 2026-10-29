import {
  JUDGE_TEXT_ANIMATIONS,
  judgeAnimationEntryAt,
  judgeTextAnimationOf,
} from '@/features/defense-play/model/laserPresentation/judgeTextAnimations'

/** 결과 판의 칸들 (장면 +0x108c · +0x10ac · +0x1088 · +0x1997 · +0x1998 · +0x1999, game_judge 애니 2 의 그린 수) */
export interface JudgePopupState {
  readonly timer: number
  readonly code: number
  readonly holderSlot: number
  /** +0x1997 */
  readonly shown: boolean
  /** +0x1998 */
  readonly bigOutArmed: boolean
  /** +0x1999 */
  readonly bigOutRecord: boolean
  /** 애니 2 를 그린 수(되감은 뒤) */
  readonly bigOutDraws: number
  /** 보통 판정 글자 — 코드 v 의 애니(표 0xcfe90)를 메시지 0x39578 이 되감은 뒤 0x393b4 가 넘긴 수 */
  readonly textAdvances: number
}

/** 판이 열릴 때 — 투구(0x3de10)가 +0x1997 = 1, 0x10 진입이 애니를 되감았다 */
export const JUDGE_POPUP_START: JudgePopupState = {
  timer: 0,
  code: 0,
  holderSlot: -1,
  shown: true,
  bigOutArmed: false,
  bigOutRecord: false,
  bigOutDraws: 0,
  textAdvances: 0,
}

/**
 * 51a56 — 메시지 0xbba(v): +0x108c = 10 · +0x10ac = v · +0x1088 = 플레이+0x130, 그리고 51a8c 0x39578(장면, v) 가 그 코드의 애니를
 * 되감는다(0x93d31(애니, 1) — 칸 0 · 비트 지움 → 0x93cfd(애니, 0) — 돌리기). 큰 OUT 애니 2 는 이 표에 없어 안 되감는다.
 */
export function postJudgeMessage(state: JudgePopupState, code: number, holderSlot: number): JudgePopupState {
  return { ...state, timer: 10, code, holderSlot, textAdvances: 0 }
}

/** 이 그림의 보통 판정 글자 — game_judge 프레임 · 0x93c45 의 dx · dy · 자리를 정하는 야수 칸(−1 이면 화면 가운데) */
export interface JudgeTextFrame {
  readonly frame: number
  readonly dx: number
  readonly dy: number
  readonly holderSlot: number
}

/** 이 그림의 큰 OUT — game_judge 애니 2 의 프레임과 자리를 고를 공 가진 야수 칸(−1 이면 화면 가운데) */
export interface BigOutFrame {
  readonly frame: number
  readonly holderSlot: number
}

/** game_judge 애니 2 (animations.json [2]) */
export const BIG_OUT_ANIMATION: readonly { readonly frame: number; readonly delay: number }[] = [
  { frame: 35, delay: 2 },
  { frame: 36, delay: 2 },
  { frame: 37, delay: 2 },
  { frame: 38, delay: 2 },
  { frame: 37, delay: 2 },
  { frame: 40, delay: 2 },
  { frame: 39, delay: 0 },
]
const BIG_OUT_DRAWS = BIG_OUT_ANIMATION.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)

function bigOutFrameAt(draws: number): number {
  let remaining = draws
  for (const entry of BIG_OUT_ANIMATION) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return BIG_OUT_ANIMATION[BIG_OUT_ANIMATION.length - 1].frame
}

/**
 * 0x46844 그림 한 번. `recordsLaserOut` 은 state[0x8b] = 1 을 적은 그림인가.
 *
 * 보통 갈래의 글자 0x393b4(장면, x, y − 30, v, **1**, 0) (2026-10-08 직접 뜸):
 * ```
 * 393c6  v − 1 > 12 → 끝 ; 표 0xcfe90[v − 1] 로 애니 r5 (6 · 8 · 12 는 곧장 끝 0x394d6 — 아무것도 안 그림)
 * 393f6  다섯째 인자 ≠ 0 → 0xbe8a5(장면+0x234 그리기 목록, x, y, 깊이 [0xcfa8c+0x14] + 0x32 = 29755, 그림 +0x101c, 애니 r5, …)
 *        — 목록에 넣기만 하고, 곧바로 0x93d91(애니) 로 **한 칸 넘긴다**(r5 == 8 갈래도 같은 애니를 집는다)
 * 46938  0x46844 꼬리: 목록이 차 있으면 0xbe6a1 로 그 자리에서 그린다(앞서 46dd0 이 선수들을 이미 비워 혼자 남는다)
 *        — 그리기 0xbe73a(종류 2) → 0x93c45: 애니의 **지금 칸**을 (x + dx, y + dy) 에
 * ```
 * 곧 **넘긴 뒤 그린다** — 되감은(메시지) 뒤 첫 그림이 이미 한 번 넘긴 칸이다(타석 화면 0x39504 의 0xba759 는 그린 뒤 넘긴다).
 * 넷째 인자 0 갈래(타석 화면)의 삼진 양끝 파티클은 이 갈래에 없다.
 */
export function stepJudgePopup(state: JudgePopupState): JudgePopupStep {
  if (state.timer <= 0) return { next: state, bigOut: null, text: null, recordsLaserOut: false }
  const timer = state.timer - 1
  if (state.shown || state.code !== 13) return stepJudgeText(state, timer)
  if (!state.bigOutArmed) return { next: { ...state, timer }, bigOut: null, text: null, recordsLaserOut: false }
  return stepBigOut(state, timer)
}

/** `stepJudgePopup` 한 그림의 결과 */
export interface JudgePopupStep {
  readonly next: JudgePopupState
  readonly bigOut: BigOutFrame | null
  readonly text: JudgeTextFrame | null
  readonly recordsLaserOut: boolean
}

/** 46892 — +0x1998 이면 game_judge 애니 2 를 (x, y − 60) 에. 끝 비트면 +0x1998 = 0 · +0x1997 = 1 · +0x108c = 0. +0x1999 면 state[0x8b] = 1 */
function stepBigOut(state: JudgePopupState, timer: number): JudgePopupStep {
  const bigOut = { frame: bigOutFrameAt(state.bigOutDraws), holderSlot: state.holderSlot }
  const draws = state.bigOutDraws + 1
  if (draws < BIG_OUT_DRAWS) {
    return { next: { ...state, timer, bigOutDraws: draws, bigOutRecord: false }, bigOut, text: null, recordsLaserOut: state.bigOutRecord }
  }
  const next = { ...state, timer: 0, bigOutDraws: draws, bigOutArmed: false, shown: true, bigOutRecord: false }
  return { next, bigOut, text: null, recordsLaserOut: state.bigOutRecord }
}

/** 그 밖: +0x1999 = +0x1998 = 0 · +0x1997 = 1 · 보통 판정 글자 0x393b4(x, y − 30, v, 1, 0) — 넘긴 뒤 그린다 */
function stepJudgeText(state: JudgePopupState, timer: number): JudgePopupStep {
  const animation = judgeTextAnimationOf(state.code)
  const entries = animation === null ? undefined : JUDGE_TEXT_ANIMATIONS[animation]
  const next = { ...state, timer, bigOutArmed: false, bigOutRecord: false, shown: true, textAdvances: state.textAdvances }
  if (entries === undefined) return { next, bigOut: null, text: null, recordsLaserOut: false }
  const textAdvances = state.textAdvances + 1
  const entry = judgeAnimationEntryAt(entries, textAdvances)
  const text = { frame: entry.frame, dx: entry.dx ?? 0, dy: entry.dy ?? 0, holderSlot: state.holderSlot }
  return { next: { ...next, textAdvances }, bigOut: null, text, recordsLaserOut: false }
}
