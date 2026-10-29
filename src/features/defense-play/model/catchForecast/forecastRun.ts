import {
  type BattedBallTrajectory,
  CATCH_KIND,
  type CatchOpportunity,
  type CatchTable,
  DIVE_DISTANCE,
  EMPTY_CATCH_TABLE,
  HEIGHT_WINDOW,
  approachedDistanceOf,
  catchKindsAt,
} from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { type ForecastClone, forecastClonesOf, isCloneUnlocked, tickClone } from '@/features/defense-play/model/catchForecast/forecastClone'
import { type CatchForecastOptions, DIVE_TICK_NONE } from '@/features/defense-play/model/catchForecast/forecastTypes'

/** 예보 한 번의 칸 — 표 · 복제 · 움직임허용 · 두 번째 패스 · 남은틱 · 다이빙 후보 (0xb12d0 의 지역 칸) */
export interface ForecastRun {
  readonly trajectory: BattedBallTrajectory
  readonly window: { readonly from: number; readonly to: number }
  readonly options: CatchForecastOptions
  readonly table: { -readonly [K in keyof CatchTable]: CatchOpportunity | null }
  readonly clones: ForecastClone[]
  readonly initialChaserSlot: number
  /** vt14 → 0xa100c(야수, x, 0, z) — 낙구 지점의 높이는 버린다 */
  readonly landingTarget: WorldPoint
  /** 움직임허용 — a = 1 이면 모두. a = 0 이면 공+0xaac(악송구 · 원바운드 송구)일 때만 */
  movable: boolean
  firstPass: boolean
  remainingTicks: number
  readonly diveTicks: number[]
  readonly diveDistances: number[]
}

/** 표를 만들 때 살펴볼 최대 틱 — 원본은 끝이 없다(첫 포구 가능 틱 뒤 5틱에서 끝). n 이 쌓여 그 전에 늘 누군가 닿는다 */
const FORECAST_TICKS = 200

/** 첫 포구 가능 틱(+0x11c)이 잡힌 뒤 더 보는 틱 수 — 원본 `남은틱 = 5` (0xb185e) */
const EXTRA_TICKS_AFTER_FIRST = 5
/** +0x19c[칸] 의 첫 값 (b1330 0x270f) */
const DIVE_DISTANCE_START = 9999
/** 추적야수를 건너뛰는 구간 (P2 2a) */
const CHASER_SKIP_TICKS = 4

export function openForecastRun(
  trajectory: BattedBallTrajectory,
  fielders: readonly FielderState[],
  window: { readonly from: number; readonly to: number },
  options: CatchForecastOptions,
): ForecastRun {
  const landing = trajectory.pointAt(trajectory.landingTick)
  return {
    trajectory,
    window,
    options,
    table: { ...EMPTY_CATCH_TABLE },
    clones: forecastClonesOf(fielders, options.thrownSlot),
    initialChaserSlot: options.initialChaserSlot ?? 1,
    landingTarget: { x: landing.x, y: 0, z: landing.z },
    movable: options.secondPass === undefined ? true : options.secondPass.movable,
    firstPass: options.secondPass !== undefined,
    remainingTicks: EXTRA_TICKS_AFTER_FIRST,
    diveTicks: fielders.map(() => DIVE_TICK_NONE),
    diveDistances: fielders.map(() => DIVE_DISTANCE_START),
  }
}

/** 표를 만들 때 살펴볼 마지막 틱 */
export function lastForecastTickOf(run: ForecastRun): number {
  return Math.min(run.window.to, FORECAST_TICKS)
}

export interface ForecastAt {
  readonly index: number
  readonly fielder: FielderState
  readonly tick: number
  readonly ball: WorldPoint
}

/** 한 틱 · 한 야수의 복제 — b13e4 건너뛰기 → b1416 움직임 → b146c 관문 → b14d0 정지 · 다이빙 후보 · 판정 → b17fc 복제 틱 */
export function forecastFielderTick(run: ForecastRun, at: ForecastAt): void {
  if (isChaserSkipTick(run, at)) return
  const clone = run.clones[at.index]
  const motion = cloneMotionOf(run, at.tick)
  if (motion.standing) clone.runTicks += 1
  const unlocked = isCloneUnlocked(clone)
  // b1416 vt14 = 0xa14c8 — +0xb4 ≤ 0 · vtc8(+0xb1 == 0 && +0xcc ≤ 0)일 때만 목표를 받는다(잠긴 복제는 앞 목표 그대로)
  if (motion.runningToLanding && unlocked) clone.target = run.landingTarget
  if (!unlocked) {
    skipLockedClone(clone, motion.standing, at.fielder.speed)
    return
  }
  // b14d0 — 정지면 vt10(0xa124c → 0xbf2b0 목표 = 위치): 판정 뒤 복제 틱은 제자리다
  if (motion.standing) clone.target = clone.position
  noteDiveCandidate(run, at, motion.standing)
  if (at.tick >= run.window.from) recordCatchKinds(run, at, motion.standing)
  // b17fc 복제.vt0c — 낙구 지점으로 달리는 중이면 한 틱 이동(정지면 vt10 이 이미 멈췄다) · 움직임허용이 아니면 물려받은 목표로
  tickClone(clone, at.fielder.speed)
}

/** b13e4 — j == 추적야수(+0x130) && t ≤ 4 → 건너뜀(b1840 — 복제 틱도 안 돈다) */
function isChaserSkipTick(run: ForecastRun, at: ForecastAt): boolean {
  return at.fielder.slot === run.initialChaserSlot && at.tick <= CHASER_SKIP_TICKS
}

/**
 * b1416 — +0x127 && aa0 ≥ t 면 낙구 지점으로 달린다(정지 아님 · n 안 셈). 움직임허용이 아니면 정지도 n 도 없다.
 * 움직임허용이 아니면(a = 0 이고 공+0xaac == 0 — 보통 송구) 정지(vt10)도 낙구 달리기(vt14)도 없어 복제는 진짜 야수에게서
 * 물려받은 목표점 +0x2c 로 vt0c(0xa1284 → 0xbf158) 걸음을 그대로 걷는다 — 루로 달려가던 커버가 루에 닿아 받는다
 */
function cloneMotionOf(run: ForecastRun, tick: number): { readonly runningToLanding: boolean; readonly standing: boolean } {
  const runningToLanding = run.movable && run.options.chaseToLanding === true && run.trajectory.landingTick >= tick
  return { runningToLanding, standing: run.movable && !runningToLanding }
}

/** b146c — 관문이 닫힌 복제는 판정 없이 복제 틱만 (정지면 n 을 되돌린다) */
function skipLockedClone(clone: ForecastClone, standing: boolean, speed: number): void {
  if (standing) clone.runTicks -= 1
  tickClone(clone, speed)
}

/** 판정에 쓰는 거리 입력 — 정지면 복제는 제자리(vt10)이고 "그 사이 뛴 만큼"(속도 × n)을 거리에서 뺀다 — 원본 직선 근사 */
function approachOf(run: ForecastRun, at: ForecastAt, standing: boolean) {
  const clone = run.clones[at.index]
  return {
    slot: at.fielder.slot,
    fielder: clone.position,
    runTicks: standing ? clone.runTicks : 0,
    speed: at.fielder.speed,
    ball: at.ball,
    tick: at.tick,
    landingTick: run.trajectory.landingTick,
  }
}

/** b15d8~b1642 — 다이빙 후보: 공 첫 점이 표준 배팅 지점 · h ≤ 500 · 1000 < d ≤ 2000 · 지금까지 가장 가까운 d */
function noteDiveCandidate(run: ForecastRun, at: ForecastAt, standing: boolean): void {
  const distance = approachedDistanceOf(approachOf(run, at, standing))
  if (!run.trajectory.startedAtPlate || at.ball.y > HEIGHT_WINDOW.grounder) return
  if (distance <= DIVE_DISTANCE.minimum || distance > DIVE_DISTANCE.maximum || run.diveDistances[at.index]! <= distance) return
  run.diveTicks[at.index] = at.tick
  run.diveDistances[at.index] = distance
}

const KEY_OF_KIND: Readonly<Record<number, keyof CatchTable>> = {
  [CATCH_KIND.LOW]: 'low',
  [CATCH_KIND.CHEST]: 'chest',
  [CATCH_KIND.GROUNDER]: 'grounder',
  [CATCH_KIND.JUMP]: 'jump',
  [CATCH_KIND.SLIDE]: 'slide',
}

/** 야수마다 종류별 min(t) 를 적고 0xb3b38 이 칸 차례로 `<` 비교해 고른다 — 두 번째 패스가 t 를 되돌리면 더 이른 틱이 덮는다 */
function recordCatchKinds(run: ForecastRun, at: ForecastAt, standing: boolean): void {
  const kinds = catchKindsAt({
    ...approachOf(run, at, standing),
    jumpUnlocked: run.options.jumpUnlocked,
    slideUnlocked: run.options.slideUnlocked,
    onlySlot: run.options.onlySlot,
  })
  for (const kind of kinds) {
    const key = KEY_OF_KIND[kind]
    const entry = run.table[key]
    if (entry === null || at.tick < entry.tick || (at.tick === entry.tick && at.fielder.slot < entry.slot)) {
      run.table[key] = { tick: at.tick, slot: at.fielder.slot }
    }
  }
}
