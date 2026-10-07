import { NONE, type RunnerState } from '@/entities/fielding/model/fieldingState'

/**
 * ============================================================================
 * 판 진행 관문 `0xb0d28` · 판 끝 결과 코드 `0x9d5bc` · 사건 코드 처리 `0xb2bc4` — 직접 뜬 것
 * ============================================================================
 *
 * 수비 판(상태 0x17)은 매 틱 경기 장면 슬롯 2 머리 `52502` 에서 이 관문을 먼저 부른다. 0 이면 `529f0` 으로 빠져
 * 플레이 틱(vt48 = 0xb401c) · vt4c · 자동 진루 · 자동 슬라이딩 · CPU 송구를 **하나도 안 돌고**, `+0x1094` 10틱 뒤
 * 메시지 0xbb9 → 판정 0xae3e8 로 판이 닫힌다.
 *
 * ## 관문 0xb0d28(플레이) — 플레이 +0x24 = 공, +0x28 = state, +0x20 = 주자관리
 * ```
 * b0d2c  +0x110(파울 표시) ≠ 0 이면 파울 갈래:
 * b0d3a    p = 공.vt60()(지금 점 = 0xa2b78(공, 공+0x68)) 의 z ; q = 공.vt60() 의 각(점 +0x10, s16)
 * b0d68    멈춤 = 공.vt18() (0xa27f0)
 * b0d70    낙구 = 공+0xaa4 ≠ −1 && 공+0xaa0 > 공+0xaa4 && 공+0x68 == 공+0xaa0   ; 담장선 넘은 뒤 떨어지는 그 틱
 * b0d8e    뒤로 = z > 0x7f57(32599) && −315 < q < −225                         ; 홈 뒤(백네트 쪽)로 가는 공
 * b0da6    멈춤 || 낙구 || 뒤로 → 0 (닫음) ; 아니면 1          ★ +0x120 은 안 건드린다
 * b0db4  state[0xb](마지막 사건 코드) == 11 → 0
 * b0dbe  state[6](아웃) > 2 → 0
 * b0dc6  0xaa05c(주자관리) 참 → +0x120 = 0 ; 1
 * b0dde  +0x125(홈런더비 판) 이면 공.vt18() → 0 / 아니면 +0x120 = 0 ; 1
 * b0e04  +0x111 || +0x129 이면 0xa990c(주자관리) == 0 → 0 (아니면 아래로)
 * b0e24  +0x12c(쥠) == 0 && +0x124 == 0 → +0x120 = 0 ; 1
 * b0e46  아니면 old = +0x120 ; +0x120 = old + 1 ; old > 50(0x32) → 0 ; 1
 * ```
 * - `0xaa05c` = 주자마다 `!+0x96 && (!vt18 || +0x94)` 가 하나라도 있으면 참 (aa070~aa090)
 * - `0xa990c` = `0xa9598`(주자 수, +0xc) − `0xa98b4`(+0x96 선 주자 수) = 아직 안 끝난 주자 수
 * - 그래서 "주자가 다 서고 공을 쥔(또는 +0x124) 틱" 이 51틱 이어지면 52번째 관문에서 닫힌다.
 *   그 51틱 동안에도 자동 진루 · CPU 송구는 돈다.
 */

/** 플레이 +0x120 세기가 넘으면 닫는 값 — `b0e54 cmp r1, #0x32 ; ble` */
export const PLAY_END_COUNT_LIMIT = 50

/** 관문의 파울 갈래가 보는 지금 공 (`0xa2b78` 점 · `0xa27f0` 멈춤 · 사건 틱) */
export interface FoulBallView {
  /** 공.vt18 = 0xa27f0 — 지금 점의 속도·수직 속도 워드가 0 이고(목표점이 있으면 거기 닿았고) 멈췄다 */
  readonly stopped: boolean
  /** 공+0x68 — 지금 틱 */
  readonly currentTick: number
  /** 공+0xaa0 — 낙구 틱 */
  readonly landingTick: number
  /** 공+0xaa4 — 담장선 넘는 틱 (−1 없음) */
  readonly fenceTick: number
  /** 지금 점의 z (점 +8) */
  readonly z: number
  /** 지금 점의 각 (점 +0x10, 원본 각 — 페어는 −135 ~ −45) */
  readonly angle: number
}

export interface PlayGateInput {
  /** 플레이 +0x110 — 사건 코드 7(파울)이 세운다 */
  readonly foulFlag: boolean
  /** 파울 갈래에서만 본다 */
  readonly foulBall?: FoulBallView
  /** state[0xb] — 0xb2bc4 가 마지막으로 받은 사건 코드 */
  readonly lastEventCode: number
  /** state[6] */
  readonly outs: number
  /** 0xaa05c — 처리 안 끝난 주자가 있나 (`someRunnerStillActive`) */
  readonly someRunnerActive: boolean
  /** 플레이 +0x125 — 판 시작 종류 8(홈런더비, b2a10)이 세운다 */
  readonly homeRunDerby: boolean
  /** 공.vt18 — +0x125 갈래에서만 본다 */
  readonly ballStopped?: boolean
  /** 플레이 +0x111 — 사건 코드 8 */
  readonly homeRunFlag: boolean
  /** 플레이 +0x129 — 사건 코드 12 */
  readonly poleHomeRunFlag: boolean
  /** 0xa990c — 아직 안 끝난(+0x96 안 선) 주자 수 */
  readonly liveRunnerCount: number
  /** 플레이 +0x12c — 누가 공을 쥐고 있나 */
  readonly ballHeld: boolean
  /** 플레이 +0x124 — 사건 코드 10 */
  readonly groundRuleFlag: boolean
  /** 플레이 +0x120 — 지금 세기 */
  readonly endCounter: number
}

export interface PlayGateResult {
  /** 1 이면 이번 틱 판이 이어진다 */
  readonly open: boolean
  /** 새 +0x120 */
  readonly endCounter: number
}

/** 판 진행 관문 `0xb0d28` 그대로 */
export function passPlayGate(input: PlayGateInput): PlayGateResult {
  const counter = input.endCounter
  if (input.foulFlag) {
    const ball = input.foulBall
    if (ball === undefined) return { open: true, endCounter: counter }
    // b0d70~b0d8c — 담장선을 먼저 넘고 떨어지는 바로 그 틱
    const landedOutside =
      ball.fenceTick !== -1 && ball.landingTick > ball.fenceTick && ball.currentTick === ball.landingTick
    // b0d8e~b0da4 — z > 0x7f57 && q + 0xe1 < 0 && q > −315 (0xfffffec5)
    const behindPlate = ball.z > 0x7f57 && ball.angle + 0xe1 < 0 && ball.angle > -315
    return { open: !(ball.stopped || landedOutside || behindPlate), endCounter: counter }
  }
  if (input.lastEventCode === 11) return { open: false, endCounter: counter }
  if (input.outs > 2) return { open: false, endCounter: counter }
  if (input.someRunnerActive) return { open: true, endCounter: 0 }
  if (input.homeRunDerby) {
    if (input.ballStopped === true) return { open: false, endCounter: counter }
    return { open: true, endCounter: 0 }
  }
  if ((input.homeRunFlag || input.poleHomeRunFlag) && input.liveRunnerCount === 0) {
    return { open: false, endCounter: counter }
  }
  if (!input.ballHeld && !input.groundRuleFlag) return { open: true, endCounter: 0 }
  return { open: counter <= PLAY_END_COUNT_LIMIT, endCounter: counter + 1 }
}

/**
 * **`0xaa05c`(주자관리)** — 주자마다 `!+0x96 && (!vt18 || +0x94)` 가 하나라도 있나.
 *
 * - +0x96 = 끝(아웃 · 득점 — 0xaa0a8 이 득점 때 +0x95·+0x96 을 함께 세운다) → 웹 `isOut || scored`
 * - vt18 = 목표점에 서 있다 → `atTarget(runner)`
 * - **+0x94 = 요구 루를 밟아야 하는 판정끝 표시** — 0xa95c0 이 바운드·담장·뜬공 포구 때 **모든 주자**에게 1 을 세우고,
 *   주자 틱 a0270 이 `+0x88 == −1` 이면 곧바로, 도착 0xa040c 가 `+0x8c == +0x88` 이면 지운다(+0x88 = −1 과 함께).
 *   그래서 이 웹 모델은 `requiredBase ≠ −1` 로 읽는다(`coverAssignment` 0xb1b88 과 같은 읽기).
 */
export function someRunnerStillActive(
  runners: readonly RunnerState[],
  atTarget: (runner: RunnerState) => boolean,
): boolean {
  return runners.some(
    (runner) => !runner.isOut && !runner.scored && (!atTarget(runner) || runner.requiredBase !== NONE),
  )
}

/** **`0xa990c`(주자관리)** = 주자 수 − `+0x96` 선 주자 수 */
export function liveRunnerCountOf(runners: readonly RunnerState[]): number {
  return runners.filter((runner) => !runner.isOut && !runner.scored).length
}

/**
 * ============================================================================
 * 판 끝 결과 코드 `0x9d5bc` · 파울 판정 `0xb68dc` (직접 뜬 것)
 * ============================================================================
 * ```
 * 9d5c0  s = [r0+8](state)
 * 9d5c4  s[0x1f](뜬공 아웃) → 13
 * 9d5ce  s[0x19](0.1% 사건) → 0
 * 9d5d6  0xb68dc(s) → (s4 스트라이크 > 1 && s[0x13] 번트 종류 ≠ 0) ? 11 : 7
 * 9d602  s[0x80](폴 틱) > 0 → (s[0x1e] && s[0x20] ≠ −1) ? 10 : 12
 * 9d61c  s[0x20](담장 틱) > 0 → s[0x1e] ? 10 : 8
 * 9d630  6
 * b68dc  (s[0x19] && 스트라이크 > 1) || s[0x1f] → 0 ; 아니면 s[0x1c](페어/파울 0x9d660 → 1 = 파울)
 * ```
 */
export interface PlayEndState {
  /** state[0x1f] — 뜬공 아웃 (쥐기 0xb2710 의 vt90 == 1) */
  readonly flyOut: boolean
  /** state[0x19] — 투구 판정 0.1% 굴림 사건 */
  readonly specialEvent: boolean
  /** state[0x1c] — 파울 각 (0x9d660(각) 의 반대) */
  readonly foulAngle: boolean
  /** state[4] — 스트라이크 */
  readonly strikes: number
  /** state[0x13] — 번트 종류 (0 = 번트 아님) */
  readonly buntKind: number
  /** state[0x80] — 폴 맞은 틱 (공+0xab0, −1 없음) */
  readonly poleTick: number
  /** state[0x20] — 담장선 넘는 틱 (공+0xaa4, −1 없음) */
  readonly fenceTick: number
  /** state[0x1e] — 공이 땅에 닿았거나 잡혔다 */
  readonly ballTouched: boolean
}

/** `0xb68dc` — 이 타구가 파울로 끝났나 */
export function isFoulEnded(state: PlayEndState): boolean {
  if (state.specialEvent && state.strikes > 1) return false
  if (state.flyOut) return false
  return state.foulAngle
}

/** `0x9d5bc` — 판 끝 결과 코드 (6 안타 · 7 파울 · 8 홈런 · 10 2루타 · 11 번트 파울 아웃 · 12 폴 홈런 · 13 아웃 · 0 없음) */
export function playEndResultCode(state: PlayEndState): number {
  if (state.flyOut) return 13
  if (state.specialEvent) return 0
  if (isFoulEnded(state)) return state.strikes > 1 && state.buntKind !== 0 ? 11 : 7
  if (state.poleTick > 0) return state.ballTouched && state.fenceTick !== -1 ? 10 : 12
  if (state.fenceTick > 0) return state.ballTouched ? 10 : 8
  return 6
}

/**
 * **사건 코드 처리 `0xb2bc4`(플레이 vt44)** — 표 0xd87a0[코드 − 6]. 머리 b2bc8 에서 **모든 코드**를 state[0xb] 에 적는다.
 * ```
 * 6 · 9 · 13 → 아무것도 (b2c3e)
 * 7  b2bea  +0x110 = 1 · state[0x1c] = 1 · state[7] = 0x9d640(공+0x70 각)
 * 8  b2bd8  +0x111 = 1 · state[0x1d] = 1 · 0xb0cb8(6) — 플레이 종류(+0x118 · state[0x26]) = 6
 * 10 b2c0a  +0x124 = 1 · 0xb0cb8(7)
 * 11 b2c18  vt90(아웃 판정 0xb36d0)
 * 12 b2c24  +0x129 = 1 · state[0xf] = 1 · 0xb0cb8(0xa)
 * ```
 * 뒤이어 vt54 = 0xb2c58: 코드 7·12 면 야수 9명 모두 동작 0xf(0xb8dbc) — 그림만.
 */
export interface EventCodeEffect {
  readonly foulFlag: boolean
  readonly homeRunFlag: boolean
  readonly groundRuleFlag: boolean
  readonly poleHomeRunFlag: boolean
  /** 코드 11 — vt90 을 한 번 더 부른다 */
  readonly judgeOut: boolean
  /** 0xb0cb8 이 바꾸는 플레이 종류. 안 바꾸면 −1 */
  readonly playKind: number
}

export function eventCodeEffectOf(code: number): EventCodeEffect {
  return {
    foulFlag: code === 7,
    homeRunFlag: code === 8,
    groundRuleFlag: code === 10,
    poleHomeRunFlag: code === 12,
    judgeOut: code === 11,
    playKind: code === 8 ? 6 : code === 10 ? 7 : code === 12 ? 0xa : -1,
  }
}

/**
 * ============================================================================
 * 파울 판이 닫힌 뒤 — 스트라이크 (직접 뜬 것)
 * ============================================================================
 * 파울 타구도 상태 0x17 수비 판으로 돈다. 공이 처음 땅에 닿거나 담장선을 넘는 틱(b44f6)에 0x9d5bc 가 7(파울)을 내면
 * ```
 * b4562  vt44 = 0xb2bc4(7): +0x110 = 1 · state[0x1c] = 1 · state[7] = 0x9d640(공+0x70) ; vt54(7): 야수 9명 동작 0xf
 * b457c  메시지 0xbba(7) → 화면 51a56: [장면+0x10ac] = 7 · state[0xb] = 7 → 표 0xd0488[6] = 51c5c:
 *        +0x108c = 100 · +0x1088 = −1 · 소리 25 · 0xa7dbc(연속 파울 +0x15f++, 3 → 기록 32 · 4 → 33)
 * b0d2c  그 뒤 판 진행 관문은 파울 갈래만 본다 — 공이 멈추거나 · 담장 밖에 떨어지는 틱 · 홈 뒤로 가면 닫는다
 * 529f0  +0x1094 10틱 → 0xbb9 → 0x528b0:
 * 52a52    0xae3e8: 0xb68dc(파울) → 다음 상태 0xf (정산 0xa8024 안 부름)
 * 52a66    0x35108: [장면+0x10ac] == 7 → 0xa975c(주자관리 — 주자를 판 앞 자리로 되돌림, 유력) · **0xb6b58(경기)**
 * b6b58    스트라이크(state[4]) ≤ 1 이면 +1
 * ```
 * 2스트라이크 번트 파울은 0x9d5bc 가 11 을 내 [장면+0x10ac] = 11 이라 스트라이크를 안 올리고, 관문 b0db4 가 다음 틱에 닫고
 * 0xae3e8 이 state[0xb] == 11 → 0xd(정산) — 아웃이다. 쥐기 전에 잡힌 파울 뜬공은 vt90 의 13(뜬공 아웃)이다.
 */
export function strikesAfterPlay(strikes: number, lastResultCode: number): number {
  if (lastResultCode !== 7) return strikes
  return strikes <= 1 ? strikes + 1 : strikes
}
