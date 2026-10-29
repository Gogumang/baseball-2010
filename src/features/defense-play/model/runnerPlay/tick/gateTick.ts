import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import {
  type PlayGateInput,
  gateRunnerViewsOf,
  liveRunnerCountOf,
  passPlayGateBetweenTicks,
  someRunnerStillActive,
} from '@/entities/fielding/model/playGate'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { isAtTarget, runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { drawSceneEffects } from '@/features/defense-play/model/runnerPlay/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/runnerPlay/view/snapshot'

/**
 * **9. 판 진행 관문 0xb0d28** (`playGate.passPlayGateBetweenTicks`) — 이 틱 그리기 G3 · 0x3f378 G4 · 다음 틱 0x3f060 G1 · 슬롯 2 머리 G2.
 * 3아웃 · 처리 안 끝난 주자 · 아무도 안 쥠(종류 9 의 줍기 전 · 송구 중) → 이어 감, 공을 쥔 채 관문 51 번(+0x120 — 그림마다 3 번, 17 틱) → 닫음.
 * state[0xb] 는 이 판의 결과 코드(9 · 13)다. 낙구·담장 결과 코드(b44f6)는 이 판에 타구가 없어 안 선다.
 * 경기 멈춤(+0x1993)이면 그리기 G3 뒤 0x3f378 · 0x3f060 · 슬롯 2 머리가 모두 건너뛴다
 */
export function runRunnerPlayGate(g: RunnerPlayFrame, tick: number, runnersBeforeListTick: readonly RunnerState[]): void {
  const gateRunners = gateRunnerViewsOf(runnersBeforeListTick, runnerStates(g))
  const gate = passPlayGateBetweenTicks(gateInputOf(g, gateRunners.frame), false, g.gamePaused, headGateInputOf(gateRunners.head))
  g.endCounter = gate.endCounter
  g.counterBeforeHead = gate.counterBeforeHead
  if (gate.open) return
  g.play = { ...g.play, finished: true }
  // 닫힌 그림 다음의 G1 — 열렸으면 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196)
  g.closingListTickOpen = gate.listTickOpen === true
  if (gate.listTickOpen === true) drawClosingListFrame(g, tick)
}

/** G3 · G4 · G1 — 목록 틱(이동) 앞 주자로 본다 */
function gateInputOf(g: RunnerPlayFrame, frameRunners: readonly RunnerState[]): PlayGateInput {
  return {
    foulFlag: false,
    lastEventCode: g.resultCode ?? 0,
    outs: g.outs,
    someRunnerActive: someRunnerStillActive(frameRunners, isAtTarget),
    homeRunDerby: false,
    homeRunFlag: false,
    poleHomeRunFlag: false,
    liveRunnerCount: liveRunnerCountOf(frameRunners),
    ballHeld: g.play.held,
    groundRuleFlag: false,
    endCounter: g.endCounter,
  }
}

/** G2(슬롯 2 머리 52502) — 목록 틱(이동) 뒤 · 득점 0xaa0a8 앞 */
function headGateInputOf(headRunners: readonly RunnerState[]): Partial<PlayGateInput> {
  return { someRunnerActive: someRunnerStillActive(headRunners, isAtTarget), liveRunnerCount: liveRunnerCountOf(headRunners) }
}

/**
 * G2 만 닫힌 그림 — 다음 그림의 목록 틱(이동 · 야수 준비 틱 줄이기)과 카메라는 돌고 슬롯 2 는 빠진 채 그려진다
 * (`DefenseViewState.closingListFrame`, 타구 진행기 10 절과 같다). 그 그림도 그리기 0x46c88 이 관문을 안 보고 연출을 한 번 더 돌린다
 */
function drawClosingListFrame(g: RunnerPlayFrame, tick: number): void {
  const listTickFielders = g.fielders.map(listTickFielder)
  g.ticks.push({ ...snapshotAt(g, tick + 1, listTickFielders), closingListFrame: true })
  drawSceneEffects(g)
}
