import { fielderSlackAtPlayEnd } from '@/entities/fielding/model/fielderPose'
import { playEndStateOf } from '@/features/defense-play/model/defenseScene'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { basesOf } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import type { RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/** 결과 */
export function runnerPlayResultOf(g: RunnerPlayFrame): RunnerPlayEngineResult {
  const voidedRuns = g.outs > 2 ? g.held.heldRuns : 0
  return {
    kind: g.input.kind,
    resultCode: g.resultCode,
    advance: { bases: basesOf(g.runners), runsScored: g.held.scoreboardRuns, outsAdded: g.outsAdded },
    ticks: g.ticks,
    catchFielderSlot: g.input.chase?.slot ?? g.input.play.ballHolderSlot,
    catchTick: g.input.chase !== undefined ? g.firstCatchTick : 0,
    isUncatchable: false,
    caughtOnTheFly: false,
    tagOut: g.tagOut,
    throwBase: g.firstThrowBase,
    throwArrivalTick: g.firstThrowArrival,
    voidedRuns,
    fumbled: g.fumbled,
    errantThrow: g.errantThrow,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow: g.laserThrow,
    laserOutFlag: g.laserOutFlag,
    // 플레이 객체 +0xf0 은 다음 판으로 남는다(`DefenseScene.playCovers`, r171)
    // 야수 +0xcc 도 다음 판으로 남는다 — vt20(0) 판이 들고 연다(`DefenseScene.fielderSlack`, r196)
    // 판이 끝난 그대로의 플레이 · 야수 — 다음 도루 키 0x583 의 0xafa60 이 본다(`DefenseScene.playEnd`, r201)
    scene: {
      ...g.scene,
      playCovers: g.play.coverOfBase,
      fielderSlack: fielderSlackAtPlayEnd(g.fielders, g.closingListTickOpen),
      playEnd: playEndStateOf(g.play, g.fielders, g.closingListTickOpen),
    },
    rundowns: 0,
    rundownOuts: 0,
    runnerFates: g.runners.map((runner) => runnerFateOf(runner.state)),
    log: g.log,
  }
}
