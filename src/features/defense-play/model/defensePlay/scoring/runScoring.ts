import { onRunnerReachesHome, releaseHeldRuns } from '@/entities/fielding/model/heldRuns'
import { someRunnerStillActive } from '@/entities/fielding/model/playGate'
import { RELEASED_RUN_SLOT } from '@/features/defense-play/model/defensePlay/constants'
import { isAtTarget, wrapBase } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **6f · 6g. 득점** — 주자 관리 vt18 `0xaa0a8`(슬롯 2 525fc — 플레이 틱 vt48 525e8 바로 뒤 · vt4c 52612 앞)과 그 꼬리 보류 풀기 0xaa34c.
 * state[0x1e](공이 땅에 닿았다) — 쥐기 0xb2710 · 낙구 b44a2 가 세운다. 둘 다 같은 플레이 틱(1 절 · 6d 절)이라 이 그림 값이다
 */
export function runScoring(s: DefensePlayState, t: TickFrame): void {
  const ballOnGround = s.play.everHeld || t.tick >= s.trajectory.landingTick
  countRunnersReachingHome(s, t, ballOnGround)
  releaseHeldRunsAfterLoop(s, t, ballOnGround)
}

/**
 * **6f. 0xaa0a8** (직접 뜬 것) — **i = 주자 수 − 1 부터 0 까지 내림차순**(aa0ce · aa342 `subs` / `bmi`)으로 +0x96(끝) 이 아니고(aa0e6)
 * `+0x3b(막 도착) && +0x8c == 4`(aa12a~aa140) 인 주자를 득점으로 세고 바로 득점이면 aa1b0 메시지 0x13(인자 i)을 곧바로(0xbfbad) 보낸다.
 * +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)에서 홈에 막 닿은 주자다(`arrivedThisListTick`) — 주자 틱 0xa01cc 가 a0364 의
 * 0xbf094(bf0a2)에서 **매 목록 틱 머리에 지우므로** 그 바로 뒤 슬롯 2 에서 못 센 주자는 다시 세지 않는다(관문 G2 가 닫힌 그림 529f0 ·
 * 레이저 멈춤 524e6 은 0xaa0a8 을 안 부른다 — 원본 그대로). 같은 목록 틱에 들어온 타자주자(0)는 맨 뒤다.
 * 아웃 판정(6b)이 같은 그림의 앞이라 2아웃 보류(state[0])는 그 아웃까지 센 아웃 수로 가른다.
 */
function countRunnersReachingHome(s: DefensePlayState, t: TickFrame, ballOnGround: boolean): void {
  for (let index = s.runners.length - 1; index >= 0; index -= 1) {
    const runner = s.runners[index]!
    if (isRunnerJustHome(runner)) scoreRunner(s, t, runner, ballOnGround)
  }
}

/** 막 닿은 · 끝나지 않은 주자가 홈(목표 루 4)을 밟았고 아직 안 셌다 */
function isRunnerJustHome(runner: MutableRunner): boolean {
  if (runner.state.isOut || runner.state.scored || !runner.arrivedThisListTick || !isAtTarget(runner.state)) return false
  return wrapBase(runner.state.targetBase) === 0 && runner.state.targetBase !== 0 && !runner.counted
}

/** 홈을 밟았다 — 2아웃 보류 규칙(state[0])을 태운다 */
function scoreRunner(s: DefensePlayState, t: TickFrame, runner: MutableRunner, ballOnGround: boolean): void {
  runner.counted = true
  runner.state = { ...runner.state, scored: true }
  const scoredBefore = s.held.scoreboardRuns
  s.held = onRunnerReachesHome(s.held, {
    outs: s.outs,
    ballOnGround,
    batterRunner: s.runners[0].state,
    scoringRunnerIsBatterRunner: runner.state.index === 0,
  })
  // 바로 득점 0xaa1b0 — 메시지 0x13(주자 칸)
  if (s.held.scoreboardRuns > scoredBefore) {
    t.runInsThisTick.push(runner.state.index)
    t.tickSounds.push({ kind: 'runIn', slot: runner.state.index })
  }
  // aa1de~aa1fe — 홈에 닿은 주자가 이번 타자(+0x98)이고 담장 · 폴 홈런 사건이 없으면 state[0x25] = 1 (그라운드 홈런)
  if (runner.state.isBatterRunner && !s.homeRunEvent) s.groundHomeRun = true
  pushPlayLog(s.log, () => `${t.tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${s.held.heldRuns} / 득점 ${s.held.scoreboardRuns}`)
}

/**
 * **6g. 보류 득점 풀기** (0xaa34c — 0xaa0a8 주자 고리가 끝나면 aa0d8 에서 곧바로 오는 꼬리).
 * aa364 의 "진행 중인 주자" 도 0xaa05c 다 — +0x94(요구 루) 항까지 본다. 보류 해제 0xaa39e — 푼 수만큼 메시지 0x13(0x64)
 */
function releaseHeldRunsAfterLoop(s: DefensePlayState, t: TickFrame, ballOnGround: boolean): void {
  const stillActive = someRunnerStillActive(
    s.runners.map((runner) => runner.state),
    isAtTarget,
  )
  const scoredBeforeRelease = s.held.scoreboardRuns
  s.held = releaseHeldRuns(s.held, {
    outs: s.outs,
    ballOnGround,
    batterRunner: s.runners[0].state,
    someRunnerStillActive: stillActive,
  })
  for (let run = scoredBeforeRelease; run < s.held.scoreboardRuns; run += 1) {
    t.runInsThisTick.push(RELEASED_RUN_SLOT)
    t.tickSounds.push({ kind: 'runIn', slot: RELEASED_RUN_SLOT })
  }
}
