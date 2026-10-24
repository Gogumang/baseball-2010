import { applyCoverAssignment, assignCoversForTick } from '@/entities/fielding/model/coverAssignment'
import { isBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  type DefenseContext,
  type FielderState,
  type PlayView,
} from '@/entities/fielding/model/fieldingState'
import { acceptsTargetVt14 } from '@/entities/fielding/model/fielderPose'
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
 * - 다시 쏘기 `0xb3148` 의 꼬리 b32b0 — 예보 vt24(1) · 고르기 vt34 뒤 (판 종류를 안 본다). 타구 진행기는 r171 부터 두 꼬리를 다 부른다.
 *
 * 차례도 원본대로다 — b1f06(2루 커버 · +0x138 도움) → **b203a 자리 잡기** → b23a4(공 가진 야수의 목표 루) · b23dc(되찾기) · b2564
 * (커버 AI). 자리 잡기는 `assignCoversForTick` 의 `placeHelper` 로 그 사이에 끼워, 바뀐 도움 야수의 목표점 · AI 0xa 를 뒤의 셋이 본다.
 *
 * 머리 관문(b1c96~b1cce, 직접 뜬 것) — 하나라도 서면 이번 호출은 커버도 자리 잡기도 없이 끝난다(b1cd0 → b25d6):
 * - 어느 야수든 AI 8(협살) — `assignCoversForTick` · `secondBaseHelperPlacement` 가 본다.
 * - (+0x111 홈런 || +0x129 폴 홈런) && 공+0x68(공 틱) > 공+0xaa4(담장 넘는 틱) — 부르는 쪽이 `gateClosed` 로 넘긴다.
 * - state[7] == 0 — 쓰는 곳은 0xb67d0(b6808, 타석 · 공마다 0xf 진입 0x3d954 → 0x35650 → 0xb68bc 가 부른다) = 1 ·
 *   타구 0x511ae = 1 뒤 state[0x19] == 0 이면 0x511ce = 0x9d640(쏜 각) · 사건 7(파울) b2c06 = 0x9d640(공+0x70) · 아웃 꼬리 b3716 = 1
 *   뿐이다(즉치 #7 strb 전수). 주자 판(도루 · 폭투 · 견제 · 밀어내기)은 0xf 진입 뒤라 늘 1 이고, 타구 판은 넓은 페어 각
 *   (−145 ≤ a ≤ −35) 밖으로 친 파울이면 0 이라 아웃이 나기 전까지 이 함수가 안 돈다 — 부르는 쪽이 `gateClosed` 로 넘긴다.
 */
export interface CoverTickInput {
  readonly context: DefenseContext
  /** 공.vt60()(지금 점)의 각 + 90 > 0 (b1e24 · b229e) */
  readonly ballToFirstSide: boolean
  /** 공.vt68(0) — 지금 공 궤적의 첫 점 (b1ddc) */
  readonly ballStartPoint: WorldPoint
  /** 플레이 +0x126 — 판 시작 vt20(b11fe)이 1, 중계 자리를 잡으면(b22f6) 0 */
  readonly relayFlag: boolean
  /** 머리 관문의 홈런 · state[7] 갈래가 닫혔나 (머리말). 안 주면 열림 */
  readonly gateClosed?: boolean
  /** 플레이 +0x110(사건 7 파울) — b2564 가 커버 AI 를 안 준다. 주자 판은 사건 7 이 없어 늘 0 */
  readonly foulFlag?: boolean
}

export interface CoverTickResult {
  readonly play: PlayView
  readonly fielders: readonly FielderState[]
  readonly relayFlag: boolean
}

export function runCoverTick(input: CoverTickInput): CoverTickResult {
  const { context } = input
  if (input.gateClosed === true) return { play: context.play, fielders: context.fielders, relayFlag: input.relayFlag }
  let { play } = context
  let relayFlag = input.relayFlag
  const assigned = assignCoversForTick({
    context,
    ballToFirstSide: input.ballToFirstSide,
    ballStartPoint: input.ballStartPoint,
    foulFlag: input.foulFlag,
    // b1f06 → 0xb203a — 그때의 +0xf0(기본 표 · b1d48 넘기기 · 2루 커버)와 야수로 자리를 잡는다
    placeHelper: (fielders, secondBaseCover) => {
      const placement = secondBaseHelperPlacement({
        context: { ...context, fielders },
        secondBaseCover,
        ballToFirstSide: input.ballToFirstSide,
        relayFlag,
      })
      if (placement.kind !== '자리') return fielders
      if (placement.relayPlaced) relayFlag = false
      // b2312 · b2354 · b2380 — 목표는 야수 vt14(0xa14c8 — 0xa100c 도 같다)로 적어 잠금 +0xb4 ≤ 0 · vtc8(+0xb1 == 0 && +0xcc ≤ 0)일
      // 때만 받는다. AI 0xa(b235c · b238e 0xb8dbc)는 관문 없이 건다 (r190 — 예전 웹은 목표를 관문 없이 적었다)
      return fielders.map((fielder) =>
        fielder.slot === placement.slot
          ? {
              ...fielder,
              target: acceptsTargetVt14(fielder) ? placement.target : fielder.target,
              aiState: AI_STATE.BUSY,
            }
          : fielder,
      )
    },
  })
  if (!assigned.ran) return { play, fielders: context.fielders, relayFlag }
  play = { ...play, coverOfBase: assigned.covers }
  return { play, fielders: applyCoverAssignment(assigned.fielders, assigned), relayFlag }
}

/** 0xa276c — 판 시작이 공 첫 점 하나만 깐 공(종류 5 = 0xd7c30 포수 자리 · 그 밖 0xd7c24 투수판). 점 칸은 0xa2610 이 지워 각 0 */
export const CATCHER_BALL_POINT: WorldPoint = { x: 20_000, y: 0, z: 29_705 }
export const PITCHER_BALL_POINT: WorldPoint = { x: 20_000, y: 0, z: 24_500 }

/** 주자 판이 지금 보고 있는 공 — 마지막으로 깐 궤적(폭투 공 · 송구 · 튕김)과 그 첫 틱, 없으면 0xa276c 의 점 하나 */
export interface CurrentBallPath {
  readonly trajectory: BattedBallTrajectory
  readonly startTick: number
  /** 이 공을 쥔 판 틱 — 쥔 동안 G4 0x3f378 이 공+0x68 을 안 올린다(3f3aa `+0x12c`). 새 공을 깔면 없다 */
  readonly heldAt?: number
}

/**
 * 주자 판의 `0xb1c90` 공 입력 — 공 첫 점(공.vt68(0))과 지금 점 각(공.vt60() = 0xa2b78(공, 공+0x68), 점 +0x10).
 * - 깐 궤적이 없으면 0xa276c 의 점 하나: 각 0 → 0 + 90 > 0 이라 1루 쪽.
 * - 지금 점은 공+0x68 로 읽는다(0xa2b78 이 점 수 − 1 로 자른다). 공+0x68 은 G4 0x3f378 이 그림마다 +1(3f3c6 → 0xa2594) 하되
 *   플레이 +0x12c(쥠)이면 안 올린다(3f3aa) — 쥔 뒤에는 쥔 틱의 점에 머문다(`heldAt`, r180 확정 — 예전 웹은 판 틱대로 갔다).
 * - 원본 점 칸이 없는 손으로 만든 시험 궤적은 각을 몰라 포구 지점 x 로 읽는다(타구 진행기와 같은 근사).
 */
export function runnerPlayBallInput(
  path: CurrentBallPath | null,
  fallbackPoint: WorldPoint,
  tick: number,
): { readonly ballStartPoint: WorldPoint; readonly ballToFirstSide: boolean } {
  if (path === null) return { ballStartPoint: fallbackPoint, ballToFirstSide: true }
  const ballStartPoint = path.trajectory.pointAt(path.startTick)
  const ballTick = path.heldAt !== undefined && path.heldAt < tick ? path.heldAt : tick
  if (isBallTrajectory(path.trajectory)) {
    return { ballStartPoint, ballToFirstSide: path.trajectory.pointDetailAt(ballTick).angle + 90 > 0 }
  }
  return { ballStartPoint, ballToFirstSide: path.trajectory.pointAt(ballTick).x > 20_000 }
}
