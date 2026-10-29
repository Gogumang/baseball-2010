import { AI_STATE, NONE } from '@/entities/fielding/model/fieldingState'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { contextAt, isHolderReady } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { rollSendToBase } from '@/features/defense-play/model/pickoff/throw/sendToBase'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** CPU 송구 결정 0xafa60 — +0x128 && 준비 && AI ∉ {8, 9} 일 때 점수식 0xafb24, 홈이면 특수 굴림, 0xb2c90 이 성공하면 +0x128 = 0 */
export function rollCpuThrowDecision(g: PickoffFrame, tick: number): void {
  if (!g.play.wantsThrow || !isHolderReady(g)) return
  if (g.fielders[g.play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
  const active = g.runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
  const base = chooseThrowTargetBase({ ...contextAt(g, tick), activeRunnerCount: active, outs: g.outs })
  if (base === NONE) return
  const cpuSpecial = base === HOME_THROW_BASE ? rollCpuHomeSpecialThrow(g.input.random) : false
  const sent = rollSendToBase(g, tick, base, ' (CPU 결정)', cpuSpecial)
  if (!sent) return
  // afafc +0x128 = 0 · afb08 0xb0ea0 — 계획을 지운다(CPU 가 정한 중계는 b4616 이 안 잇는다)
  g.play = { ...g.play, wantsThrow: false }
  g.relayFinalSlot = NONE
  g.relayBase = NONE
}

/** 송구 목표 루 번호의 홈 (점수식 0xafb24 의 0) */
const HOME_THROW_BASE = 0

/** afad2: 홈(0)을 골랐을 때**만** rand(0,100) — 0xb2c90 이 실패해도 굴림은 먹는다 (난수가 없으면 굴리지 않고 보통 송구) */
function rollCpuHomeSpecialThrow(random: RandomPort | undefined): boolean {
  if (random === undefined) return false
  const roll = random.rand(0, 100)
  return isSpecialThrow(HOME_THROW_BASE, roll)
}
