import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { type WorldPoint, basePosition } from '@/entities/fielding/model/fieldGeometry'
import { type FielderState, NONE, type PlayView, initialPlayView } from '@/entities/fielding/model/fieldingState'
import type { CatchForecast } from '@/features/defense-play/model/catchForecast'
import { type CoverTickResult, runCoverTick } from '@/features/defense-play/model/coverTick'
import { applyPlayStartAutoAdvance } from '@/features/defense-play/model/defensePlay/start/playStartAutoAdvance'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { DEFENSE_SCENE_START } from '@/features/defense-play/model/defenseScene'

/** 판 시작의 커버 · 플레이 칸을 세우는 데 쓰는 사실 */
export interface OpeningFacts {
  readonly input: DefensePlayInput
  readonly runners: readonly MutableRunner[]
  readonly trajectory: BattedBallTrajectory
  readonly forecast: CatchForecast
  readonly catchPoint: WorldPoint
}

/**
 * 판 시작 vt18 종류 1(0xb280a): vt1c · vt20(1)(+0x126 = 1, b11fe) · 추적야수 · vt24 · vt34 · **vt30 = 0xb1c90 한 번**(커버 · 자리 잡기 0xb203a).
 * state[7] == 0(넓은 파울 각)이면 머리에서 끝나 아무것도 안 고른다 — 그때 +0xf0 은 앞 판이 남긴 값이다(`DefenseScene.playCovers`, r171:
 * 종류 1 판 시작 b280a 은 +0xf0 을 안 적고, 열린 vt30 은 b1cdc 에서 기본 표 0xd8764 를 베낀 뒤 고른다)
 */
export function coversAtStart(opening: OpeningFacts, fielders: readonly FielderState[], wideFair: boolean): CoverTickResult {
  const chaserSlot = opening.forecast.choice.slot
  return runCoverTick({
    context: {
      play: {
        ...initialPlayView(1),
        coverOfBase: [...(opening.input.scene?.playCovers ?? DEFENSE_SCENE_START.playCovers)],
        ballHolderSlot: chaserSlot,
        catchFielderSlot: chaserSlot,
      },
      fielders,
      runners: opening.runners.map((runner) => runner.state),
      currentTick: 0,
      landingTick: opening.trajectory.landingTick,
    },
    ballToFirstSide: opening.catchPoint.x > basePosition(0).x,
    ballStartPoint: opening.trajectory.pointAt(0),
    relayFlag: true,
    gateClosed: !wideFair,
  })
}

/**
 * 판 시작의 플레이 칸 — 그리고 **0x46766** (0x17 진입 0x46418 끝): 판 진행 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 을
 * **한 번**, 주루 설정 갈림(0xae690) 없이 부른다. force = 1 이라 달리는 주자(리드 뒤 돌아오는 주자 · 도루 · 포스 · 타자주자)까지 본다.
 * 진루 자리 afa0e 는 vt48(0xb6228(R+0x78)) = +0x8c + 1 — 이미 그 루로 달리는 주자는 목표가 그대로고(+0x84 도 같은 값),
 * +0x128 = 1 은 결정마다 선다. 굴림 없음.
 */
export function playAtStart(opening: OpeningFacts, covers: readonly number[], catchTick: number, fielders: readonly FielderState[]): PlayView {
  const { forecast, runners } = opening
  const play: PlayView = {
    ...initialPlayView(1),
    // 플레이+0x160 — 판 시작 vt18 0xb27ec(종류 1 → 0xb280a)가 먼저 부르는 vt1c 0xb0edc 의 b0f66~b0f68 이 −1 로 지운다.
    // 앞 판에서 못 쓴 사람 송구 키는 넘어오지 않는다
    manualThrowBase: NONE,
    coverOfBase: covers,
    ballHolderSlot: forecast.choice.slot,
    catchFielderSlot: forecast.choice.slot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    // +0x11c — 예보 표의 가장 이른 포구 틱(없으면 0xffff)
    earliestCatchTick: forecast.earliestCatchTick,
  }
  const context = { play, fielders, runners: runners.map((runner) => runner.state), currentTick: 0, landingTick: opening.trajectory.landingTick }
  return applyPlayStartAutoAdvance(context, runners)
}
