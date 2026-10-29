import { AI_STATE, NONE } from '@/entities/fielding/model/fieldingState'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { contextAt } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { isHolderReady } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollSendToBase } from '@/features/defense-play/model/runnerPlay/throw/sendToBase'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * CPU 송구 결정 0xafa60 — +0x128 이 서 있고 공 가진 야수가 준비(vtC4)됐을 때만 점수식 0xafb24 로 고른다.
 * 홈이면 20% 특수 굴림(`afad2`, 0xb2c90 이 실패해도 먹는다), 0xb2c90 이 성공하면 +0x128 = 0.
 */
export function rollCpuThrowDecision(g: RunnerPlayFrame, tick: number): void {
  if (!g.play.wantsThrow || !isHolderReady(g)) return
  // afa6c~afab8: 공 가진 야수가 AI 8(협살) · 9 면 안 고른다 — 이 판들은 협살이 없지만 0x583 의 한 번(`throwDecisionOnly`)은 앞 판
  // (타구 판)의 야수를 본다
  if (isHolderBusy(g)) return
  const active = g.runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
  const base = chooseThrowTargetBase({ ...contextAt(g, tick), activeRunnerCount: active, outs: g.outs })
  if (base === NONE) return
  const cpuSpecial = base === HOME_THROW_BASE ? rollCpuHomeSpecialThrow(g.input.random) : false
  const sent = rollSendToBase(g, tick, base, false, cpuSpecial)
  if (!sent) return
  // afafc +0x128 = 0 · afb08 0xb0ea0 — 계획(+0x14c)을 지운다: CPU 가 정한 송구는 중계맨이 받아도 b4616 이 안 잇고,
  // 쥐기의 +0x128 로 이 결정이 다시 고른다
  g.play = { ...g.play, wantsThrow: false }
  g.relayFinalSlot = NONE
  g.relayBase = NONE
}

function isHolderBusy(g: RunnerPlayFrame): boolean {
  const holderAi = g.fielders[g.play.ballHolderSlot]?.aiState
  return holderAi === AI_STATE.RECEIVE || holderAi === AI_STATE.RUNDOWN
}

/** 송구 목표 루 번호의 홈 (점수식 0xafb24 의 0) */
const HOME_THROW_BASE = 0

/** afad2: 홈(0)을 골랐을 때**만** rand(0,100) — 0xb2c90 이 실패해도 굴림은 먹는다 (난수가 없으면 굴리지 않고 보통 송구) */
function rollCpuHomeSpecialThrow(random: RandomPort | undefined): boolean {
  if (random === undefined) return false
  const roll = random.rand(0, 100)
  return isSpecialThrow(HOME_THROW_BASE, roll)
}
