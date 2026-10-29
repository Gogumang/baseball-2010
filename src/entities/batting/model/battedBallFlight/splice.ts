import { BASE_POSITIONS, horizontalDistance, type BattedBallTrajectory, type WorldPoint } from '@/entities/batting/model/battedBallFlight/otherSlices'
import type { BallTrajectory } from '@/entities/batting/model/battedBallFlight/launch'

/**
 * 판 도중 다시 쏜 공을 앞 궤적 뒤에 잇는다 — 펌블·필살타법 타구가 야수에게 맞고 튕기는 0xb3148 처럼.
 * 다시 쏘면 공+0x68 이 0 으로 돌아가고(예보 b12da 의 0xa25ad(공, 0)) 재생이 그 틱부터 다시 센다. 진행기는 판 틱으로
 * 점을 읽으므로 `atTick` 부터는 새 궤적의 0 번 점이다.
 * - 사건 틱 aa4 · ab0 · aa8 은 새 궤적의 것(state[0x20] · [0x80] 은 0xb3148 b3282 · b328a 가 새 값으로 다시 적는다)
 * - 낙구 aa0 은 앞 궤적이 이미 땅에 닿았으면 그 틱 그대로(state[0x1e] · +0x112 는 한 번 서면 판 끝까지 남는다), 아니면 새 궤적의 것
 */
export function spliceTrajectory(base: BattedBallTrajectory, atTick: number, next: BallTrajectory): BallTrajectory {
  const shift = (tick: number) => (tick < 0 ? -1 : tick + atTick)
  const landedBefore = base.landingTick >= 0 && base.landingTick < atTick
  return {
    length: atTick + next.length,
    pointAt: (tick: number) => (tick < atTick ? base.pointAt(tick) : next.pointAt(tick - atTick)),
    pointDetailAt: (tick: number) => {
      if (tick >= atTick) return next.pointDetailAt(tick - atTick)
      const point = base.pointAt(tick)
      return { ...point, speed: 0, verticalSpeed: 0, angle: 0, bounceMark: 0, ...base.pointDetailAt?.(tick) }
    },
    isStoppedAt: (tick: number) => (tick < atTick ? base.isStoppedAt?.(tick) === true : next.isStoppedAt(tick - atTick)),
    landingTick: landedBefore ? base.landingTick : shift(next.landingTick),
    fenceTick: shift(next.fenceTick),
    wallTick: shift(next.wallTick),
    poleTick: shift(next.poleTick),
    carryScale: next.carryScale,
    deepHit: next.deepHit,
    startedAtPlate: false,
    flight: next.flight,
    launchBody: next.launchBody,
    // 플레이 +0x127 — 다시 쏘기(0xb3148)는 안 건드린다
    landingChase: base.landingChase,
  }
}

/**
 * 공+0x68(재생 틱)이 **한 판 틱 동안 안 오른** 궤적 — 진행기는 판 틱으로 점을 읽으므로 `atTick` 의 점을 `atTick − 1` 의 점으로 하나
 * 끼워 넣고 그 뒤 점 · 사건 틱(aa0 · aa4 · aa8 · ab0)을 한 칸씩 민다. 공+0x68 을 올리는 곳은 그리기 뒤 0x3f378(3f3c6 → 0xa2594) 하나라
 * (리터럴 0xa2595 는 0x3f4c4 하나) 그리기가 없는 키 건너뛰기(+0xfe7) 되풀이 52b26~52b40 동안은 공이 서 있다.
 */
export function holdTrajectoryAt<T extends BattedBallTrajectory>(base: T, atTick: number): T {
  const shift = (tick: number) => (tick < 0 || tick < atTick ? tick : tick + 1)
  const from = (tick: number) => (tick < atTick ? tick : tick - 1)
  return {
    ...base,
    length: base.length + 1,
    pointAt: (tick: number) => base.pointAt(from(tick)),
    ...(base.pointDetailAt === undefined ? {} : { pointDetailAt: (tick: number) => base.pointDetailAt!(from(tick)) }),
    ...(base.isStoppedAt === undefined ? {} : { isStoppedAt: (tick: number) => base.isStoppedAt!(from(tick)) }),
    landingTick: shift(base.landingTick),
    fenceTick: shift(base.fenceTick),
    poleTick: shift(base.poleTick),
    ...(base.wallTick === undefined ? {} : { wallTick: shift(base.wallTick) }),
  }
}

/** 궤적이 담장(또는 파울 관중석) 위로 넘었는가 — 공 +0xaa4 */
export function clearedFence(trajectory: BattedBallTrajectory): boolean {
  return trajectory.fenceTick >= 0
}

/** 낙구 지점 (공 +0xaa0 의 점 — 없으면 0xa2b78 이 자르는 대로 점 0). 화면·수비가 "어디로 뛸까" 의 기준으로 쓴다 */
export function landingPointOf(trajectory: BattedBallTrajectory): WorldPoint {
  return trajectory.pointAt(trajectory.landingTick)
}

/** 홈에서 낙구 지점까지의 거리 — 타구가 얼마나 멀리 갔나 */
export function carryDistanceOf(trajectory: BattedBallTrajectory): number {
  return horizontalDistance(BASE_POSITIONS[0], landingPointOf(trajectory))
}
