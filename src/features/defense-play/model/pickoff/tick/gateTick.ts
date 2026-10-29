import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { gateRunnerViewsOf, liveRunnerCountOf, passPlayGateBetweenTicks, someRunnerStillActive } from '@/entities/fielding/model/playGate'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { isAtTarget, runnerStates } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { drawSceneEffects } from '@/features/defense-play/model/pickoff/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/pickoff/view/snapshot'

/** 관문 절 */
export function runPickoffGate(g: PickoffFrame, tick: number, runnersBeforeListTick: readonly RunnerState[]): void {
  // ── 판 진행 관문 0xb0d28 (`playGate.passPlayGateBetweenTicks`) — 이 틱 그리기 G3 · 0x3f378 G4 · 다음 틱 0x3f060 G1 · 슬롯 2 머리 G2 ──
  // 3아웃 · 처리 안 끝난 주자(0xaa05c, +0x94 까지) · 공을 쥔 채 관문 51 번(+0x120 — 그림마다 3 번, 17 틱). state[0xb] 는 이 판의 결과 코드(9 · 13)다.
  const gateRunners = gateRunnerViewsOf(runnersBeforeListTick, runnerStates(g))
  const gate = passPlayGateBetweenTicks(
    {
      foulFlag: false,
      lastEventCode: g.resultCode ?? 0,
      outs: g.outs,
      someRunnerActive: someRunnerStillActive(gateRunners.frame, isAtTarget),
      homeRunDerby: false,
      homeRunFlag: false,
      poleHomeRunFlag: false,
      liveRunnerCount: liveRunnerCountOf(gateRunners.frame),
      ballHeld: g.play.held,
      groundRuleFlag: false,
      endCounter: g.endCounter,
    },
    false,
    // 경기 멈춤(+0x1993) — 그리기 G3 뒤 0x3f378 · 0x3f060 · 슬롯 2 머리가 모두 건너뛴다
    g.gamePaused,
    // G2(슬롯 2 머리 52502) — 목록 틱(이동) 뒤 · 득점 0xaa0a8 앞
    {
      someRunnerActive: someRunnerStillActive(gateRunners.head, isAtTarget),
      liveRunnerCount: liveRunnerCountOf(gateRunners.head),
    },
  )
  g.endCounter = gate.endCounter
  g.counterBeforeHead = gate.counterBeforeHead
  if (!gate.open) g.play = { ...g.play, finished: true }
  // 닫힌 그림 다음의 G1 — 열렸으면 목록 틱 a1330 이 +0xcc 를 하나 더 줄인다(`fielderSlackAtPlayEnd`, r196)
  if (!gate.open) g.closingListTickOpen = gate.listTickOpen === true
  // G2 만 닫힌 그림 — 다음 그림의 목록 틱(이동 · 야수 준비 틱 줄이기)과 카메라는 돌고 슬롯 2 는 빠진 채 그려진다
  // (`DefenseViewState.closingListFrame`, 타구 진행기 10 절과 같다)
  if (!gate.open && gate.listTickOpen === true) {
    const listTickFielders = g.fielders.map(listTickFielder)
    g.ticks.push({ ...snapshotAt(g, tick + 1, listTickFielders), closingListFrame: true })
    // 그 그림도 그리기 0x46c88 이 관문을 안 보고 연출을 한 번 더 돌린다(타구 진행기 10 절)
    drawSceneEffects(g)
  }
}
