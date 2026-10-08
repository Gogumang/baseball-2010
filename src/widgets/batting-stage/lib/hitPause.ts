import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { lastDrawnPattern } from '@/entities/batting/model/battedBallOutcome'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'

/**
 * **상태 0x13 (19) = 배트에 맞은 직후 짧은 연출** (R10 4절 확정 · R15 9절 확정).
 *
 * 흐름: 투구 비행(0x11) 에서 맞았다고 판정되면 0x13 으로 갔다가 **늘 인플레이(0x17)** 로 나간다.
 * 붙잡아 두는 시간은 감상 플래그 `+0x199a` 가 고른다.
 *   - 켜졌으면(큰 타구): 공 틱이 `0x406a4` 문턱을 넘을 때까지 기다린다. **OK(−5)·'5' 로 건너뛴다.**
 *   - 꺼졌으면: **틱 8** 에 넘어간다(키로 못 건너뛴다). 결과 코드 ≤ 2 인 땅에 닿는 타구는 그보다 이를 수 있다(`earlyHitPauseTickOf`).
 *
 * 그리기(0x4cb1c)의 공 그림은 타구 궤적 쪽이라 문서가 읽지 않았고, 웹 타석 화면에도 타구 그림이
 * 없다 — 여기서는 **화면을 붙잡아 두는 시간만** 옮긴다 (연출 내용은 빠져 있다).
 */

/** 0x392ac 이 보는 결과 코드 — 홈런성(가운데·좌·우) */
const BIG_HIT_CODES: ReadonlySet<number> = new Set([24, 25, 26])
/** 원본 `공+0xac0` 눈금의 상한 (E 2-1b) */
export const CARRY_SCALE_MAX = 160
/** 0x392ac 의 `> 111` */
export const CARRY_THRESHOLD = 111
/** 플래그가 꺼졌을 때 넘어가는 틱 (0x406e8) */
export const SHORT_HIT_TICKS = 8

/** 0xa2a88 a2b02 — 거리를 이것으로 나눈다 (0x109) */
export const CARRY_SCALE_DIVISOR = 265

/**
 * 거리 → 원본 `공+0xac0` 눈금 (0~160) — 마무리 0xa2a88 a2af2~a2b12:
 * `min(isqrt(dx² + dz²) / 265, 160)`, 거리는 타구 시작점 (20000, 1000, 30000)(0xd7bdc) 에서 낙구점(aa0)까지.
 * 원본은 이 값을 **담장을 넘은(aa4 ≠ −1) 페어 타구에만** 적는다 — 궤적이 이미 그렇게 든 값이 `trajectory.carryScale` 이다.
 */
export function carryScaleOf(distance: number): number {
  if (distance <= 0) return 0
  return Math.min(CARRY_SCALE_MAX, Math.trunc(distance / CARRY_SCALE_DIVISOR))
}

export interface BigHitInput {
  /** 방향까지 붙인 결과 코드 (원본 경기 +0xfd4). 스윙하지 않았으면 null */
  readonly resultCode: number | null
  /** 폴 맞은 틱 (원본 공 +0xab0). −1 이면 아직 아무 데도 안 닿았다 */
  readonly poleTick: number
  /** 낙구 거리 눈금 (원본 공 +0xac0) */
  readonly carryScale: number
}

/**
 * 감상 플래그 `+0x199a` (0x392ac 전문) — 세 조건이 다 맞을 때만 켜진다.
 * 같은 판정이 타구음 7(`features/play-at-bat/model/atBatSounds` 의 `isBigHit`)과 "!" 효과도 고른다 —
 * 타구음은 그쪽이 고르고, 투수 머리 위 "!"(player_effect 애니 13, 0x3912c)는 이 화면에 아직 없다.
 *
 * 원본이 실제로 보는 칸은 폴 틱 `+0xab0` · 눈금 `+0xac0` 둘이다(R15 9-1) — 담장 틱 `+0xaa4` 는 안 본다.
 */
export function isBigHit({ resultCode, poleTick, carryScale }: BigHitInput): boolean {
  if (poleTick >= 0) return false
  if (resultCode === null || !BIG_HIT_CODES.has(resultCode)) return false
  return carryScale > CARRY_THRESHOLD
}

/**
 * 원본 각 `+0xfcc` 가 **−0x7e < 각 < −0x36**(경계 미포함)인 구간 (0x406a4 406ae~406b6: `각 + 0x36 < 0` · `각 + 0x7e > 0`).
 * 원본은 수평각을 부호 뒤집어 넣으므로 웹 패턴의 각(45~135)으로는 **54 < 각 < 126**, 곧 파울선 쪽을 뺀 가운데 부채꼴이다.
 */
const CENTER_ANGLE = { exclusiveMinimum: 54, exclusiveMaximum: 126 }
/** `[+0x204]+0xaa0 − 7` 의 7 */
const LANDING_MARGIN = 7

/**
 * 큰 타구를 붙잡아 두는 틱 = `0x406a4` 문턱 (직접 뜸):
 * ```
 * 406ac  각 = s16 경기+0xfcc
 * 406b0  각 + 0x36 < 0 이고 각 + 0x7e > 0 → [[경기+0x204]+0xaa0] − 7        ; 가운데 — 낙구틱 − 7
 * 406cc  아니면                           → [[경기+0x204]+0xaa0] >> 1       ; 낙구틱의 절반(빼기 없음)
 * ```
 * 0x406e8 은 `문턱 ≤ 공 틱` 이면 넘기므로 음수 문턱은 첫 틱에 넘는다 — 자르지 않는다.
 */
export function bigHitHoldTicksOf(angle: number, landingTick: number): number {
  const isCenter = angle > CENTER_ANGLE.exclusiveMinimum && angle < CENTER_ANGLE.exclusiveMaximum
  return isCenter ? landingTick - LANDING_MARGIN : landingTick >> 1
}

/** 플래그가 꺼진 갈래의 이른 넘김이 보는 결과 코드 상한 — 0x4071a `+0xfd4 ≤ 2`(부호 없는 비교) */
const EARLY_RESULT_CODE_MAX = 2
/** 이른 넘김의 기준점 0xcfaa4 = (25068, 0, 23275) — 거리는 x·z 둘만 본다(0xbf9f0) */
const EARLY_REFERENCE = { x: 25068, z: 23275 } as const
/** 거리 ÷ 265(0x109) 가 40~55 (0x40780 `− 0x28 ≤ 0xf` 부호 없는 비교) */
const EARLY_DISTANCE_DIVISOR = 265
const EARLY_DISTANCE_MIN = 40
const EARLY_DISTANCE_SPAN = 15

/** 정수 제곱근(내림) — 0x6c64d 자리 */
const integerSquareRoot = (value: number) => Math.floor(Math.sqrt(value))

/**
 * **공 경로 땅 번호 +0x1090** — 0x13 진입 0x3d720 이 부르는 0x33e34 가 [경기+0xf2c] 공의 점 i 마다
 * 높이를 `y − 400` 으로 옮기고 599 이하면 `(6 × (y − 400) + 2400) / 10` 으로 줄인 값(33e9c~33ed8 — 곧 `trunc(6y / 10)`)이
 * **처음 0 이 된 i** 를 적는다(33f44~33f52). 없으면 −1.
 */
export function groundPathIndexOf(trajectory: { readonly length: number; pointAt(tick: number): { readonly y: number } }): number {
  for (let index = 0; index < trajectory.length; index += 1) {
    const y = trajectory.pointAt(index).y
    const adjusted = y - 400 > 599 ? y - 400 : Math.trunc((6 * (y - 400) + 2400) / 10)
    if (adjusted === 0) return index
  }
  return -1
}

/**
 * 플래그가 꺼진 갈래의 **이른 넘김 틱** (0x406e8 4071a~40784, 직접 뜸):
 * ```
 * 4071a  +0xfd4(결과 코드) ≤ 2 (부호 없음)
 * 40724  g = +0x1090 ≠ −1 이고 g == 공 틱(+0x1098) + 1
 * 40744  p = [경기+0xf2c] 공의 g 번째 점(0xa25b0)
 * 40774  isqrt((p.x − 25068)² + (p.z − 23275)²) ÷ 265 − 40 ≤ 15 (부호 없음)   → 넘긴다
 * ```
 * 곧 조건이 맞으면 공 틱 g − 1 에 넘긴다(틱 8 보다 이르면). 맞지 않으면 null.
 * ⚠️ [경기+0xf2c] 는 타구 순간 0x50faa 가 같은 타격점 0xcfb64 = (20000, 1000, 30000) 에 놓고 0x51408 51722 가 같은 vt44 로
 *    쏘는 공이다 — 판 공 [경기+0x204] 와 같은 궤적으로 본다(유력 — 그 공의 세계 충돌 깔기는 따로 확인하지 않았다).
 */
export function earlyHitPauseTickOf(
  resultCode: number,
  trajectory: { readonly length: number; pointAt(tick: number): { readonly x: number; readonly y: number; readonly z: number } },
): number | null {
  if (resultCode < 0 || resultCode > EARLY_RESULT_CODE_MAX) return null
  const ground = groundPathIndexOf(trajectory)
  if (ground < 1) return null
  const point = trajectory.pointAt(ground)
  const distance = integerSquareRoot((point.x - EARLY_REFERENCE.x) ** 2 + (point.z - EARLY_REFERENCE.z) ** 2)
  const scaled = Math.trunc(distance / EARLY_DISTANCE_DIVISOR) - EARLY_DISTANCE_MIN
  if (scaled < 0 || scaled > EARLY_DISTANCE_SPAN) return null
  return ground - 1
}

export interface HitPauseInput extends BigHitInput {
  /** 패턴 수평각 (45 = 1루 파울선 · 90 = 가운데 · 135 = 3루 파울선) */
  readonly angle: number
  /** 낙구 틱 (원본 공 +0xaa0) */
  readonly landingTick: number
  /** 플래그가 꺼진 갈래의 이른 넘김 틱 (`earlyHitPauseTickOf`). 없으면 null */
  readonly earlyTick?: number | null
}

/** 상태 0x13 이 화면을 붙잡아 두는 틱 수. */
export function hitPauseTicksOf(input: HitPauseInput): number {
  if (!isBigHit(input)) {
    // 0x40714 상태 틱 == 8 이면 넘김 — 그 전에 이른 넘김 조건이 서면 그 틱(0x4071a~0x40784)
    const early = input.earlyTick ?? null
    return early !== null && early < SHORT_HIT_TICKS ? early : SHORT_HIT_TICKS
  }
  return bigHitHoldTicksOf(input.angle, input.landingTick)
}

/**
 * 상태 0x13 의 **OK(−5)·'5' 건너뛰기** — 0x406e8 40708~40712 는 플래그 `+0x199a` 가 켜진 갈래에만 키를 본다.
 * 꺼진 타구(틱 8 · 이른 넘김)는 키로 못 건너뛴다.
 */
export function canSkipHitPause(watchesBigHit: boolean): boolean {
  return watchesBigHit
}

/**
 * 방금 친 공의 궤적에서 0x13 판정에 쓸 값을 꺼낸다.
 *
 * 원본은 타구 순간 공 객체에 깔아 둔 점 목록에서 `+0xaa0`(낙구 틱)·`+0xab0`(폴 틱)·`+0xac0`(거리)
 * 을 그대로 읽는다. 웹은 그 점 목록을 `battedBallFlight` 가 **근사로** 다시 만들므로
 * 여기서 나오는 틱·거리도 그만큼 **근사다**.
 * 패턴을 못 찾으면(있을 수 없는 코드) 붙잡지 않는 쪽 — 폴 접촉으로 두어 틱 8 이 된다.
 */
export function pauseInputOf(resultCode: number, deck: PatternDeck): HitPauseInput {
  const pattern = lastDrawnPattern(deck, resultCode)
  if (pattern === null) return { resultCode, angle: 90, landingTick: 0, poleTick: 0, carryScale: 0, earlyTick: null }
  const trajectory = battedBallTrajectory(pattern)
  return {
    resultCode,
    angle: pattern[0],
    landingTick: trajectory.landingTick,
    poleTick: trajectory.poleTick,
    carryScale: trajectory.carryScale,
    earlyTick: earlyHitPauseTickOf(resultCode, trajectory),
  }
}
