import { onRunnerReachesHome, releaseHeldRuns } from '@/entities/fielding/model/heldRuns'
import { someRunnerStillActive } from '@/entities/fielding/model/playGate'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { batterRunnerOf, isAtTarget, runnerStates, wrapBase } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import type { PlayRunner } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **2e. 득점 0xaa0a8** (슬롯 2 525fc — 플레이 틱 뒤 · vt4c 앞): 내림차순으로 +0x3b(목록 틱에 막 닿음) && +0x8c == 4 인 주자.
 * +0x3b 는 그림 N 의 목록 틱(앞 판 틱 6 절 이동)에서만 선다 — 관문 G2 가 닫힌 그림은 0xaa0a8 을 안 부른다(타구 진행기 6f 절).
 * 득점의 함성(메시지 0x13 → 0x51fb8, 예약 0x6e499)은 판정 콜(2b, 525e8 안) 뒤 · 자동 슬라이딩 10(4, 52670 → 0x6e499) 앞이다.
 * 한 틱에 둘 다 나면 뒤에 부른 예약이 앞 소리를 끊고 칸을 덮어 슬라이딩 10 이 남는다(`soundPort` 머리 주석).
 * **2f. 보류 득점 풀기** (0xaa34c — 0xaa0a8 꼬리) — aa364 의 "진행 중인 주자" 도 0xaa05c(+0x94 항까지)
 */
export function runRunnerPlayScoring(g: RunnerPlayFrame, tick: number): void {
  g.sound.runInAt = g.sound.thisTick.length
  for (let index = g.runners.length - 1; index >= 0; index -= 1) {
    const runner = g.runners[index]!
    if (isRunnerJustHome(runner)) scoreRunner(g, tick, runner)
  }
  g.held = releaseHeldRuns(g.held, {
    outs: g.outs,
    ballOnGround: g.ballOnGround,
    batterRunner: batterRunnerOf(g),
    someRunnerStillActive: someRunnerStillActive(runnerStates(g), isAtTarget),
  })
}

/** 막 닿은 · 끝나지 않은 · 아직 안 센 주자가 닿은 루(+0x8c)가 홈(4)이다 */
function isRunnerJustHome(runner: PlayRunner): boolean {
  if (runner.state.isOut || runner.state.scored || runner.counted || !runner.arrivedThisListTick) return false
  const touched = runner.state.startBase
  return wrapBase(touched) === 0 && touched !== 0
}

function scoreRunner(g: RunnerPlayFrame, tick: number, runner: PlayRunner): void {
  runner.counted = true
  runner.state = { ...runner.state, scored: true }
  g.held = onRunnerReachesHome(g.held, {
    outs: g.outs,
    ballOnGround: g.ballOnGround,
    batterRunner: batterRunnerOf(g),
    scoringRunnerIsBatterRunner: runner.state.isBatterRunner,
  })
  pushPlayLog(g.log, () => `${tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${g.held.heldRuns} / 득점 ${g.held.scoreboardRuns}`)
}
