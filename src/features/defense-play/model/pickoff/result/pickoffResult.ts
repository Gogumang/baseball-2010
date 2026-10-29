import { fielderSlackAtPlayEnd } from '@/entities/fielding/model/fielderPose'
import { playEndStateOf } from '@/features/defense-play/model/defenseScene'
import { PITCHER_SLOT } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { basesOf } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import type { PickoffPlayResult } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'

/** 결과 */
export function pickoffResultOf(g: PickoffFrame): PickoffPlayResult {
  return {
    targetBase: g.targetBase,
    resultCode: g.resultCode,
    advance: { bases: basesOf(g.runners), runsScored: g.runsScored, outsAdded: g.outsAdded },
    ticks: g.ticks,
    // 투수가 처음부터 공을 쥐고 시작한다 (0xb28be `P+0x130 = 0`)
    catchFielderSlot: PITCHER_SLOT,
    catchTick: 0,
    isUncatchable: false,
    caughtOnTheFly: false,
    tagOut: g.tagOut,
    throwBase: g.targetBase,
    // 공이 실제로 받는 쪽에 들어간 틱 — 커버를 기다렸으면 던질 때 잡아 둔 도착 틱(`throwArrivalTick`)보다 늦다
    throwArrivalTick: g.catchTick >= 0 ? g.catchTick : g.throwArrivalTick,
    voidedRuns: 0,
    fumbled: g.fumbled,
    errantThrow: g.errantThrow,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow: g.laserThrow,
    laserOutFlag: g.laserOutFlag,
    // 플레이 객체 +0xf0 은 다음 판으로 남는다(`DefenseScene.playCovers`, r171)
    // 야수 +0xcc 도 다음 판으로 남는다 — vt20(0) 판이 들고 연다(`DefenseScene.fielderSlack`, r196)
    // 판이 끝난 그대로의 플레이 · 야수 — 다음 도루 키 0x583 의 0xafa60 이 본다(`DefenseScene.playEnd`, r201).
    // 플레이 +0x160 은 이 진행기의 `manualThrowBase` 다(`play.manualThrowBase` 는 다리라 비워 둔다)
    scene: {
      ...g.scene,
      playCovers: g.play.coverOfBase,
      fielderSlack: fielderSlackAtPlayEnd(g.fielders, g.closingListTickOpen),
      playEnd: playEndStateOf({ ...g.play, manualThrowBase: g.manualThrowBase }, g.fielders, g.closingListTickOpen),
    },
    rundowns: 0,
    rundownOuts: 0,
    // 목록 = 찬 루 오름차순, 타자주자 없음 (종류 4 — 위 "상태 0x17 진입" 주석)
    runnerFates: g.runners.map((runner) => runnerFateOf(runner.state)),
    log: g.log,
  }
}
