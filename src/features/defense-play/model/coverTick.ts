import { applyCoverAssignment, assignCoversForTick } from '@/entities/fielding/model/coverAssignment'
import { isBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
} from '@/entities/fielding/model/fieldingState'
import { secondBaseHelperPlacement } from '@/entities/fielding/model/throwArrival'

/**
 * **플레이 vt30 = `0xb1c90` 한 번** — 커버(+0xf0) 다시 고르기(`assignCoversForTick`)와 그 가운데의 키스톤 자리 잡기 0xb203a
 * (`secondBaseHelperPlacement`). 타구 진행기(`runDefensePlay` 6 절)와 주자 판(`runnerPlayEngine` · `pickoffPlay`)이 같이 쓴다.
 *
 * 부르는 곳 (직접 뜬 것):
 * - 플레이 vt4c `0xb45dc` 의 끝 — 야수 AI 고리(b46ae~b4c6a, 9명) 뒤 b4c72 `ldr r3, [r3, #0x30]` 로 **조건 없이** 부른다.
 *   vt4c 는 슬롯 2 의 52612 가 [sp+0x14] = 0xae61c(판 종류 ∉ {2, 3, 7, 8, 10})일 때만 부르므로 종류 1 · 4(견제) · 5(도루) ·
 *   9(폭투 · 포일)에서 **매 틱** 돈다(52602~52614). 머리 b45dc~b46ac 에도 일찍 끝나는 갈래가 없다.
 * - 판 시작 — 종류 5 `0xb2950`(b29d0) · 종류 9 `0xb284a`(b2884) 가 예보 vt24 · 고르기 vt34 뒤에 한 번. 종류 4 `0xb28be` 는
 *   부르지 않는다(b2942 → b29ec 0xb8dbc(투수, 0xe) → b2a1e 끝).
 * - 송구 `0xb2e38` 의 꼬리 b3094 — 예보 vt24(0) · 고르기 vt34 뒤 (판 종류를 안 본다).
 *
 * 차례는 원본이 b1f06(2루 커버) → b203a(자리 잡기) → b23a4 · b23dc · b2564 이지만, 웹은 타구 진행기와 같이 커버를 다 정한 뒤
 * 자리 잡기를 한다(⚠️ 근사 — 도움 야수가 다른 루 커버로 b2564 에 걸리는 드문 틱에서만 다르다).
 */
export interface CoverTickInput {
  readonly context: DefenseContext
  /** 공.vt60()(지금 점)의 각 + 90 > 0 (b1e24 · b229e) */
  readonly ballToFirstSide: boolean
  /** 공.vt68(0) — 지금 공 궤적의 첫 점 (b1ddc) */
  readonly ballStartPoint: WorldPoint
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1, 중계 자리를 잡으면(b22f6) 0 */
  readonly relayFlag: boolean
}

export interface CoverTickResult {
  readonly play: PlayView
  readonly fielders: readonly FielderState[]
  readonly relayFlag: boolean
}

export function runCoverTick(input: CoverTickInput): CoverTickResult {
  const { context } = input
  let { play, fielders } = context
  let relayFlag = input.relayFlag
  const assigned = assignCoversForTick({
    context,
    ballToFirstSide: input.ballToFirstSide,
    ballStartPoint: input.ballStartPoint,
  })
  if (assigned.ran) {
    play = { ...play, coverOfBase: assigned.covers }
    fielders = applyCoverAssignment(fielders, assigned)
  }
  const placement = secondBaseHelperPlacement({
    context: { ...context, play, fielders },
    secondBaseCover: assigned.ran ? assigned.secondBaseCover : NONE,
    ballToFirstSide: input.ballToFirstSide,
    relayFlag,
  })
  if (placement.kind === '자리') {
    if (placement.relayPlaced) relayFlag = false
    fielders = fielders.map((fielder) =>
      fielder.slot === placement.slot ? { ...fielder, target: placement.target, aiState: AI_STATE.BUSY } : fielder,
    )
  }
  return { play, fielders, relayFlag }
}

/** 0xa276c — 판 시작이 공 첫 점 하나만 깐 공(종류 5 = 0xd7c30 포수 자리 · 그 밖 0xd7c24 투수판). 점 칸은 0xa2610 이 지워 각 0 */
export const CATCHER_BALL_POINT: WorldPoint = { x: 20_000, y: 0, z: 29_705 }
export const PITCHER_BALL_POINT: WorldPoint = { x: 20_000, y: 0, z: 24_500 }

/** 주자 판이 지금 보고 있는 공 — 마지막으로 깐 궤적(폭투 공 · 송구 · 튕김)과 그 첫 틱, 없으면 0xa276c 의 점 하나 */
export interface CurrentBallPath {
  readonly trajectory: BattedBallTrajectory
  readonly startTick: number
}

/**
 * 주자 판의 `0xb1c90` 공 입력 — 공 첫 점(공.vt68(0))과 지금 점 각(공.vt60() = 0xa2b78(공, 공+0x68), 점 +0x10).
 * - 깐 궤적이 없으면 0xa276c 의 점 하나: 각 0 → 0 + 90 > 0 이라 1루 쪽.
 * - 지금 점은 공+0x68 = 판 틱으로 읽는다(0xa2b78 이 점 수 − 1 로 자른다). ⚠️ 근사: 쥔 뒤에도 공 틱이 판 틱대로 간다고 본다.
 * - 원본 점 칸이 없는 손으로 만든 시험 궤적은 각을 몰라 포구 지점 x 로 읽는다(타구 진행기와 같은 근사).
 */
export function runnerPlayBallInput(
  path: CurrentBallPath | null,
  fallbackPoint: WorldPoint,
  tick: number,
): { readonly ballStartPoint: WorldPoint; readonly ballToFirstSide: boolean } {
  if (path === null) return { ballStartPoint: fallbackPoint, ballToFirstSide: true }
  const ballStartPoint = path.trajectory.pointAt(path.startTick)
  if (isBallTrajectory(path.trajectory)) {
    return { ballStartPoint, ballToFirstSide: path.trajectory.pointDetailAt(tick).angle + 90 > 0 }
  }
  return { ballStartPoint, ballToFirstSide: path.trajectory.pointAt(tick).x > 20_000 }
}
