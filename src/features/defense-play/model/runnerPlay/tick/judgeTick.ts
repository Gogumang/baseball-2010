import { requiredBasesOnBounce } from '@/entities/fielding/model/autoAdvance'
import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerPlayCallSoundIdOf } from '@/features/defense-play/model/runnerPlay/judgement/callSound'
import { runOutJudgement } from '@/features/defense-play/model/runnerPlay/judgement/outJudgement'
import { runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollCpuThrowDecision } from '@/features/defense-play/model/runnerPlay/throw/cpuThrowDecision'

/** 2 · 2b · 2c 절 — 같은 플레이 틱 꼬리: 아웃 판정 → 낙구 포스 → 결과 메시지 → 아웃이 난 틱의 CPU 송구 결정 */
export function rollRunnerPlayJudgement(g: RunnerPlayFrame, tick: number): void {
  judgeOutsOnPlayTick(g, tick)
  settleBallLanding(g, tick)
  postTickMessage(g)
  // ── 2c. 아웃이 난 틱 — 같은 메시지의 0x51d40~0x51db4 → 0xafa60 한 번 ──
  // 수비 조작이 사람이든 CPU 든 `아웃 ≤ 2` 면 플레이+0x128 = 1 로 세우고 CPU 송구 결정을 부른다
  // (`runDefensePlay` 의 6c 절에 근거). 공 쥔 야수가 준비(vtC4)돼 있어야 던진다 — 송구를 받는 틱의 아웃은
  // 쥐기가 준비 틱을 막 넣어 못 던진다.
  if (g.outJudgedThisTick && g.outs <= 2 && !g.play.finished) {
    g.play = { ...g.play, wantsThrow: true }
    rollCpuThrowDecision(g, tick)
  }
}

/**
 * **2. 아웃 판정 0xb36d0** — 플레이 틱 b43cc~b43ea (포구 갈래 뒤 · 같은 그림의 슬롯 2 — 6 절 이동 앞).
 * 그림 N 의 플레이 틱이라 주자 · 야수 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다(타구 진행기 6b 절과 같다).
 * 쥐기 판정(0xb2758)이 이 틱에 아웃을 냈으면 같은 플레이 틱의 두 번째 판정(b42f2 · b43de)이 머리 b36dc 에서 state[0x87] 을
 * 지우고 태그(3)일 때만 다시 세운다 — 결과 코드 13 은 b4540 에서 그 값을 읽는다(타구 진행기 6b 절).
 * b42ce~b4314 (타구 진행기 2b · 6b 절, r201): 아웃 아닌 주자 중 +0x3b(막 닿음)가 있거나(0xa99d8) 공 가진 야수 F+0x3b 면 b42ee 갈래 —
 * 판정 b42f2 한 번 뒤 결과 2(루 아웃)이고 F+0x3b 면 state[0x87] = 1(b4312) — 포스 아웃도 콜 62 다. 아니면 b43cc~b43ea 판정 한 번
 */
function judgeOutsOnPlayTick(g: RunnerPlayFrame, tick: number): void {
  const holderJustArrived = g.fielderArrivals[g.play.ballHolderSlot] === true
  const arrivalBranch = g.runners.some((runner) => !runner.state.isOut && runner.arrivedThisListTick) || holderJustArrived
  const grabbedOut = g.outJudgedThisTick
  const outsBeforeSecondJudgement = g.outsAdded
  g.lastJudgedKind = OUT_KIND.NONE
  runOutJudgement(g, tick)
  const baseOutFold = arrivalBranch && g.fielderArrivals[g.play.ballHolderSlot] === true && g.lastJudgedKind === OUT_KIND.BASE
  if (grabbedOut) {
    g.tagOut = g.lastJudgedKind === OUT_KIND.TAG || baseOutFold
    return
  }
  if (baseOutFold && g.outsAdded > outsBeforeSecondJudgement) g.tagOut = true
}

/**
 * 낙구 0xb4492~0xb453c — 아웃 판정 b43da · 결과 9 b43ec 뒤(b444e~) — +0x112(쥐었거나 땅에 닿음)가 아직이면 state[0x1e] = 1 · 포스 요구 루 0xa95e8.
 * 사건(펌블)만 있는 틱도 b44f8 이 포스를 세운다
 */
function settleBallLanding(g: RunnerPlayFrame, tick: number): void {
  if (g.ballOnGround || g.chase === null) return
  if (tick !== g.chase.trajectory.landingTick && !g.ballEventThisTick) return
  if (!g.ballEventThisTick) g.ballOnGround = true
  const required = requiredBasesOnBounce(runnerStates(g))
  g.runners.forEach((runner, index) => {
    runner.state = { ...runner.state, requiredBase: required[index] ?? runner.state.requiredBase }
  })
}

/**
 * **2b. 결과 메시지 0xbba(b4562) → 51a56 결과 판 칸** — 포구 b4292 의 9 를 b4540 의 13 이 덮는다. 공 가진 야수는 이 자리 값.
 * 같은 메시지의 판정 스위치가 그 자리에서 콜을 낸다 (`runnerPlayCallSoundIdOf`)
 */
function postTickMessage(g: RunnerPlayFrame): void {
  if (g.outJudgedThisTick) g.tickMessageCode = 13
  if (g.tickMessageCode === 0) return
  g.scene = { ...g.scene, popup: postJudgeMessage(g.scene.popup, g.tickMessageCode, g.play.ballHolderSlot) }
  const call = runnerPlayCallSoundIdOf(g.tickMessageCode, g.tagOut)
  if (call !== null) g.sound.thisTick.push(call)
}
