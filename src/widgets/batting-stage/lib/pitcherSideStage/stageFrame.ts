import { hitEndTickOf } from '@/widgets/batting-stage/lib/pitcherSideStage/hitTicks'
import {
  HUMAN_PITCH_RELEASE_STATE_TICK,
  type PitcherHitClock,
  type PitcherSideStageClock,
  type PitcherSideStageFrame,
} from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * 지금 그림의 장면 단계.
 * - 0x11: 공을 놓은 틱 − 10 에서 들어선다. 투수 단계가 릴리스(`pitcherReleaseTicksOf`)에 닿은 틱부터 공 틱이 오르고(0x3f378),
 *   공 틱 N + 1 의 갱신이 0x12 를 예약한다(0x4e24e → 4e26c 0xbcb49). 예약한 틀은 아직 0x11 이고 다음 틀(공 틱 N + 2)이 0x12 틱 0 이다
 *   (0xbc9c8 — 예약은 다음 틀 머리에서 선다).
 * - 0x12: 상태 틱 0 ~ `resultTicks`(문턱)의 문턱 + 1 그림 — 공은 마지막 점(`heldBall`).
 * - 그 밖은 '대기'(0xd~0xf · 0x10 조준 — 장면은 대기 동작이다).
 * 게이지(`PitchGradeGauge`)도 경기 장면 틱 머리마다 센다(`setGameSceneTickInterval`) — 놓은 틱은 게이지가 놓은 그 장면 틱이다.
 * 게이지는 0x10 이 0x11 을 예약한 틀에 선 것으로 보고 다음 틀 머리를 0x11 틱 0 으로 센다(0xbc9c8 bc9ec — 예약 다음 틀이 틱 0).
 * 그 "예약한 틀" 은 조준 OK 키를 읽는 틀이다 — 조준(`AimCursor`)은 키를 받은 다음 틀 머리에서 꺼내므로(`sceneKeyLatch`, 0x498d4)
 * 게이지가 그 틀에 서고 다음 틀 머리가 0x11 틱 0 이다.
 */
export function pitcherSideStageFrameOf(clock: PitcherSideStageClock): PitcherSideStageFrame {
  const stateTick = clock.releaseTick === null ? null : clock.nowTick - clock.releaseTick + HUMAN_PITCH_RELEASE_STATE_TICK
  if (stateTick === null || stateTick < 0) return idleFrameOf(clock)
  const ballFrame = stateTick - pitcherReleaseTicksOf(clock.aceOrder)
  /**
   * 0x12 틱 0 의 공 틱 — 공 틱 N + 1 이 예약한 다음 틀. 맞은 공인데 `hit` 을 안 받았으면(0x13 을 안 그리는 화면) 예전처럼 공 틱 N + 1
   * 에서 대기로 둔다.
   */
  const hit = clock.hit ?? null
  if (hit !== null) return hitFrameOf(hit, stateTick, ballFrame, clock.aceOrder)
  return heldPitchFrameOf(clock, stateTick, ballFrame) ?? idleFrameOf(clock)
}

/** '대기' — 쉬는 동안은 쉬기 시작한 뒤 틱을 센다 */
function idleFrameOf(clock: PitcherSideStageClock): PitcherSideStageFrame {
  return {
    phase: {
      kind: '대기',
      tick: clock.isPaused ? Math.max(0, clock.nowTick - clock.pausedSinceTick) : 0,
      isPaused: clock.isPaused,
    },
    ballFrame: -1,
    pitcherTick: null,
    pitcherTickEnd: null,
  }
}

/** 0x11 — 투수 동작 · 공 비행 */
function flightFrameOf(stateTick: number, ballFrame: number): PitcherSideStageFrame {
  return { phase: { kind: '투구중', tick: stateTick, isPaused: false }, ballFrame, pitcherTick: stateTick, pitcherTickEnd: null }
}

/** 맞은 공 — 판정 틀 J(공 틱 judgeBallTick)까지 0x11, 다음 틀이 0x13 틱 0, `hitEndTickOf` 틱의 갱신이 0x17 을 예약한다 */
function hitFrameOf(hit: PitcherHitClock, stateTick: number, ballFrame: number, aceOrder: number | null | undefined): PitcherSideStageFrame {
  const judgeStateTick = pitcherReleaseTicksOf(aceOrder) + hit.judgeBallTick
  if (stateTick <= judgeStateTick) return flightFrameOf(stateTick, ballFrame)
  // 0x17 이 선 뒤(부르는 화면이 수비 판으로 넘어가기 전 그림)도 0x13 의 마지막 그림에 둔다 — 대기 동작으로 깜빡이지 않게
  const hitTick = Math.min(stateTick - judgeStateTick - 1, hitEndTickOf(hit))
  return {
    phase: { kind: '타격', tick: hitTick, isPaused: false },
    // 0x13 그리기 0x4cb1c 의 공은 타구 쪽이다 — 투구 공은 안 그린다(타자편 `useStageAnimation` 의 '타격' 과 같다)
    ballFrame: -1,
    pitcherTick: stateTick,
    // 투수 갱신 0x9e004 는 0xf · 0x11 갱신에서만 — 판정 틀 J 가 마지막이다(타자편 판정 틀의 `pitcherTickEnd` 와 같다)
    pitcherTickEnd: judgeStateTick,
  }
}

/** 못 맞힌 공 — 공 틱 N + 1(문턱이 있으면 N + 2 앞)까지 0x11, 그 뒤 문턱 + 1 그림 0x12. 0x12 를 지나면 null('대기') */
function heldPitchFrameOf(clock: PitcherSideStageClock, stateTick: number, ballFrame: number): PitcherSideStageFrame | null {
  const flightEndFrame = clock.frameCount + (clock.resultTicks > 0 ? 2 : 1)
  if (ballFrame < flightEndFrame) return flightFrameOf(stateTick, ballFrame)
  const resultTick = ballFrame - flightEndFrame
  if (clock.resultTicks <= 0 || resultTick > clock.resultTicks) return null
  return {
    phase: { kind: '결과', tick: resultTick, isPaused: false, isInPlay: false },
    ballFrame: -1,
    pitcherTick: stateTick,
    // 0x11 의 마지막 갱신(공 틱 N + 1 — 예약한 틀)
    pitcherTickEnd: stateTick - resultTick - 1,
  }
}
