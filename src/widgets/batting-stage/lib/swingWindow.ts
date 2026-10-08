import type { SwingReservation } from '@/widgets/batting-stage/model/stageRefs'

/**
 * **사람 타격 키의 틱** — 상태 0x11 의 키 차례 (직접 뜸).
 *
 * 경기 장면 프레임 0x52c50 은 한 그림 안에서 `키(0x498d4 → 0x53670 이 메시지를 보낸다) → 갱신 0x4e060 →
 * 메시지 처리 0xbfc8d(0x51db6 · 0x51dee · 0x51e48 이 경기+0xfd8 = 지금 공 틱 +0x1098) → 그리기(0x3b2f4 가 공 경로[min(틱, N−1)]
 * 를 그린다, 0x35820) → 0x3f378(공 틱 +1, 5308e)` 차례로 돈다. 공은 투수 단계가 릴리스(+0x1c > 5, 0x9e038)에 닿은 그림에서
 * 틱 0 으로 처음 그려지고(0x3f378 의 +1 은 그 그림 끝), 웹 `ballFrameAt` 의 프레임이 곧 그 그림의 공 틱이다.
 *
 * 사람이 보고 누른 그림의 틱이 v 면 키는 **다음 그림**에서 읽히고, 그때 공 틱은 이미 v + 1 이다 → 판정 F(+0xfd8) = v + 1.
 */
export function keyTickOf(visibleFrame: number): number {
  return visibleFrame + 1
}

/**
 * **스윙 · 필살 · 번트 키를 받는가** — 0x51db6 · 0x51dee · 0x51e48 은 상태 0x11 이고 S(+0xf9c)+4(스윙 받을 준비)일 때만 받는다.
 * S+4 는 0x4e060 끝(4e284~4e294)이 공 틱 > 0 인 갱신마다 0xb933c 로 세운다(쉬는 자세 · 번트 자세 아님 · 스윙 안 함일 때만).
 * 자세를 바꾸는 0xb915c 가 S+4 = 0 으로 내리므로 스윙이 나간 뒤 · 번트 자세(0xb93a8 → 상태 4)에서는 키를 안 받는다.
 *  - 보이던 틱이 음수(와인드업)면 키는 릴리스 그림(틱 0)에서 읽히고 그 갱신은 S+4 를 안 세운다 → 무시
 *  - F ≥ N + 1 이면 그 그림의 갱신이 0x12 를 예약한 뒤다 — 받아도 다음 공 0x11 진입 0x3de10 이 예약을 지운다 → 무시로 본다
 */
export function acceptsBattingKey(visibleFrame: number, frameCount: number): boolean {
  return visibleFrame >= 0 && keyTickOf(visibleFrame) <= frameCount
}

/** 스윙 예약(+0xfe0)이 풀리는 틱 — 다음 갱신 0x4e0ce(공 틱 ≥ +0xfd8)에서 0xb9374 로 스윙이 나간다(필살 횟수 −1 은 0x4e136) */
export function swingReleaseTickOf(keyTick: number): number {
  return keyTick + 1
}

/**
 * 스윙 판정 틱 — 스윙 자세 상태 3 은 한 틱에 한 프레임(0xb9168)이라 0xb9270(상태 3 · 프레임 1)이 0 이 되는 갱신은
 * 나간 다음 틱이다(0x4e192). 그 갱신이 깊이를 보고 0x6aa 를 보낸다.
 */
export function swingJudgeTickOf(keyTick: number): number {
  return keyTick + 2
}

/**
 * 공 끝 틱 — 0x4e24e: 공 틱 > N 이고 맞지 않았으면(+0xfd2 == 0) 0x12. 그 갱신에서도 앞쪽 판정(4e15c~4e24a)은 먼저 돈다.
 */
export function pitchEndTickOf(frameCount: number): number {
  return frameCount + 1
}

/** 판정 틱이 0x11 의 마지막 갱신(N + 1) 안에 드는가 — F ≤ N − 1. F == N 이면 스윙만 나가고 판정 없이 0x12 */
export function isSwingJudgeable(keyTick: number, frameCount: number): boolean {
  return swingJudgeTickOf(keyTick) <= pitchEndTickOf(frameCount)
}

/** 4e1e4 의 깊이 문턱 0xbb8 */
export const SWING_REACH_DEPTH = 3000

/**
 * 0x4e1a6~0x4e1ea — `|표 0xcfbcc[side].z − 공 경로[min(틱, N − 1)].z| ≤ 3000` 이면 판정(0x6aa), 아니면 판정 없는 헛스윙.
 * 경로가 없는 공(사용자 투구)은 웹 전용이라 늘 닿는 것으로 본다.
 */
export function isBallInSwingReach(
  path: readonly { readonly z: number }[] | null,
  frameCount: number,
  tick: number,
  zoneDepth: number,
): boolean {
  if (path === null || path.length === 0) return true
  const index = Math.max(0, Math.min(tick, frameCount - 1, path.length - 1))
  return Math.abs(zoneDepth - path[index].z) <= SWING_REACH_DEPTH
}

/**
 * **번트 판정 틱** — 0x4e15c `r7 = S+8(번트 자세) ≠ 0 && 공 틱 == N − 1` 이면 깊이 · 0xb9270 조건 없이 0x6aa.
 * 자세는 번트 키(F)의 다음 갱신 0x4e0ce 에서 0xb93a8 로 선다(F + 1, 같은 갱신의 r7 보다 먼저) — 그 틱이 N − 1 을 지나면
 * 판정이 영영 안 선다(+0xd 가 0 이라 0x12 에서 안 친 공으로 본다, 원본 그대로). 판정이 서면 그 틱, 아니면 null.
 */
export function buntJudgeTickOf(keyTick: number, frameCount: number): number | null {
  const judgeTick = frameCount - 1
  return swingReleaseTickOf(keyTick) <= judgeTick ? judgeTick : null
}

/** 공이 나는 동안(0x11) 한 갱신이 보는 것 */
export interface FlightState {
  /** 공이 나는 틱 수 N (+0x109c) */
  readonly frameCount: number
  readonly swing: SwingReservation | null
  /** 번트 자세 — 종류와 마지막 키 틱 */
  readonly bunt: { readonly kind: number; readonly frame: number } | null
  /** 판정이 났나 (+0xfe5) */
  readonly isJudged: boolean
  /** 이 틱에 공이 타자 근처인가 (`isBallInSwingReach`) */
  isInReach(tick: number): boolean
  /** 번트 자세가 이 틱에 판정되나 (`buntStance.isBuntJudgeFrame` 쪽) */
  isBuntJudgeTick(frame: number): boolean
}

export type FlightEvent =
  /** 예약이 풀려 스윙이 나간다 (F + 1, 0x4e0ce) */
  | { readonly kind: '스윙나감' }
  /** 0x6aa 판정 (스윙 F + 2 · 번트 N − 1) */
  | { readonly kind: '판정'; readonly frame: number; readonly buntKind: number; readonly isSpecial: boolean }
  /** 맞힐 프레임에 공이 타자 근처가 아니다 — 0x4e21c 바람 소리만 */
  | { readonly kind: '판정없는헛스윙' }
  /** 공 끝 (틱 N + 1, 0x4e24e) */
  | { readonly kind: '공끝' }

/**
 * 공 프레임 `frame` 까지 와 있을 때 **다음에 일어날 일** — 0x4e060 한 갱신의 차례(예약 풀기 4e0ce → 번트 r7 · 스윙 판정
 * 4e15c~4e24a → 공 끝 4e24e)대로 하나씩 돌려준다. 부르는 쪽이 적용하고 다시 부르면 다음 일이 나온다(없으면 null).
 * rAF 가 틱을 건너뛰어도 차례는 그대로다.
 */
export function nextFlightEvent(state: FlightState, frame: number): FlightEvent | null {
  const { swing, bunt, frameCount } = state
  if (swing !== null && !swing.isReleased && frame >= swingReleaseTickOf(swing.frame)) return { kind: '스윙나감' }
  if (
    swing !== null &&
    swing.isReleased &&
    !swing.isUnjudgedWhiff &&
    !state.isJudged &&
    isSwingJudgeable(swing.frame, frameCount) &&
    frame >= swingJudgeTickOf(swing.frame)
  ) {
    return state.isInReach(swingJudgeTickOf(swing.frame))
      ? { kind: '판정', frame: swing.frame, buntKind: 0, isSpecial: swing.isSpecial }
      : { kind: '판정없는헛스윙' }
  }
  if (bunt !== null && !state.isJudged && state.isBuntJudgeTick(frame)) {
    return { kind: '판정', frame: bunt.frame, buntKind: bunt.kind, isSpecial: false }
  }
  if (frame >= pitchEndTickOf(frameCount)) return { kind: '공끝' }
  return null
}
