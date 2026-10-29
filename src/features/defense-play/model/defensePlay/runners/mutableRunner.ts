import type { SlidingRunner } from '@/entities/defense-controls/model/sliding'
import { basePosition, isSamePoint, progressPercent, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { type BaseState, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

// ── 잡다한 도우미들 ──

export const wrapBase = (base: number) => ((base % 4) + 4) % 4

export function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

export function markOut(runner: MutableRunner): void {
  runner.state = { ...runner.state, isOut: true, settled: true }
}

/** 다음 구간 시작 — 출발점(+0x14)과 출발 루(+0x7c)를 새로 잡아야 진행률·협살 계산이 맞는다 */
export function startLeg(runner: MutableRunner, toBase: number): void {
  // a07b0 vt48 — 새 목표가 지금 +0x7c 와 다르면 +0x84 = 옛 +0x7c
  if (runner.state.targetBase !== toBase) runner.previousTarget = runner.state.targetBase
  runner.state = {
    ...runner.state,
    legStart: runner.state.position,
    startBase: runner.state.targetBase,
    targetBase: toBase,
    settled: false,
  }
}

/**
 * 판이 닫힌 뒤의 루 — 원본은 판 끝에 주자를 따로 앉히지 않는다. 점수판(0x373d0 의 0x37664)·도루·다음 판 모두
 * "루 b 의 주자" `0xa97a0` = **아웃(+0x96)이 아니고 마지막으로 닿은 루 `+0x8c` == b** 인 주자로 루를 본다(직접 뜸).
 * 관문이 닫히면(52502 의 0xb0d28 거짓 → 529f0) 주자 틱이 더 안 돌고, 0x17 끝 0x35108 은 파울(7)일 때만 0xa975c 로 되돌리며,
 * 주자 목록 정리 0xa9c68(주자관리 vt, 표 0xd8328)도 아웃 아닌 주자를 `+0x90 = +0x8c` 로 당겨 담을 뿐 — 그래서
 * **가던 중인 주자는 떠난 루에 남는다**(다음 판 시작 0xa9e44 도 vt88(+0x8c)로 그 루에 다시 앉힌다).
 * 보통 판은 관문 0xb0d28 이 모두 닿을 때까지 기다려 +0x8c == +0x7c 라 같고, 다음 틱에 닫는 사건 11(b0db4 — 2스트라이크 번트 파울)에서
 * 갈린다(3아웃 b0dbe 도 곧바로 닫지만 이닝이 끝난다).
 */
export function basesOf(runners: readonly MutableRunner[]): BaseState {
  let bases = EMPTY_BASES
  for (const runner of runners) {
    if (runner.state.isOut || runner.state.scored) continue
    const base = wrapBase(runner.state.startBase)
    if (base === 1) bases = { ...bases, first: true }
    if (base === 2) bases = { ...bases, second: true }
    if (base === 3) bases = { ...bases, third: true }
  }
  return bases
}

/** 주자 한 명을 슬라이딩 판정(0xa9690)이 보는 모양으로 옮긴다 */
export function slidingRunnerOf(runner: MutableRunner): SlidingRunner {
  const target = basePosition(runner.state.targetBase)
  return {
    progressPercent: progressPercent(runner.state.legStart, runner.state.position, target),
    isOut: runner.state.isOut,
    // 아웃돼 걸어 나가는 연출(+0xba)은 이 진행기에 없다 — 죽은 주자는 그 자리에서 사라진다
    isLeavingField: false,
    isSliding: runner.state.sliding,
    targetBase: runner.state.targetBase,
    ticksToArrive: ticksToReach(runner.state.position, target, runner.state.speed),
  }
}
