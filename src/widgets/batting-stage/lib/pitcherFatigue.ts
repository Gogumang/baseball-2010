import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { loopingAnimationStepAt } from '@/widgets/batting-stage/lib/baseRunners'
import { pitchLastStepOf, pitchStepStartTickOf } from '@/widgets/batting-stage/lib/stageScenery'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

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
 * 되감기 · 그린 수는 웹 장면 단계 틱으로 센다(그림 한 번 = 장면 틱 하나 — 아래 실투 "!" 머리말). +0x14 는 장면의 투수 그림 객체 상태(`stageScenery.pitcherAnimationAt`)다 —
 * 투구 뒤 다음 0xf 진입까지 상태 1 에 머물므로 0x12 · 0x13 에도 안 그린다.
 */
export const PLAYER_EFFECT_FRAMES = assetUrl('./sprites/player_effect/frames')
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
 * 홈런 갈래의 "!"(3912c — 0x357e0 · 투수 단계 == 마지막 단계 13(마투수 0xcfd34[순번]) · +0x199a)는 `renderBattingStage` 의
 * `drawPitcherHomeRunMarks` 가 같은 애니 13 으로 그린다(효과는 좌투 0x11).
 * +8 은 그림마다 1 준다 — 웹은 놓은 틱(0x11 틱 10)부터 장면 틱으로 센다.
 * 그림 수 = 장면 틱 수다 — 원본 경기 장면 0x52c50 은 한 틀에 한 번 그리고(그리기 표 0xd05a0), 웹은 모든 단계를 같은 경기 장면 틱
 * 격자로 센다. ⚠️ 남은 차이: 공용 창이 선 첫 그림([창+0x250], 52efe)은 갱신 없이 한 번 더 그려 +8 이 한 번 더 준다 — 웹은 안 센다.
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

/**
 * **투수 그리기 0x38d1c 의 홈런 갈래** (0x3908a~0x39192, 2026-10-15 직접 떴다):
 * ```
 * 3908c  0x357e0(경기) — [경기+0xfd4] − 0x18 ≤ 2 (결과 코드 24~26, 홈런성)가 아니면 끝
 * 39096  목표 단계 = 13 · 마투수(0xb633d)면 s8 0xcfd34[0xb63a0] (12,14,12,15,12 — 마지막 단계 0xd744f 와 같다)
 * 390c0  투수 그림 객체 [+0xf98] 단계 +0x1c ≠ 목표 단계면 끝                     (상태는 안 본다)
 * 390c6  마투수가 아니면 player_effect(+0x1030) 애니 12 를 (투수 x, 투수 y) 에 효과 (좌투 0xb63c1 ? 0x11 : 0) · 깊이 [0xcfa8c+8],
 *        그린 뒤 0x93d91([애니표 +0x30]) 로 한 칸
 * 3912c  [경기+0x199a](큰 타구 감상, 0x392ac) ≠ 0 이면 애니 13 "!" 를 (투수 x, 투수 y − 0x34) 에 같은 효과로, 0x93d91([애니표 +0x34])
 * ```
 * 단계는 0x11 갱신 0x4e060 에서만 센다(0x9e004 — `stageScenery` 투수 그림 객체 주석). 그래서 공이 마지막 단계(평범한 투수 틱 19) 전에
 * 타자에 닿으면 0x11 이 끝나며 단계가 굳어 **이 갈래는 그 공에서 영영 안 탄다**(원본 그대로).
 * 애니 12(56 · 57, 각 10틱)는 돌림이 아니라(0x1a610 에 비트 12 없음) 마지막 칸에 멈추고, 13 은 돌림이다 —
 * 둘 다 0xf 진입 0x3d954 가 되감는다. k 번째 그림은 k 칸 나아간 칸이다(실투 "!" · 체력 그림과 같은 셈).
 *
 * **결과 코드 [+0xfd4] 는 메시지 0x6aa 가 쓰고 0x11 진입이 지운다** — 0x509a0 의 0x6aa 가지가 판정 0xab214 의 12바이트를
 * +0xfcc~+0xfd7 에 통째로 옮긴다(5130c `ldr r2,[sp,#0x88]`(= 경기+0xfcc, 51264) · 5130e `ldm r5!` · 51310 `stm r2!`). 0x51226~0x5130e
 * 사이에 빠지는 갈래가 없어 0x6aa 마다 쓴다. 0x6aa 는 0x4e060 이 0xbfbad 로 **바로** 보내므로(4e210) 판정 그림의 갱신 안에서 써지고
 * 같은 그림의 그리기가 새 코드를 본다. 상태 0x11 진입 0x3de10 은 3dedc~3deea 에서 r2 = 0xfe0 − 0xc = 0xfd4 를 만들어 **0 을 쓴다**
 * (공마다 — 리터럴 0xfd4 가 아니라 `xval 0xfd4` 에 안 잡혔다. r100 4f484244 의 "0x11 진입도 안 지운다 · 다음 0x6aa 까지 남는다" 정정).
 * 그래서 홈런성 코드는 같은 공의 0x13 과 다음 0x11 진입 사이에만 남고, 그 사이 0xd · 0xf 진입이 투수를 상태 0 으로 되돌려(0x35650 →
 * 0x340c0) 마지막 단계 조건이 거짓이 된다 — 묵은 코드로 이 갈래를 타는 일은 없다. 값은 경기 장면 객체 칸이라 웹은
 * `sceneResultCodeStore` 에 둔다. 모드 7 은 38ede 가 곧장 0x3908a 로 건너뛰어 이 갈래는 탄다. "!" 의 감상 플래그 +0x199a 는
 * 0xf 진입 3d978 이 지운다.
 */

/** 0x390f2 `movs r2, #0xc` — 홈런 갈래의 player_effect 애니 12 (프레임 56 · 57) */
export const HOME_RUN_PITCHER_ANIMATION = 12

/** 0x357e0 — `[경기+0xfd4] − 0x18 ≤ 2`(부호 없는 비교), 곧 결과 코드 24~26(홈런성) */
export function isHomeRunLikeResultCode(code: number | null): boolean {
  return code !== null && code - 0x18 >= 0 && code - 0x18 <= 2
}

export interface PitcherHomeRunMarks {
  /** 0xf 진입 뒤 갈래가 참이었던 그림 수 — 이 그림이 k 번째 (1 부터) */
  readonly drawCall: number
  /** 애니 12 — 마투수가 아닐 때만 (390c6 0xb633d) */
  readonly showsPitcherAnimation: boolean
  /** 애니 13 "!" — 감상 플래그 +0x199a 가 섰을 때 (3912c) */
  readonly showsBang: boolean
}

/** 홈런 갈래가 보는 결과 코드 [+0xfd4] 의 이 공 동안의 값 */
export interface PitcherResultCodeClock {
  /** 0x11 진입 뒤 판정 전의 코드 — 0x11 진입(3deea)이 0 으로 지워 늘 0 이다(부품이 공 도중에 선 경우만 장면 객체에 남은 값) */
  readonly codeBeforePitch: number | null
  /** 이 공의 0x6aa 그림의 투수 틱 — 그 그림부터 `judgedCode`. 아직 판정이 없으면 null */
  readonly judgedTick: number | null
  /** 이 공의 0x6aa 가 쓴 코드 (헛스윙 · 번트 헛맞음은 홈런성이 아니다) */
  readonly judgedCode: number | null
}

/** 투수 틱 `tick` 의 그림이 보는 결과 코드가 홈런성인가 */
function isHomeRunLikeAt(clock: PitcherResultCodeClock, tick: number): boolean {
  const isJudged = clock.judgedTick !== null && tick >= clock.judgedTick
  return isHomeRunLikeResultCode(isJudged ? clock.judgedCode : clock.codeBeforePitch)
}

/** [from, to] 틱 가운데 코드가 홈런성인 그림 수 */
function homeRunLikeTicksBetween(clock: PitcherResultCodeClock, from: number, to: number): number {
  if (to < from) return 0
  const judgedTick = clock.judgedTick
  if (judgedTick === null) return isHomeRunLikeResultCode(clock.codeBeforePitch) ? to - from + 1 : 0
  const before = isHomeRunLikeResultCode(clock.codeBeforePitch) ? Math.max(0, Math.min(to, judgedTick - 1) - from + 1) : 0
  const after = isHomeRunLikeResultCode(clock.judgedCode) ? Math.max(0, to - Math.max(from, judgedTick) + 1) : 0
  return before + after
}

/**
 * 홈런 갈래(0x3908a)가 이 그림에서 무엇을 그리는가 — 아무것도 안 그리면 null.
 * 투수 틱은 0x11 진입 뒤 그림 수(그리기 시계)이고, 투수를 그리는 상태(0xd~0x13 · 0xb · 0x16 · 0x1b · 0x23 — 0x38d1c 를 부르는
 * 그리기 열한 곳)에서만 이 함수를 부른다.
 */
export function pitcherHomeRunMarksOf(
  input: PitcherResultCodeClock & {
    /** 감상 플래그 [경기+0x199a] (0x392ac) */
    readonly isBigHit: boolean
    /** 지금 투수 틱 (0x11 진입 뒤 그림 수) */
    readonly pitcherTick: number
    /** 지금 투수 단계 +0x1c — 0x11 이 끝난 뒤면 굳은 단계 (`pitcherAnimationAt` 의 `pitchEndTick`) */
    readonly step: number
    /** 마투수 순번 (없으면 null) */
    readonly aceOrder: number | null
    /**
     * 창이 선 첫 그림([창+0x250])이 든 투수 틱 — 그 그림도 이 갈래를 돌아 애니 12 · 13 을 한 칸 더 넘긴다(`stageRedraws`). 안 주면 없음
     */
    readonly redrawPitcherTicks?: readonly number[]
  },
): PitcherHomeRunMarks | null {
  // 39096~390c4 — 목표 단계 13 · 마투수 0xcfd34[순번] (= 마지막 단계). 상태는 안 본다
  const lastStep = pitchLastStepOf(input.aceOrder)
  if (input.step !== lastStep) return null
  if (!isHomeRunLikeAt(input, input.pitcherTick)) return null
  // 단계는 0x11 동안만 오르므로 마지막 단계에 닿은 틱부터 지금까지 — 0xf 진입이 되감은 뒤 갈래가 참이었던 그림을 센다
  const lastStepTick = pitchStepStartTickOf(lastStep, input.aceOrder)
  const redraws = (input.redrawPitcherTicks ?? []).filter((at) => at >= lastStepTick && at <= input.pitcherTick && isHomeRunLikeAt(input, at)).length
  const drawCall = homeRunLikeTicksBetween(input, lastStepTick, input.pitcherTick) + redraws
  if (drawCall < 1) return null
  return { drawCall, showsPitcherAnimation: input.aceOrder === null, showsBang: input.isBigHit }
}

/**
 * **투구 바람 줄** — 투수 그리기 0x38d1c 의 0x38dc6~0x38e5e (2026-10-15 직접 떴다). 투수 점 (x, y) 를 정한 바로 뒤,
 * 투수 그림을 그리기 목록에 넣는 0x38ed2 **앞**이고 모드 7 거름(38ed6)보다도 앞이다:
 * ```
 * 38dc6  투수 그림 객체 [+0xf98] 상태 +0x14 ≠ 1 이면 건너뜀
 * 38dd4  투수가 마선수(0xb633d) 면 건너뜀
 * 38de2  단계 +0x1c 가 7~11 (`cmp #6 / ble` · `cmp #0xb / bgt`) 이 아니면 건너뜀
 * 38df0  좌투(0xb63c1) 면 x − 8, 아니면 x + 8                       ; x 는 좌투 + 1 (0x38db8) 을 먹은 투수 점
 * 38e06  player_effect(+0x1030) 애니 11 을 (그 x, 투수 y) 에 효과 (좌투 ? 0x11 : 0) · 깊이 [0xcfa8c+8] = 24500 으로 그리기 목록에,
 *        그린 뒤 0x93d91([애니표 +0x2c]) 로 한 칸
 * ```
 * 투수 그림(0x79524 → 0xbe8d5, 깊이 [0xd3cf8+8] = 24500)과 깊이가 같고, 목록 넣기 0xbe810 은 `새 깊이 < 칸 깊이` 인 첫 칸 앞에 넣어
 * 같은 깊이면 **먼저 넣은 것이 먼저(아래)** 그려진다 — 바람 줄은 투수 **밑**이다.
 * 애니 11(37 · 38 · 39 · 40 · 41, 지연 1 · 2 · 1 · 1 · 1)은 돌림이 아니라(0x1a610 에 비트 11 없음) 마지막 칸에 멈추고 0xf 진입
 * 0x3d954 가 되감는다. 평범한 투수의 단계 7~11 은 유지 0 · 0 · 0 · 0 · 1(0xd73e9) 이라 여섯 그림이다.
 * k 번째 그림은 k 칸 나아간 칸이다(실투 "!" · 체력 그림 · 홈런 갈래와 같은 셈) — 그래서 첫 칸 37 은 보이지 않는다(원본 그대로).
 * 좌투 x − 8 · 효과 0x11 은 투수 점을 축으로 한 거울이라 웹은 거울 안에서 x + 8 로 그린다.
 * 0x11 이 단계 7~11 에서 끝나면(공이 빨리 닿음) 단계가 그 자리에 굳어 0x12 · 0x13 그림에서도 계속 그린다(그림 수도 계속 는다).
 */
export const PITCH_WIND_ANIMATION = 11
/** 38dfc · 38e04 — 투수 점에서 던지는 팔 쪽으로 8 */
export const PITCH_WIND_OFFSET_X = 8
/** 38de8 · 38dec — 바람 줄을 그리는 단계 */
const PITCH_WIND_FIRST_STEP = 7
const PITCH_WIND_LAST_STEP = 0xb

/** 바람 줄을 이 그림에서 그리면 그 그림 수(1 부터), 아니면 null */
export function pitchWindDrawCallOf(input: {
  /** 투수 그림 객체 상태 +0x14 */
  readonly state: number
  /** 단계 +0x1c */
  readonly step: number
  /** 상태 1 에 든 뒤 투수 틱 */
  readonly pitcherTick: number | null
  /** 마투수 순번 (없으면 null) */
  readonly aceOrder: number | null
}): number | null {
  if (input.state !== 1 || input.aceOrder !== null || input.pitcherTick === null) return null
  if (input.step < PITCH_WIND_FIRST_STEP || input.step > PITCH_WIND_LAST_STEP) return null
  const drawCall = input.pitcherTick - pitchStepStartTickOf(PITCH_WIND_FIRST_STEP, null) + 1
  return drawCall >= 1 ? drawCall : null
}
