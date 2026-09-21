import { battedBallTrajectory, carryDistanceOf, FENCE_DISTANCE } from '@/entities/batting/model/battedBallFlight'
import { lastDrawnPattern } from '@/entities/batting/model/battedBallOutcome'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'

/**
 * **상태 0x13 (19) = 배트에 맞은 직후 짧은 연출** (R10 4절 확정 · R15 9절 확정).
 *
 * 흐름: 투구 비행(0x11) 에서 맞았다고 판정되면 0x13 으로 갔다가 **늘 인플레이(0x17)** 로 나간다.
 * 붙잡아 두는 시간은 감상 플래그 `+0x199a` 가 고른다.
 *   - 켜졌으면(큰 타구): 공 틱이 `0x406a4` 문턱을 넘을 때까지 기다린다. **OK(−5)·'5' 로 건너뛴다.**
 *   - 꺼졌으면: **틱 8** 에 바로 넘어간다.
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

/**
 * 낙구 지점까지의 거리 → 원본 `공+0xac0` 눈금 (0~160).
 *
 * 원본은 `min(거리 × 0x109…, 160)` 인데(E 2-1b) 곱하는 상수의 남은 자리도, 그 거리가
 * 어떤 단위인지도 문서에 없다. 그래서 **근사다** — 담장 거리(`FENCE_DISTANCE`)를 눈금 160 으로 본다.
 * 그러면 문턱 111 은 담장의 약 70% 지점(≈ 18000)이 된다.
 */
export function carryScaleOf(distance: number): number {
  if (distance <= 0) return 0
  return Math.min(CARRY_SCALE_MAX, Math.trunc((distance * CARRY_SCALE_MAX) / FENCE_DISTANCE))
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
 * 같은 판정이 타구음 7 · "!" 효과도 고르지만 그쪽은 이 화면에 아직 없다.
 *
 * 웹의 `fenceTick` 은 담장을 **넘어간** 공에도 서므로 원본의 "담장/폴 미접촉" 과 극성이 다르다.
 * 원본이 실제로 보는 칸은 폴 틱 `+0xab0` 하나뿐이라(R15 9-1) 여기서도 `poleTick` 만 본다.
 */
export function isBigHit({ resultCode, poleTick, carryScale }: BigHitInput): boolean {
  if (poleTick >= 0) return false
  if (resultCode === null || !BIG_HIT_CODES.has(resultCode)) return false
  return carryScale > CARRY_THRESHOLD
}

/**
 * 원본 각 `+0xfcc` 가 −0x7e..−0x36 인 구간. 원본은 수평각을 부호 뒤집어 −135..−45 로 넣으므로
 * 웹 패턴의 각(45~135)으로는 **54~126**, 곧 파울선 쪽을 뺀 가운데 부채꼴이다.
 */
const CENTER_ANGLE = { minimum: 54, maximum: 126 }
/** `[+0x204]+0xaa0 − 7` 의 7 */
const LANDING_MARGIN = 7

/**
 * 큰 타구를 붙잡아 두는 틱 = `0x406a4` 문턱 (R10 4절).
 * 가운데 부채꼴이면 `낙구틱 − 7`, 아니면 **그 값의 절반**이다.
 *
 * ⚠️ 문서가 "아니면 그 값 ÷ 2" 라고만 적어 "그 값" 이 `낙구틱 − 7` 인지 `낙구틱` 인지 갈린다.
 * 바로 앞 식을 가리키는 것으로 읽어 `(낙구틱 − 7) / 2` 로 두었다 — 이 갈래는 **근사다**.
 */
export function bigHitHoldTicksOf(angle: number, landingTick: number): number {
  const full = landingTick - LANDING_MARGIN
  const isCenter = angle >= CENTER_ANGLE.minimum && angle <= CENTER_ANGLE.maximum
  return Math.max(0, isCenter ? full : Math.trunc(full / 2))
}

export interface HitPauseInput extends BigHitInput {
  /** 패턴 수평각 (45 = 1루 파울선 · 90 = 가운데 · 135 = 3루 파울선) */
  readonly angle: number
  /** 낙구 틱 (원본 공 +0xaa0) */
  readonly landingTick: number
}

/** 상태 0x13 이 화면을 붙잡아 두는 틱 수. */
export function hitPauseTicksOf(input: HitPauseInput): number {
  if (!isBigHit(input)) return SHORT_HIT_TICKS
  return bigHitHoldTicksOf(input.angle, input.landingTick)
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
  if (pattern === null) return { resultCode, angle: 90, landingTick: 0, poleTick: 0, carryScale: 0 }
  const trajectory = battedBallTrajectory(pattern)
  return {
    resultCode,
    angle: pattern[0],
    landingTick: trajectory.landingTick,
    poleTick: trajectory.poleTick,
    carryScale: carryScaleOf(carryDistanceOf(trajectory)),
  }
}
