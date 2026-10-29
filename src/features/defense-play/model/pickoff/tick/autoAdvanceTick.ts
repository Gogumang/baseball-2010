import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { HOME_BASE } from '@/features/defense-play/model/pickoff/constants'
import { contextAt } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import type { PickoffRunner } from '@/features/defense-play/model/pickoff/types/pickoffTypes'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **자동 추가 진루 0xaf918** — 경기 장면 슬롯 2 가 매 틱 부른다 (종류 4 는 거르개 2·3·8 밖이다).
 * 결과 코드(9·13)가 선 뒤에도 돈다 — 슬롯 2 의 52660 은 판 진행 관문 0xb0d28 이 열려 있으면 매 틱 부르고, 결과 코드를
 * 안 본다(예전 "결과가 선 뒤 주자가 더 뛰는지 모름" 근사는 +0x111 을 끝 표시로 읽은 탓 — +0x111 은 홈런 코드 8 이다).
 * 52660 `0xaf8c0(제어기, 0)` — force = 0: 멈춘 주자(제 목표 루에 선 주자)만 본다. force = 1 은 판 시작 0x46766 한 번
 */
export function runPickoffAutoAdvance(g: PickoffFrame, tick: number): void {
  if (g.play.finished || !g.autoBaserunningEnabled) return
  const decisions = autoAdvanceDecisions({ ...contextAt(g, tick), force: false })
  for (const decision of decisions) {
    const runner = g.runners.find((candidate) => candidate.state.index === decision.runnerIndex)
    if (runner !== undefined) applyAutoAdvance(g, tick, runner, decision.toBase)
  }
}

/**
 * afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다.
 * 한 루 더 보내면 플레이+0x128 = 1
 */
function applyAutoAdvance(g: PickoffFrame, tick: number, runner: PickoffRunner, toBase: number): void {
  const finished = runner.state.isOut || runner.state.scored
  if (!finished && toBase > HOME_BASE) return
  if (!finished) {
    startPickoffLeg(runner, toBase)
    pushPlayLog(g.log, () => `${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${toBase}루`)
  }
  g.play = { ...g.play, wantsThrow: true }
}

/** a07b0 vt48 — 새 목표가 지금 +0x7c 와 다르면 +0x84 = 옛 +0x7c. 출발점 · 닿은 루를 새로 잡는다 */
function startPickoffLeg(runner: PickoffRunner, toBase: number): void {
  if (runner.state.targetBase !== toBase) runner.previousTarget = runner.state.targetBase
  runner.state = { ...runner.state, legStart: runner.state.position, startBase: runner.state.targetBase, targetBase: toBase, settled: false }
}
