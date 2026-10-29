import { OUT_KIND } from '@/entities/fielding/model/outJudgement'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runOutJudgement } from '@/features/defense-play/model/pickoff/judgement/outJudgement'
import { rollCpuThrowDecision } from '@/features/defense-play/model/pickoff/throw/cpuThrowDecision'
import { runnerPlayCallSoundIdOf } from '@/features/defense-play/model/runnerPlayEngine'

/** 같은 플레이 틱 꼬리 — 아웃 판정 → 결과 메시지 → 견제사 뒤 CPU 송구 결정 */
export function rollPickoffJudgement(g: PickoffFrame, tick: number): void {
  judgeOutsOnPlayTick(g, tick)
  postTickMessage(g)
  // ── 결과 메시지 0xbba — 견제사(결과 13) 뒤 0x51d40 이 `아웃 ≤ 2` 면 +0x128 = 1 · 0xafa60 한 번 (사람·CPU 모두) ──
  // 0xafa60 은 공 쥔 야수가 준비(+0xc8 ≤ 0)돼야 고른다. 견제사는 송구를 받는 틱(쥐기가 준비 틱 3 을 막 넣은 틱)이나
  // 돌아오는 주자가 닿는 한두 틱 뒤에 나서 준비가 안 끝나 있다 — 견제 3000판에서 한 번도 고르지 않는다.
  // 준비된 뒤 아웃이 나 점수식이 루를 고르면 0xb2c90 · 0xb2e38 로 이어 던진다.
  if (g.outJudgedThisTick && g.outs <= 2 && !g.play.finished) {
    g.play = { ...g.play, wantsThrow: true }
    rollCpuThrowDecision(g, tick)
  }
}

/**
 * **아웃 판정 0xb36d0** — 플레이 틱 b43cc~b43ea (포구 갈래 뒤 · 같은 그림의 슬롯 2 — 이동 앞, 타구 진행기 6b 절).
 * 쥐기 판정(0xb2758)이 이 틱에 아웃을 냈으면 같은 플레이 틱의 두 번째 판정(b42f2 · b43de)이 머리 b36dc 에서 state[0x87] 을
 * 지우고 태그(3)일 때만 다시 세운다 — 결과 코드 13 은 b4540 에서 그 값을 읽는다(타구 진행기 6b 절).
 * b42ce~b4314 (타구 진행기 2b · 6b 절, r201): 아웃 아닌 주자 중 +0x3b(막 닿음)가 있거나(0xa99d8) 공 가진 야수 F+0x3b 면 b42ee 갈래 —
 * 판정 b42f2 한 번 뒤 결과 2(루 아웃)이고 F+0x3b 면 state[0x87] = 1(b4312) — 포스 아웃도 콜 62 다. 아니면 b43cc~b43ea 판정 한 번
 */
function judgeOutsOnPlayTick(g: PickoffFrame, tick: number): void {
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
 * **결과 메시지 0xbba(b4562) → 51a56 결과 판 칸** — 포구 b4292 의 9 를 b4540 의 13 이 덮는다. 0x51d40 송구보다 먼저.
 * 같은 메시지의 판정 스위치가 그 자리에서 콜을 낸다 — 종류 4 는 9 면 늘 17(0x51c14 51c1e), 13 이면 62/20(0x51b36)
 */
function postTickMessage(g: PickoffFrame): void {
  if (g.outJudgedThisTick) g.tickMessageCode = 13
  if (g.tickMessageCode === 0) return
  g.scene = { ...g.scene, popup: postJudgeMessage(g.scene.popup, g.tickMessageCode, g.play.ballHolderSlot) }
  const call = runnerPlayCallSoundIdOf(g.tickMessageCode, g.tagOut)
  if (call !== null) g.sound.thisTick.push(call)
}
