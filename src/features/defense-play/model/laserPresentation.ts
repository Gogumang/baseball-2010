import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/**
 * **레이저 송구 연출의 그림 둘** — 연출 0x4403c 단계 1 의 줌 펀치(0xbb39d → 0xbb84c → 0xbb43c)와, 단계 3 이 세운 +0x1998 을 결과 판
 * 0x46844 가 보고 그리는 **큰 OUT**(game_judge 애니 2) (2026-10-08 직접 뜸).
 *
 * ## 줌 펀치 — 전역 0x15606d8
 * ```
 * 44146  단계 1: 0xbb39d(100, H.x, H.z − H.y, 1, 0)          ; H = 0xb0c91(플레이) 공 가진 야수의 +0x20(x, y, z)
 * bb39c  [0] = 1 · [1] = 1(커지는 중) · [4] = 100 · [8] = +5 · [0x14] = x·620/40000 · [0x18] = (z − y)/65   ; 바탕 그림 좌표
 * 46e24  그리기마다(0x46c88, 0x4403c 뒤): 0xbb84c([+0xfec], [+0xff0], −1, −1)   ; 화면 오프셋 · 중심은 [0x14] · [0x18]
 * bb84c  [0] 이면: 커지는 중 → 0xbb3f4 로 다시 적고 [4] += [8], [4] > 109 면 [4] = 110 · [1] = 0 ; [0xc] = **110**
 *               줄어드는 중 → [4] += [8](−5), [4] ≤ 100 이면 [4] = 100 · [0] = 0 ; [0xc] = [4]
 *        0xbb43c(오프셋 x, y, [0xc], [0x14], [0x18])
 * bb43c  srcW = W·100/s · srcH = H·100/s ; srcX = cx + 오프셋x − srcW/2 (0 ~ W − srcW 로 자름) · srcY 도 같다 ;
 *        그 사각형을 화면 전체로 늘려 덮는다
 * ```
 * 곧 그린 그림은 110 · 110 · 105 · 100% 네 그림이다(늘리는 단계의 [0xc] 가 늘 110 이라 105 를 건너뛴다).
 * 0xbb84c 는 결과 판(46de4) · 0x4403c 뒤라 그 둘까지 늘리고, 뒤에 그리는 HOMERUN 글자(46e5c) · 득점판(46e62)은 안 늘린다.
 *
 * ## 큰 OUT — 결과 판 0x46844 (그리기 46de4, 0x4403c 보다 앞)
 * ```
 * 51a56  메시지 0xbba(v) 처리: +0x108c = 10 · +0x10ac = v · +0x1088 = 플레이+0x130 (공 가진 야수)
 * 46850  +0x108c ≤ 0 이면 아무것도 안 함 ; +0x1088 == −1 이면 자리 = (W/2, H/2), 아니면 그 야수 그림 자리(0x43278 이 적은 +0x1984 · +0x1988)
 * 4688e  +0x108c −= 1
 * 46892  +0x1997 == 0 && v == 13:
 *          +0x1998 이면 game_judge 애니 2 를 (x, y − 60) 에 (0xba759 종류 2 · 진행 1) ; 끝 비트면 +0x1998 = 0 · +0x1997 = 1 · +0x108c = 0
 *                       +0x1999 면 state[0x8b] = 1 ; +0x1999 = 0
 *          아니면 아무것도 안 그린다
 *        그 밖: +0x1999 = +0x1998 = 0 · +0x1997 = 1 · 보통 판정 글자 0x393b4(x, y − 30, v, 1, 0)
 * ```
 * +0x1997 은 투구(0x11 진입 0x3de10)가 1 로, 레이저 연출 단계 0 이 0 으로 적는다. 애니 2 는 0x10 진입 0x39894 가 공마다 되감는다.
 * 애니 2 = 프레임 35 · 36 · 37 · 38 · 37 · 40 · 39 (지연 2 · 2 · 2 · 2 · 2 · 2 · 0) — 끝 비트는 13 번째 그림. 판 하나의 타이머는
 * 10 그림이라 한 번에는 끝까지 못 가고(38 → 37 에서 끊긴다), 같은 판에 코드 13 이 또 오면 이어서 그린다.
 */

export interface ZoomPunchState {
  /** [0] */
  readonly active: boolean
  /** [1] — 1 이면 커지는 중 */
  readonly growing: boolean
  /** [4] */
  readonly percent: number
  /** [0x14] · [0x18] — 바탕 그림 좌표 (카메라 오프셋 전) */
  readonly centerX: number
  readonly centerY: number
}

export const NO_ZOOM_PUNCH: ZoomPunchState = { active: false, growing: false, percent: 100, centerX: 0, centerY: 0 }

/** 이 그림에 화면을 늘리는 정도 (`DefenseViewState.zoom`) */
export interface ZoomPunchFrame {
  /** 0xbb43c 의 배율 % ([0xc]) */
  readonly percent: number
  readonly centerX: number
  readonly centerY: number
}

/** 0xbb39d(100, x, z − y, 1, 0) — 바탕 그림 좌표 = x·620/40000 · (z − y)/65 (0 쪽으로 자르는 나눗셈 0xca7b5) */
export function startZoomPunch(holder: WorldPoint): ZoomPunchState {
  return {
    active: true,
    growing: true,
    percent: 100,
    centerX: Math.trunc((holder.x * 620) / 40000),
    centerY: Math.trunc((holder.z - holder.y) / 65),
  }
}

/** 0xbb84c 그림 한 번 — 이 그림의 배율과 다음 상태 */
export function stepZoomPunch(state: ZoomPunchState): { readonly next: ZoomPunchState; readonly frame: ZoomPunchFrame | null } {
  if (!state.active) return { next: state, frame: null }
  if (state.growing) {
    const raised = state.percent + 5
    const next = raised > 109 ? { ...state, percent: 110, growing: false } : { ...state, percent: raised }
    return { next, frame: { percent: 110, centerX: state.centerX, centerY: state.centerY } }
  }
  const lowered = state.percent - 5
  const next = lowered <= 100 ? { ...state, percent: 100, active: false } : { ...state, percent: lowered }
  return { next, frame: { percent: next.percent, centerX: state.centerX, centerY: state.centerY } }
}

/**
 * 0xbb43c 가 늘릴 원본 사각형 — 화면(W × H) 좌표. 이 사각형을 화면 전체로 늘린다.
 * `offset` 은 카메라 화면 오프셋([+0xfec] · [+0xff0]).
 */
export function zoomSourceRect(
  frame: ZoomPunchFrame,
  offset: { readonly x: number; readonly y: number },
  screen: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const width = Math.trunc((screen.width * 100) / frame.percent)
  const height = Math.trunc((screen.height * 100) / frame.percent)
  const clamp = (start: number, size: number, limit: number) => {
    let value = start < 0 ? 0 : start
    if (value + size >= limit) {
      value -= value + size - limit
      if (value < 0) value = 0
    }
    return value
  }
  return {
    x: clamp(frame.centerX + offset.x - (width >> 1), width, screen.width),
    y: clamp(frame.centerY + offset.y - (height >> 1), height, screen.height),
    width,
    height,
  }
}

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
}

/** 51a56 — 메시지 0xbba(v) */
export function postJudgeMessage(state: JudgePopupState, code: number, holderSlot: number): JudgePopupState {
  return { ...state, timer: 10, code, holderSlot }
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
 * 0x46844 그림 한 번. 보통 판정 글자(0x393b4)는 웹 수비 화면이 아직 안 그린다 — 칸 바꾸기만 원본대로 한다.
 * `recordsLaserOut` 은 state[0x8b] = 1 을 적은 그림인가.
 */
export function stepJudgePopup(state: JudgePopupState): {
  readonly next: JudgePopupState
  readonly bigOut: BigOutFrame | null
  readonly recordsLaserOut: boolean
} {
  if (state.timer <= 0) return { next: state, bigOut: null, recordsLaserOut: false }
  const timer = state.timer - 1
  if (!state.shown && state.code === 13) {
    if (!state.bigOutArmed) return { next: { ...state, timer }, bigOut: null, recordsLaserOut: false }
    const bigOut = { frame: bigOutFrameAt(state.bigOutDraws), holderSlot: state.holderSlot }
    const draws = state.bigOutDraws + 1
    const ended = draws >= BIG_OUT_DRAWS
    return {
      next: {
        ...state,
        timer: ended ? 0 : timer,
        bigOutDraws: draws,
        bigOutArmed: ended ? false : state.bigOutArmed,
        shown: ended ? true : state.shown,
        bigOutRecord: false,
      },
      bigOut,
      recordsLaserOut: state.bigOutRecord,
    }
  }
  return {
    next: { ...state, timer, bigOutArmed: false, bigOutRecord: false, shown: true },
    bigOut: null,
    recordsLaserOut: false,
  }
}
