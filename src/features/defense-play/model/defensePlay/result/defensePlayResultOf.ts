import { fielderSlackAtPlayEnd } from '@/entities/fielding/model/fielderPose'
import { strikesAfterPlay } from '@/entities/fielding/model/playGate'
import type { AdvanceResult } from '@/entities/game/model/baseState'
import { BUNT_FOUL_OUT_RESULT_CODE, FOUL_RESULT_CODE } from '@/features/defense-play/model/defensePlay/constants'
import { basesOf } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { DefensePlayResult } from '@/features/defense-play/model/defensePlay/types/defensePlayResult'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { type DefenseScene, playEndStateOf } from '@/features/defense-play/model/defenseScene'
import { type PlayOutcomeInput, isSacrificeOf, settledBatterOutcomeOf } from '@/features/defense-play/model/playOutcome'
import { runnerFateOf, scoringBaseRunnerAfterOf } from '@/features/defense-play/model/runnerFates'

/**
 * 다 돈 상태에서 결과를 뽑는다 — 원본 루프가 끝난 뒤의 마무리다.
 *
 * **득점 = 점수판에 올라간 득점(`held.scoreboardRuns`) 그대로** — 원본은 판 뒤에 득점을 지우지 않는다 (직접 뜸):
 * - 바로 득점(0xaa1b0 메시지 0x13 → 0x51fb8 → 0xa5c34)은 그 자리에서 팀+0x27c+8(총점)·+4 를 +1 하고 이벤트 0xf 를 넣는다.
 * *   팀+0x27c 칸을 줄이는 코드는 없다(`movs #0x9f; lsls #2` 쓰임 44곳 — 0xa5c34·0xa5e14 의 +1 말고는 다른 객체·초기화).
 * - 3아웃이 막는 것은 `state[0]` 보류분뿐이다 — 해제 꼬리 0xaa388 `state[6] > 2 → return`, 다음 판 0xb67d0 이 지운다.
 * - 판 끝 판정 0xae3e8: 아웃 > 2 면 ae554 → 0x18 로 정산 0xa8024(ae5b2)를 부를 뿐 점수판은 안 건드린다.
 * 곧 아웃 ≤ 1 때 · 공이 안 닿았을 때 · 타자주자가 살아 뛰던 때 바로 올린 득점은 뒤에 타자주자가 죽어 3아웃이 돼도 남는다
 * (원본 그대로 — 야구 규칙과 다를 수 있다).
 *
 * 예전 웹은 S2 2-5 의 "타석 단위 엔진에 옮길 때의 같은 결과 규칙"(3아웃 · 땅볼 · 타자주자 아웃이면 득점 0)을 여기에 한 번 더
 * 걸었다. 그 규칙은 보류 개념이 없던 타석 단위 엔진을 위한 근사였고, 이 진행기는 보류·해제를 틱 단위로 원본대로 돌리므로 뺐다.
 * `voidedRuns` 는 3아웃으로 끝내 안 풀린 보류분(`state[0]`)이다.
 */
export function defensePlayResultOf(state: DefensePlayState): DefensePlayResult {
  // 파울로 닫힌 판 — 0xae3e8 ae568 이 정산을 건너뛰고 0x35108 이 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크) 를 부른다
  const foulEnded = state.foulFlag && !state.flyOut
  const settleInput = settleInputOf(state)
  return {
    advance: advanceOf(state, foulEnded),
    ...(foulEnded ? foulFieldsOf(state) : {}),
    ...(state.lastEventCode === BUNT_FOUL_OUT_RESULT_CODE ? { buntFoulOut: true } : {}),
    ticks: state.ticks,
    catchFielderSlot: state.chaserSlot,
    catchTick: state.catchTick,
    // 필살타법으로 친 타구였나 — 첫 야수에게 맞고 튕긴 뒤로는 보통 공이 되지만(0xa2610 이 +0x5c 를 비운다) 결과는 친 공의 표시다
    isUncatchable: state.input.isUncatchable === true,
    caughtOnTheFly: state.flyOut,
    outcome: foulEnded ? undefined : settledBatterOutcomeOf(settleInput),
    ...((state.input.buntKind ?? 0) !== 0 ? { buntBall: true } : {}),
    ...(foulEnded ? {} : settledFlagsOf(state, settleInput)),
    tagOut: state.tagOut,
    throwBase: state.firstThrowBase,
    throwArrivalTick: state.firstThrowArrivalTick,
    safeCallTick: state.safeCallTick,
    voidedRuns: state.held.heldRuns,
    fumbled: state.fumbled,
    errantThrow: state.errantThrow,
    specialDefense: state.specialDefense,
    laserThrow: state.laserThrow,
    laserOutFlag: state.laserOutFlag,
    scene: sceneAfterPlayOf(state),
    rundowns: state.rundowns,
    rundownOuts: state.rundownOuts,
    // 진행기 주자 배열이 곧 원본 목록 순서다 — 0 = 타자주자, 그 뒤 찬 루 오름차순 (`createPlayRunners`)
    runnerFates: state.runners.map((runner) => runnerFateOf(runner.state)),
    log: state.log,
  }
}

/** 파울로 닫힌 판의 스트라이크 (0xb6b58) */
function foulFieldsOf(state: DefensePlayState) {
  return { foulEnded: true, foulStrikes: strikesAfterPlay(state.input.strikes ?? 0, FOUL_RESULT_CODE) }
}

/** 정산 0xa8024 가 보는 판 끝 값 — 타자 결과(a8192~a88d4)와 희생 [sp+8](a83e2)이 같은 값을 본다 */
function settleInputOf(state: DefensePlayState): PlayOutcomeInput {
  return {
    runners: state.runners.map((runner) => runner.state),
    previousTargets: state.runners.map((runner) => runner.previousTarget),
    hitEvent: state.hitEvent,
    homeRunEvent: state.homeRunEvent,
    flyOut: state.flyOut,
    outEvents: state.outEvents,
    runsScored: state.held.scoreboardRuns,
    outsAfter: state.outs,
  }
}

/** 파울로 닫힌 판은 주자를 판 앞 자리로 되돌리고 득점이 없다 */
function advanceOf(state: DefensePlayState, foulEnded: boolean): AdvanceResult {
  if (foulEnded) return { bases: state.input.bases, runsScored: 0, outsAdded: state.outsAdded }
  return { bases: basesOf(state.runners), runsScored: state.held.scoreboardRuns, outsAdded: state.outsAdded }
}

/** 정산한 판의 표시들 — 희생 · 득점권 주자 · 그라운드 홈런 (선 것만) */
function settledFlagsOf(state: DefensePlayState, settleInput: PlayOutcomeInput) {
  return {
    ...(isSacrificeOf(settleInput) ? { sacrifice: true } : {}),
    ...(scoringBaseRunnerAfterOf(state.runners.map((runner) => runner.state)) ? { scoringBaseRunnerAfter: true } : {}),
    ...(state.groundHomeRun ? { groundHomeRun: true } : {}),
  }
}

/**
 * 플레이 객체 +0xf0 은 다음 판으로 남는다(`DefenseScene.playCovers`). 야수 +0xcc 도 — 파울 판(AI 0xf)의 4~5 를 다음 vt20(0) 판이
 * 들고 연다(`DefenseScene.fielderSlack`, r196). 이 판은 vt20(1)(b2818)이라 0 으로 열었다.
 * 판이 끝난 그대로의 플레이 · 야수 — 다음 도루 키 0x583 의 0xafa60 이 본다(`DefenseScene.playEnd`, r201)
 */
function sceneAfterPlayOf(state: DefensePlayState): DefenseScene {
  return {
    ...state.scene,
    playCovers: state.play.coverOfBase,
    fielderSlack: fielderSlackAtPlayEnd(state.fielders, state.closingListTickOpen),
    playEnd: playEndStateOf(state.play, state.fielders, state.closingListTickOpen),
  }
}
