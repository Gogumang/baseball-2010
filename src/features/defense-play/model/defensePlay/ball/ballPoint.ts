import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'

/**
 * 공이 담장 뒤로 사라졌나 — 0x17 공 그리기 0x36dfc 머리(36e2a~36ea4, 직접 뜸):
 * ```
 * 36e2a  r7 = P+0x111(홈런) && 공+0x68 > 공+0xaa0 + 2 && 공+0x68 > 공+0xaa4 + 6
 * 36e5c  r6 = 공+0xaa4 > 0   && 공+0x68 > 공+0xaa0 + 2 && 공+0x68 > 공+0xaa4 + 6
 * 36e86  그린다 = !r7 && 공 그림 있음 && !P+0x12c(쥠) && !r6
 * ```
 * 공+0x68 · aa0 · aa4 는 웹에서 판 틱 · `ballLandingTick` · `trajectory.fenceTick`(다시 쏜 공은 판 틱으로 옮긴 값 — 비교는 같다).
 * aa4 > 0 은 "담장선 넘는 틱이 있다" 로 읽는다(웹은 없으면 −1).
 */
export function isBallBeyondFence(tick: number, landingTick: number, fenceTick: number, homeRunFlag: boolean): boolean {
  return (fenceTick > 0 || homeRunFlag) && tick > landingTick + 2 && tick > fenceTick + 6
}

interface BallPointInput {
  readonly tick: number
  readonly trajectory: BattedBallTrajectory
  readonly catchTick: number
  readonly fielders: readonly FielderState[]
  /** 공 가진(마지막으로 쥔) 야수 P+0x130 */
  readonly holderSlot: number
  /** 지금 누가 쥐고 있나 P+0x12c */
  readonly held: boolean
  /** 아무도 잡지 않는 타구인가 — 그러면 공은 끝까지 궤적 위에 있다 */
  readonly uncatchable: boolean
}

/**
 * 이번 틱에 공이 어디 있나 — **아무도 안 쥐었으면(+0x12c == 0) 궤적, 쥐었으면 쥔 야수 손.**
 *
 * 원본 공 그리기 0x36dfc(직접 뜸, r313): [장면+0x204] 공의 자리는 늘 0xa25d4(공) = 0xa25b0(공, 공+0x68) — **지금 재생 틱의 궤적 점**이다
 * (36ea6~36eae). 공을 그릴지는 [sp+0x58] = 홈런 숨김(36e2a~36e80 — 웹 `ballBeyondFence`) 아님 && 플레이+0x12c(쥠) == 0 (36e8a~36ea4)이 정한다.
 * 쥐지 않은 동안은 그림마다 0x3f378(G4)이 공+0x68 을 올리므로 공은 받는 틱이 지나도(못 받았거나 판 끝) 궤적을 따라 계속 간다.
 * 쥐었으면 공 그림은 안 그리고(`defenseView` 의 `isHeld`), 그 자리는 웹 카메라 · 포구 동작이 보는 쥔 야수 손으로 둔다.
 *
 * **송구 공도 궤적이다** (A-29, 2026-10-27): 송구 0xb2e38 은 0xa1620(레이저 0xa222c)이 쏜 세계 공을 b2f8c 의 0xbfed0 으로 깔고
 * b2f9c 가 점[T − 1] 에 받는 점 (목표 x, 1000, 목표 z) 을 끼운다 — 웹 `launchThrow` 가 같은 공을 짓고 `takeLooseBall` 이 이 틱부터
 * 판 궤적에 잇는다(`spliceTrajectory`).
 * (r313 정정: 예전 웹은 받는 틱이 지났는데 안 쥔 공을 마지막 송구의 루 자리(판 끝 240틱으로 잘린 송구)나 공 가진 야수 자리
 * (홈런 · 파울 · 못 잡고 떨어진 공)에 그렸다 — 둘 다 원본에 없는 근사라 걷었다)
 */
export function ballPointAt(input: BallPointInput): WorldPoint {
  if (input.uncatchable || !input.held || input.tick < input.catchTick) return input.trajectory.pointAt(input.tick)
  const holder = input.fielders[input.holderSlot] ?? input.fielders[0]
  return holder.position
}

/** 0xa100c(야수, x, 0, z) — 추적야수 AI 1 의 목표는 포구 틱 공 점의 높이를 버린 땅 위 점이다 (b4b50~b4b5a) */
export function groundPointOf(point: WorldPoint): WorldPoint {
  return { x: point.x, y: 0, z: point.z }
}

/**
 * 공.vt18 = 0xa27f0 — 지금 점의 속도 · 수직 속도 워드 == 0 && 높이 0 이면 멈춘 공.
 * 손으로 만든 시험 궤적(원본 칸 없음)은 마지막 점을 멈춘 점으로 본다.
 */
export function isBallStoppedAt(trajectory: BattedBallTrajectory, tick: number): boolean {
  return trajectory.isStoppedAt === undefined ? tick >= trajectory.length - 1 : trajectory.isStoppedAt(tick)
}
