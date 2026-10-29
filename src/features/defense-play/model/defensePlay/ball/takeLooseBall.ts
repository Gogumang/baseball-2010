import { type BallTrajectory, spliceTrajectory } from '@/entities/batting/model/battedBallFlight'
import { CATCH_KIND } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'
import { type CatchForecast, forecastCatch } from '@/features/defense-play/model/catchForecast'
import { groundPointOf } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { NO_FORECAST_CATCH } from '@/features/defense-play/model/defensePlay/constants'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { THROW_ERROR_MARK_TICKS } from '@/features/defense-play/model/playerEffects'

/**
 * **판 도중 새로 깐 공을 누가 줍나** — 다시 쏘기(0xb3148 b3294 vt24(1))와 악송구(0xb2e38 b307c vt24(0))가 같은 뒤처리다:
 * 공+0x68 = 0(b12da)이라 새 궤적을 이 틱부터 잇고(`spliceTrajectory`), 예보 0xb12d0 → 고르기 0xb3b38(+0x130 = 고른 야수, AI 1).
 * 필살수비 창(+0x1f5 · +0x1f6)과 +0x127 은 판 내내 남아 있는 플레이 칸이라 이 예보도 본다. 줍는 것은 보통 포구 틱 갈래
 * (펌블 굴림 · 쥐기 0xb2710)다. state[0x1f] 는 다시 쏘기(b323c)만 지운다 — 송구 0xb2e38 은 안 건드린다.
 */
export function takeLooseBall(s: DefensePlayState, t: TickFrame, next: BallTrajectory, options: LooseBallOptions): void {
  s.receivingThrow = false
  s.trajectory = spliceTrajectory(s.trajectory, t.tick, next)
  s.ballSegmentStart = next.pointAt(0)
  s.ballLandingTick = next.landingTick < 0 ? -1 : t.tick + next.landingTick
  // b12da — 공+0x68 = 0 : 이 그림은 공을 안 그린다(0x36dfc 36e24)
  s.ballLaunchTick = t.tick
  const forecast = forecastCatch(
    next,
    s.fielders,
    { from: 0, to: Number.POSITIVE_INFINITY },
    {
      ...options,
      jumpUnlocked: s.specialDefense.jumpUnlocked,
      slideUnlocked: s.specialDefense.slideUnlocked,
      chaseToLanding: s.landingChase,
    },
  )
  // b1376~b1398 · b189a — 움직임 허용 +0x13c 는 예보마다 다시 적힌다(AI 1 b4af6 이 본다, r196)
  s.forecastMovable = forecast.movable
  // b188a — 송구 예보(a = 0)가 궤적 끝까지 못 줍고 두 번째 패스로 가면 그때의 +0x130(= 던진 야수, b307c 앞)의 +0xc0 = 4
  const thrower = options.thrownSlot
  if (forecast.secondPassStarted && thrower !== undefined) {
    s.throwErrorMarks = s.throwErrorMarks.map((value, slot) => (slot === thrower ? THROW_ERROR_MARK_TICKS : value))
  }
  clearDeadlyArmsAfterChoice(s, forecast.choice.kind)
  applyForecastChoice(s, t, next, forecast)
}

/** 판 도중 깐 공의 예보 옵션 (`forecastOptionsOf` · 다시 쏘기) */
export interface LooseBallOptions {
  readonly initialChaserSlot: number
  readonly thrownSlot?: number
  readonly secondPass?: { readonly movable: boolean }
  readonly onlySlot?: number
}

/**
 * 고르기 vt34 = 0xb3b38 끝의 필살 표시 지우기 — r0 는 b3cb2 에서 0 이고 슬라이딩 갈래(+0x16c = 4, b3d2c)만 1 이다:
 *   b3da4 +0x1f7 = 0 → b3dac r0 == 0 이면 b3db0 +0x1f8 = 0. 점프 갈래(+0x16c = 3)는 b3d16 에서 b3db0 으로 곧장 뛰어
 *   +0x1f7 을 안 지운다. 곧 점프면 +0x1f8 만 · 슬라이딩이면 +0x1f7 만 · 그 밖은 둘 다 지운다(원본 그대로)
 */
function clearDeadlyArmsAfterChoice(s: DefensePlayState, kind: number): void {
  if (kind !== CATCH_KIND.JUMP) s.deadlyJumpArmed = false
  if (kind !== CATCH_KIND.SLIDE) s.deadlySlideArmed = false
}

/** 고르기 0xb3b38 — 고른 야수 · 포구 틱 · 포구점 · 야수 AI 를 판에 적는다 */
function applyForecastChoice(s: DefensePlayState, t: TickFrame, next: BallTrajectory, forecast: CatchForecast): void {
  s.chaserSlot = forecast.choice.slot
  s.catchTick = Math.max(t.tick, Math.min(t.tick + forecast.choice.catchTick, s.maximumTicks))
  // b12da~b1334 · b3b38 — 새 공의 +0x178 · +0x174 (첫 점이 표준 배팅 지점이 아니면 다이빙 후보가 없다)
  s.diveTicks = forecast.diveTicks
  s.diveCatchTick = forecast.choice.catchTick
  // 추적야수 AI 1(0xb4aca~0xb4b5a)은 포구 틱 점의 (x, 0, z) 로 간다(0xa100c) — 송구공 · 타구 · 다시 쏘기(0xb3148) 모두.
  // 송구는 받는 점 (목표 x, 1000, 목표 z) 에서 받으면 그 루 위에 선다(쥐기 0xb2710 은 야수를 옮기지 않는다)
  s.catchPoint = groundPointOf(next.pointAt(s.catchTick - t.tick))
  s.fielders = s.fielders.map((fielder) => fielderAfterChoice(fielder, s.chaserSlot, forecast.fenceChasePoint))
  // b3f5c — 백업 갈래(`CatchForecast.backupSlot`, r180): 머리 b3b7a 가 AI 1 · 0xc 를 0 으로 내린 뒤 고른다
  if (forecast.backupSlot >= 0) {
    s.fielders = s.fielders.map((fielder) => (fielder.slot === forecast.backupSlot ? { ...fielder, aiState: AI_STATE.BACKUP } : fielder))
  }
  s.play = {
    ...s.play,
    held: false,
    ballHolderSlot: s.chaserSlot,
    catchFielderSlot: s.chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick: s.catchTick,
    actionStartTick: t.tick + forecast.choice.actionStartTick,
    earliestCatchTick: forecast.earliestCatchTick === NO_FORECAST_CATCH ? 0xffff : t.tick + forecast.earliestCatchTick,
  }
}

/** 고르기 뒤 야수 한 명 — 아무도 공을 쥐고 있지 않다 */
function fielderAfterChoice(fielder: FielderState, chaserSlot: number, fenceChasePoint: WorldPoint | null): FielderState {
  if (fielder.slot === chaserSlot) return chaserAfterChoice(fielder, fenceChasePoint)
  // 0xb3b38 머리 b3b7a~b3b9a — AI(+0x84) 1 · 0xc 인 야수는 0xb8dbc(야수+0x80, 0)로 AI 0. 송구(0xb2e38)도 다시 쏘기도
  // 같은 고르기를 부른다 — 다시 쏘기 0xb3148 은 b3294 vt24(1) → b32a4 vt34(= 0xb3b38) → b32ae vt30
  if (fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP) return { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
  return fielder.holdingBall ? { ...fielder, holdingBall: false } : fielder
}

function chaserAfterChoice(fielder: FielderState, fenceChasePoint: WorldPoint | null): FielderState {
  // 0xb3b38 담장 갈래 — AI 0xb · +0x90 = 담장 앞 공점(aa4 − 2)의 (x, 0, z). 목표(+0x2c)는 안 적는다 — AI 고리 b4b5c 가
  // vt14(+0x90)로 적는다(1c 절, r214 — 예전 웹은 여기서 목표에 바로 적었다)
  if (fenceChasePoint !== null) return { ...fielder, pickUpPoint: fenceChasePoint, aiState: AI_STATE.PICK_UP, holdingBall: false }
  // b3e4e — 이미 AI 0xb 인 야수는 AI 1 로 안 바꾼다(머리의 되돌리기도 1 · 0xc 만 본다).
  // b3e54 는 AI 1 만 걸고 목표(+0x2c)는 안 적는다 — 포구점은 AI 고리 b4aca(1c 절)가 움직임 허용 +0x13c 를 보고 vt14 로 적는다
  // (r201 — 예전 웹은 여기서 포구점을 바로 적어, 슬롯 2 뒤쪽 CPU 송구(526ae)를 받는 야수가 한 틱 일찍 걸었다)
  const aiState = fielder.aiState === AI_STATE.PICK_UP ? AI_STATE.PICK_UP : AI_STATE.CHASE
  return { ...fielder, aiState, holdingBall: false }
}
