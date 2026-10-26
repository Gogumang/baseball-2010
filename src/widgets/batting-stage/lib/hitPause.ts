import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { lastDrawnPattern } from '@/entities/batting/model/battedBallOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { earlyPassPatternOf } from '@/entities/batting/model/earlyPassBall'
import { isBigHitWatch } from '@/entities/batting/model/bigHitWatch'

/**
 * **상태 0x13 (19) = 배트에 맞은 직후 짧은 연출** (R10 4절 확정 · R15 9절 확정).
 *
 * 흐름: 투구 비행(0x11) 에서 맞았다고 판정되면 0x13 으로 갔다가 **늘 인플레이(0x17)** 로 나간다.
 * 붙잡아 두는 시간은 감상 플래그 `+0x199a` 가 고른다.
 *   - 켜졌으면(큰 타구): 공 틱이 `0x406a4` 문턱을 넘을 때까지 기다린다. **OK(−5)·'5' 로 건너뛴다.**
 *   - 꺼졌으면: **틱 8** 에 넘어간다(키로 못 건너뛴다). 결과 코드 ≤ 2 인 땅에 닿는 타구는 그보다 이를 수 있다(`earlyHitPauseTickOf`).
 *
 * 여기서는 **화면을 붙잡아 두는 시간**을 옮긴다. 그 동안의 타구 공 그림(0x13 진입 0x33e34 가 다시 채운 경로를 공용 공 그리기
 * 0x3b2f4 가 그린다)은 `hitBallPath` · `renderBattingStage` 의 `addHitBallDraws` 다 (r274).
 */

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
export function isBigHit(input: BigHitInput): boolean {
  return isBigHitWatch(input)
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
 * 웹은 이 문턱을 0x13 상태 틱(0x13 이 선 틀이 0 — 판정 틀의 다음 틀, `phaseEntryRef`)과 견준다. 0x13 에서는 공 틱 = 상태 틱이다
 * (2026-10-24 직접 떴다):
 * ```
 * 0x3d720  0x13 진입(진입 표 — 갱신보다 앞): 3d76c +0x1090 = −1 · 3d77e **+0x1098(공 틱) = 0** · 3d786 +0x10a4 = 1 · 3d78e +0x1080 = 0
 * 0x406e8  0x13 갱신: 406fe~40706 `문턱 ≤ [+0x1098]` 이면 40786 으로(0x17 예약) · 40714 꺼진 갈래는 [+0x2c] == 8
 * 0x3f378  틀 끝(53086): 상태 0x13 이면 3f428~3f440 투수 단계 ≥ 릴리스 단계 · +0x10a4(= 1) > 0 · [+0x2c] % +0x10a4 == 0 일 때 3f450 +0x1098 += 1
 * ```
 * 곧 진입 틀의 갱신은 공 틱 0 을 보고 틀 끝에 1 이 된다 — 상태 틱 k 의 갱신이 공 틱 k 를 본다(투수는 0x11 에서 이미 릴리스 단계를
 * 지났다). 다만 3f416 은 막음 바이트 [+0x10a0] 이 서 있으면 +1 을 건너뛴다 — 큰 타구 멈춤(`HIT_STOP_TICKS`)이 공 틱을 7 틀
 * 붙잡아 상태 틱 k 의 공 틱이 max(0, k − 7) 이 된다(`hitPauseTicksOf`). 이른 넘김(`earlyHitPauseTickOf`)의
 * `g == 공 틱 + 1` 은 멈춤이 없는 꺼진 갈래라 상태 틱과 같다.
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
 * `trajectory` 는 [경기+0xf2c] 공의 궤적이다 — 판 공과 수평각이 d 만큼 다른 공(`earlyPassPatternOf`).
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

/**
 * **큰 타구 멈춤** (2026-10-24 직접 떴다):
 * ```
 * 515e0  맞은 판정 0x51408 이 0x392ac 로 +0x199a 를 세운다
 * 51818  0x357e0(+0xfd4 ∈ 24~26) && +0x199a 면 5182e +0x10a0 = 1(막음) · 5183c +0x10a8 = 6
 * 3f416  틀 끝 0x3f378: +0x10a0 ≠ 0 이면 공 틱 +1 을 건너뛴다
 * 4ccba  0x13 그리기 0x4cb1c: +0x199a 이고 공 틱 == 0 인 그림마다 옛값 = +0x10a8, +0x10a8 −= 1. 옛값 < 0 이면 4ccc6 막음을 풀고
 *        4cd14 공 자리에 파티클 0xbbc85(…, 15, 10) — `016.ptc`. 4cc6c 옛값이 홀수면 번쩍임(0x75b19 …, 웹은 아직 안 그린다)
 * ```
 * +0x199a 는 0x392ac 가 홈런성(24~26)일 때만 세우므로 큰 타구는 늘 멈춘다 — 옛값 6 · 5 · … · 0 · −1 의 여덟째 그림(상태 틱 7)이
 * 막음을 풀며 016 을 쏘고, 그 틀 끝부터 공 틱이 오른다. 곧 상태 틱 k 의 갱신이 보는 공 틱은 max(0, k − 7) 이다. 0x13 이 그보다
 * 일찍 끝나면(문턱 ≤ 0 · OK 건너뛰기) 016 은 안 나가고 셈이 남지만, 다음 큰 타구가 다시 6 을 적어 남은 값은 쓰이지 않는다.
 */
export const HIT_STOP_TICKS = 7

/**
 * 상태 0x13 이 화면을 붙잡아 두는 틱 수 — 이 상태 틱의 갱신이 0x17 을 예약한다.
 * 큰 타구는 `문턱 ≤ 공 틱` 인 첫 상태 틱이라 멈춤(`HIT_STOP_TICKS`) 때문에 문턱 + 7(문턱이 0 이하면 진입 틀 0) 이다.
 */
export function hitPauseTicksOf(input: HitPauseInput): number {
  if (!isBigHit(input)) {
    // 0x40714 상태 틱 == 8 이면 넘김 — 그 전에 이른 넘김 조건이 서면 그 틱(0x4071a~0x40784)
    const early = input.earlyTick ?? null
    return early !== null && early < SHORT_HIT_TICKS ? early : SHORT_HIT_TICKS
  }
  const threshold = bigHitHoldTicksOf(input.angle, input.landingTick)
  return threshold > 0 ? threshold + HIT_STOP_TICKS : threshold
}

/**
 * 상태 0x13 의 **OK(−5)·'5' 건너뛰기** — 0x406e8 40708~40712 는 플래그 `+0x199a` 가 켜진 갈래에만 키를 본다.
 * 꺼진 타구(틱 8 · 이른 넘김)는 키로 못 건너뛴다.
 */
export function canSkipHitPause(watchesBigHit: boolean): boolean {
  return watchesBigHit
}

/**
 * **[경기+0xf2c] 공의 궤적** — 0x51408(5174c · 517ce)이 판 공과 수평각만 d 다른 패턴(`earlyPassPatternOf`)으로 쏘는 공. 0x13 의
 * 이른 넘김(0x406e8)과 0x13 공 경로(0x33e34 → `hitBallPath`)가 이 공을 본다. ⚠️ 근사(남김 — 굴림 차례): 그 공이 폴에 맞으면 원본은
 * 판 시작에서 rand(−25, 25) 로 폴 뒤 점을 다시 깐다(0xa2c64) — 그 굴림은 판 쪽(`runDefensePlay` · `derbyBattedBallOf`)이 차례만 맞추고
 * 타석은 굴림 없는 궤적을 쓴다. 폴 틱 앞 점은 같다
 */
export function hitBallTrajectoryOf(pattern: BattedBallPattern, batterHand: number) {
  return battedBallTrajectory(earlyPassPatternOf(pattern, batterHand))
}

/**
 * 방금 친 공의 궤적에서 0x13 판정에 쓸 값을 꺼낸다.
 *
 * 원본은 타구 순간 공 객체에 깔아 둔 점 목록에서 `+0xaa0`(낙구 틱)·`+0xab0`(폴 틱)·`+0xac0`(거리)
 * 을 그대로 읽는다. 웹은 그 점 목록을 `battedBallFlight` 가 **근사로** 다시 만들므로
 * 여기서 나오는 틱·거리도 그만큼 **근사다**.
 * 패턴을 못 찾으면(있을 수 없는 코드) 붙잡지 않는 쪽 — 폴 접촉으로 두어 틱 8 이 된다.
 */
export function pauseInputOf(resultCode: number, deck: PatternDeck, batterHand: number): HitPauseInput {
  const pattern = lastDrawnPattern(deck, resultCode)
  if (pattern === null) return { resultCode, angle: 90, landingTick: 0, poleTick: 0, carryScale: 0, earlyTick: null }
  const trajectory = battedBallTrajectory(pattern)
  return {
    resultCode,
    angle: pattern[0],
    landingTick: trajectory.landingTick,
    poleTick: trajectory.poleTick,
    carryScale: trajectory.carryScale,
    // 이른 넘김은 [경기+0xf2c] 공 — 판 공과 수평각이 d 다른 공을 따로 깐다 (0x5174c)
    earlyTick: earlyHitPauseTickOf(resultCode, hitBallTrajectoryOf(pattern, batterHand)),
  }
}
