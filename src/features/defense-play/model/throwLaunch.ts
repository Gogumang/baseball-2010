import type { BallBody, BallPoint } from '@/entities/batting/model/ballPhysics'
import { thrownBallTrajectory, type BallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { NO_THROW_ERROR, rollThrowError, type ThrowErrorResult } from '@/entities/fielding/model/fieldingErrors'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import {
  bounceThrowLaunchOf,
  errantThrowFlight,
  rollLongThrowWobble,
  throwGravityPercentOf,
  throwLaunchOf,
  throwTicksTo,
  wobbledThrowFlight,
  type ThrowLaunch,
} from '@/entities/fielding/model/throwPlan'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **송구 공 쏘기** — 던지기 0xa1620(또는 레이저 0xa222c)가 공을 놓고 쏜 뒤, 송구 0xb2e38 이 같은 공을 세계 0xbfed0 으로 깔고
 * 받는 점을 끼워 넣기까지 (직접 뜬 것):
 * ```
 * a1640  놓는 점 = (야수 x, 1000, 야수 z) · a16d0 받는 점 = (점 x, 1000, 점 z)      ; 점 = 받을 야수 R(계획 [3]) 의 목표 +0x2c
 * a16dc  +0xdc = 특수 ? +0xd8 : +0xd4                                              ; 레이저는 a229c +0xdc = 2000
 * a1708  0xa279c(공, 칸 ≤ 5 ? 70 : 80) — 중력 배율 (세계 마무리 a2b14 가 되돌림)
 * a16be  특수 && d > 20400 → 앙각을 구할 d = 20400 · 원바운드 표시
 * a173c  h · t · w = g'·t >> 1 (`throwLaunchOf`) ; a17f0 공+0xaac = 공+0xaad = 0
 * a17fc  원바운드면 rand(0, 2) ≠ 0 ? φ + 1 : φ − 1 · 공+0xaac = 1 → a19d6 (`bounceThrowLaunchOf` — 아래 두 굴림 없음)
 * a1828  rand(0, 10000) < 기준 → 악송구(a184a~a1944 — h · w · φ 흔들기 · 공+0xaac = 1)
 * a198c  아니면 d > 0x2008 → rand(0, 10000) < 특수·100 + 1000 → h · w × 85% · 공+0xaad = 1
 * a19f2  0xbef58(공, 놓는 점) · 공.vt14(받는 점) · 공.vt44(h, w, φ)
 * b2f8c  메시지 0x12 → 세계 0xbfed0 (`thrownBallTrajectory`)
 * b2f9c  공+0xaac == 0 이면 T = 던진 야수.vtb8(R 목표) — 공+0xaad == 0 이면 점[T − 1] 의 (x, y, z) = (목표 x, 1000, 목표 z)
 *        (점 20바이트 중 앞 12바이트만 — 속도 · 수직 속도 · 각 · a9c 는 세계가 깐 그대로)
 * ```
 * 레이저 0xa222c 는 굴림 없이 +0xaac = +0xaad = 0(a23ae · a23ba)이라 늘 끼워 넣는다.
 * 그 뒤 b303c~b307c: +0x1e8 = (공+0xaac == 0 && 던진 야수 ≤ 5 && C ≤ 5) · 예보 vt24(0)(움직임허용 = 공+0xaac) ·
 * 고르기 vt34 — 받는 것도 줍는 것도 보통 포구 틱 갈래(펌블 굴림 · 쥐기 0xb2710)다. 부르는 쪽이 `forecastOptionsOf` 로 예보한다.
 *
 * ⚠️ 원본 그대로 옮기지 못한 끝: T − 1 ≥ 130(공 점 칸 밖)이면 원본은 공 객체 뒤 메모리를 덮어쓰고, T = 0 이면 점 칸 앞(공+0x60)을
 *    덮는다 — 웹은 그 덮어쓰기를 옮기지 않는다(재생은 0 ~ 개수−1 로 잘라 읽으므로 T − 1 ≥ 개수면 보이지 않는다).
 */
export interface ThrownBall {
  /** 세계가 깐 송구 공 (받는 점 끼워 넣기까지 한 것) */
  readonly ball: BallTrajectory
  /** 악송구 갈래 (a184a) */
  readonly errant: boolean
  /** 긴 송구 흔들림 (a19a6 — 공+0xaad) */
  readonly wobbled: boolean
  /** 원바운드 갈래 (a17fc) */
  readonly bounce: boolean
  /** 공+0xaac — 악송구 · 원바운드. 예보의 움직임허용 · 끼워 넣기 · +0x1e8 이 이것을 본다 */
  readonly loose: boolean
  /** 악송구 굴림 결과 (a1828) */
  readonly error: ThrowErrorResult
}

export interface ThrowLaunchInput {
  /** 던지는 야수 — +0xdc(송구 속도)는 이미 이번 송구 값(`thrownWith` · 레이저 2000)이어야 한다 */
  readonly thrower: FielderState
  /** 받을 야수 R(계획 [3])의 목표점 +0x2c */
  readonly target: WorldPoint
  /** 레이저 0xa222c — 굴림이 없다 */
  readonly laser?: boolean
  /** 0xa1620 다섯째 인자(계획 [1]) */
  readonly special?: boolean
  /** 원바운드 — 특수 && 거리 > 20400 (a16be, `cpuSpecialThrowOf`) */
  readonly bounce?: boolean
  /** 던지는 야수 수비 능력 — 악송구 기준 +0xe4 */
  readonly ability: number
  /** 없으면 굴리지 않는다(이 진행기들의 규약) */
  readonly random?: RandomPort
  /** 이어 받을 공 객체 칸 */
  readonly body?: BallBody
}

/** 송구 공을 쏜다 — 위 순서 그대로. 굴림은 악송구(1 또는 5) · 흔들림(0 또는 1) · 세계 안 폴 충돌(드묾) */
export function launchThrow(input: ThrowLaunchInput): ThrownBall {
  const { thrower, target } = input
  const special = input.special === true
  let error: ThrowErrorResult = NO_THROW_ERROR
  let launch: ThrowLaunch = throwLaunchOf(thrower, target)
  let wobbled = false
  const bounce = input.laser !== true && input.bounce === true
  if (bounce) {
    // a1802 0xbfaa0 = rand(0, 2) — 난수가 없으면 굴리지 않고 0(φ − 1)
    const turnsLeft = input.random !== undefined && input.random.rand(0, 2) !== 0
    launch = bounceThrowLaunchOf(thrower, target, turnsLeft)
  } else if (input.laser !== true && input.random !== undefined) {
    error = rollThrowError(input.ability, special, input.random)
    if (error.errant) {
      launch = errantThrowFlight(thrower, target, error, input.random)
    } else if (rollLongThrowWobble(thrower, target, special, input.random) === true) {
      launch = wobbledThrowFlight(thrower, target)
      wobbled = true
    }
  }
  const loose = error.errant || bounce
  let ball = thrownBallTrajectory({
    from: thrower.position,
    target,
    speed: launch.horizontalSpeed,
    verticalSpeed: launch.verticalSpeed,
    angle: launch.direction,
    gravityPercent: throwGravityPercentOf(thrower.slot),
    random: input.random,
    body: input.body,
  })
  if (!loose && !wobbled) {
    ball = withReceivePoint(ball, throwTicksTo(thrower, target) - 1, target)
  }
  return { ball, errant: error.errant, wobbled, bounce, loose, error }
}

/** 송구 공 예보 vt24(0) 의 칸 — 던진 야수(+0x130 · +0xb1) · 움직임허용 공+0xaac · +0x1e8 (b303c~b307c) */
export function forecastOptionsOf(
  thrown: ThrownBall,
  throwerSlot: number,
  coverSlot: number,
): {
  readonly initialChaserSlot: number
  readonly thrownSlot: number
  readonly secondPass: { readonly movable: boolean }
  readonly onlySlot?: number
} {
  const infieldOnly = !thrown.loose && throwerSlot <= 5 && coverSlot <= 5
  return {
    initialChaserSlot: throwerSlot,
    thrownSlot: throwerSlot,
    secondPass: { movable: thrown.loose },
    onlySlot: infieldOnly ? coverSlot : undefined,
  }
}

/** 받는 점 높이 — b2fd6 `movs #0xfa ; lsls #2` */
const RECEIVE_HEIGHT = 1_000

/**
 * b2f9c~b303a — 점[index] 의 앞 12바이트(x, y, z)만 (목표 x, 1000, 목표 z) 로 덮는다. 개수(+0x6c) · 낙구 aa0 · 사건 틱은 세계가
 * 이미 정했으니 그대로다. 재생 0xa2b78 은 0 ~ 개수−1 로 잘라 읽으므로 index 가 그 밖이면 보이지 않는다.
 */
function withReceivePoint(ball: BallTrajectory, index: number, target: WorldPoint): BallTrajectory {
  if (index < 0 || index >= ball.length) return ball
  const at = (tick: number): number => Math.max(0, Math.min(ball.length - 1, Math.trunc(tick)))
  const point = { x: target.x, y: RECEIVE_HEIGHT, z: target.z }
  return {
    ...ball,
    pointAt: (tick: number) => (at(tick) === index ? point : ball.pointAt(tick)),
    pointDetailAt: (tick: number): BallPoint =>
      at(tick) === index ? { ...ball.pointDetailAt(tick), ...point } : ball.pointDetailAt(tick),
  }
}
