import { AI_STATE, NONE } from '@/entities/fielding/model/fieldingState'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { isHolderReady } from '@/features/defense-play/model/defensePlay/throw/holderReady'
import { rollSendToBase } from '@/features/defense-play/model/defensePlay/throw/sendToBase'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **CPU 송구 결정 0xafa60** — 플레이+0x128 이 서 있고 공 가진 야수가 준비됐을 때 점수식 0xafb24 로 루를 고르고
 * (홈이면 20% 특수 굴림), 0xb2c90 이 성공하면 +0x128 = 0. 공 가진 야수가 AI 8(협살)·9(미룬 송구)면 안 고른다.
 */
export function rollCpuThrowDecision(s: DefensePlayState, t: TickFrame): void {
  if (!s.play.wantsThrow || !isHolderReady(s)) return
  if (s.fielders[s.play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
  const active = s.runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
  const base = chooseThrowTargetBase({ ...contextAt(s, t.tick), activeRunnerCount: active, outs: s.outs })
  if (base === NONE) return
  const cpuSpecial = base === HOME_THROW_BASE ? rollCpuHomeSpecialThrow(s.input.random) : false
  const sent = rollSendToBase(s, t, s.play.ballHolderSlot, base, 'CPU', cpuSpecial)
  if (!sent) return
  // afafc +0x128 = 0 · afb08 0xb0ea0 — 송구 계획(+0x14c)을 지운다(r214, 직접 뜸). CPU 가 정한 먼 송구는 중계맨이 받아도
  // b4616 이 잇지 않고, 쥐기의 +0x128 로 이 결정이 다시 고른다
  s.play = { ...s.play, wantsThrow: false }
  s.relayFinalSlot = NONE
  s.relayBase = NONE
}

/** 송구 목표 루 번호의 홈 (점수식 0xafb24 의 0) */
const HOME_THROW_BASE = 0

/** afad2: 홈(0)을 골랐을 때**만** rand(0,100) — 0xb2c90 이 실패해도 굴림은 먹는다 (난수가 없으면 굴리지 않고 보통 송구) */
function rollCpuHomeSpecialThrow(random: RandomPort | undefined): boolean {
  if (random === undefined) return false
  const roll = random.rand(0, 100)
  return isSpecialThrow(HOME_THROW_BASE, roll)
}
