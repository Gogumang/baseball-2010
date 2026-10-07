import type { BallBody, BallPoint } from '@/entities/batting/model/ballPhysics'
import { isBallTrajectory, launchTrajectory, type BallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { forecastCatch, type CatchForecastOptions } from '@/features/defense-play/model/catchForecast'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * **판 도중 깐 공을 누가 언제 줍나** — 타구가 없는 판(견제 `pickoffPlay` · 도루/폭투 `runnerPlayEngine`)이 쓰는 뒤처리.
 * 타구 진행기 `runDefensePlay` 의 `takeLooseBall` · `relaunchFromFielder` 와 같은 원본 길이다:
 * - 송구 0xb2e38 b307c: 예보 vt24(0) · 고르기 vt34(0xb3b38) — 받을(주울) 야수 +0x130 · 포구 틱 +0x174
 * - 다시 쏘기 0xb3148 b3294: 예보 vt24(1) · vt34
 * 공+0x68 = 0(b12da)이라 새 궤적은 그 판 틱부터 0 번 점이다. 추적야수 AI 1(0xb4aca~0xb4afe)은 포구 틱 점의 (x, 0, z) 로 간다.
 */
export interface LooseBallChase {
  /** 판 틱으로 읽는 궤적 — 깐 틱부터 새 공의 0 번 점 */
  readonly trajectory: BattedBallTrajectory
  /** 고른 야수 (+0x130 = +0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174, 판 틱) */
  readonly catchTick: number
  /** AI 1 목표 — 포구 틱 점의 (x, 0, z) */
  readonly catchPoint: WorldPoint
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 (원본 공은 한 경기 내내 같은 객체) */
  readonly body?: BallBody
}

/** 예보 칸 — 필살수비 창 · +0x127 은 타구 판(메시지 0x11 · 0x51408)만 세운다. 이 판들에선 늘 꺼져 있다 */
export type LooseBallForecastOptions = Pick<
  CatchForecastOptions,
  'initialChaserSlot' | 'thrownSlot' | 'secondPass' | 'onlySlot'
>

/** 새 공 `ball` 을 판 틱 `atTick` 부터 잇고 예보 0xb12d0 · 고르기 0xb3b38 로 줍는 야수 · 틱을 정한다 */
export function chaseLooseBall(
  ball: BallTrajectory,
  atTick: number,
  fielders: readonly FielderState[],
  options: LooseBallForecastOptions,
  maximumTicks: number,
): LooseBallChase {
  const forecast = forecastCatch(ball, fielders, { from: 0, to: Number.POSITIVE_INFINITY }, options)
  const catchTick = Math.max(atTick, Math.min(atTick + forecast.choice.catchTick, maximumTicks))
  const at = ball.pointAt(catchTick - atTick)
  return {
    trajectory: startingAt(ball, atTick),
    slot: forecast.choice.slot,
    catchTick,
    catchPoint: { x: at.x, y: 0, z: at.z },
    body: ball.flight.body,
  }
}

/** 판이 처음부터 쫓는 공(폭투 · 포일 0xb284a)을 같은 꼴로 */
export function initialLooseBallChase(
  trajectory: BattedBallTrajectory,
  slot: number,
  catchTick: number,
): LooseBallChase {
  const at = trajectory.pointAt(catchTick)
  return {
    trajectory,
    slot,
    catchTick,
    catchPoint: { x: at.x, y: 0, z: at.z },
    body: isBallTrajectory(trajectory) ? trajectory.flight.body : undefined,
  }
}

/**
 * **플레이.vt70 = 0xb3148 — 공을 그 야수에게서 튕겨 다시 쏜다** (직접 뜬 것, `runDefensePlay.relaunchFromFielder` 와 같다):
 * ```
 * b3148 p = 공.vt60(지금 점) ; 속도 = max(p.속도·60/100, 300) · v0 = min(p.수직속도·30/100, 100) · 각 = p.각 + rand(−20, 20)
 * b3200 0xbef58(공, 야수 위치) · 공.vt44(속도, v0, 각) · 메시지 0x12 → 세계 0xbfed0
 * ```
 * 원본 점 칸이 없는 손으로 만든 궤적이면 다시 쏠 수 없어 null.
 */
export function bounceOffFielder(
  chase: LooseBallChase,
  tick: number,
  from: WorldPoint,
  random: RandomPort | undefined,
): { readonly ball: BallTrajectory; readonly speed: number; readonly verticalSpeed: number; readonly angle: number } | null {
  if (!isBallTrajectory(chase.trajectory)) return null
  const point = chase.trajectory.pointDetailAt(tick)
  const speed = Math.max(Math.trunc((point.speed * 60) / 100), 300)
  const verticalSpeed = Math.min(Math.trunc((point.verticalSpeed * 30) / 100), 100)
  // rand(−20, 20) — 난수가 없으면 굴리지 않고 0 (이 진행기들의 규약)
  const turn = random === undefined ? 0 : randomIntegerBelow(random, -20, 20)
  const angle = point.angle + turn
  const ball = launchTrajectory({ from, speed, verticalSpeed, angle, random, body: chase.body })
  return { ball, speed, verticalSpeed, angle }
}

/** 판 틱 `atTick` 부터 0 번 점인 궤적 — 그 앞 틱은 0 번 점(재생 0xa2b78 이 0 으로 자른다) */
function startingAt(ball: BallTrajectory, atTick: number): BallTrajectory {
  const shift = (tick: number) => (tick < 0 ? -1 : tick + atTick)
  return {
    ...ball,
    length: atTick + ball.length,
    pointAt: (tick: number) => ball.pointAt(tick - atTick),
    pointDetailAt: (tick: number): BallPoint => ball.pointDetailAt(tick - atTick),
    isStoppedAt: (tick: number) => ball.isStoppedAt(tick - atTick),
    landingTick: shift(ball.landingTick),
    fenceTick: shift(ball.fenceTick),
    wallTick: shift(ball.wallTick),
    poleTick: shift(ball.poleTick),
    startedAtPlate: false,
  }
}
