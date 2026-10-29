import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import { tickMarkCounter } from '@/features/defense-play/model/playerEffects'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'

/** 틱 머리 — 이번 틱 칸을 지우고, 멈춘 그림이 아니면 공용 갱신 0x3f060 의 야수 틱을 돌린다 */
export function beginRunnerPlayTick(g: RunnerPlayFrame): void {
  g.sound.slidingThisTick = false
  g.sound.thisTick = []
  g.sound.runInAt = undefined
  g.outJudgedThisTick = false
  g.tickMessageCode = 0
  g.pausedAtHead = g.gamePaused
  g.pausedThisTick = false
  // 경기 멈춤(+0x1993)이 머리에서 서 있으면 0x3f060 이 3f0a4 에서 돌아가 목록 틱이 없다
  if (!g.pausedAtHead) listTickHead(g)
  g.ballEventThisTick = false
}

/**
 * **0. 야수 틱 0xa1284** — 공용 갱신 0x3f060 이 슬롯 2(0x524c0)보다 먼저 돈다. 쥔 동안 +0xc8 −= 1 (타구 진행기 0' 절).
 * a12da · a12e6 — 동작 잠금(+0xb4)이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 만 본다).
 * a1286 프레임 +1 · 잠금 · 준비 틱 · 자세 워드 지우기 a137a~a1456(vt10 — 목표 = 위치) (`fielderPose.listTickFielder`, r176)
 */
function listTickHead(g: RunnerPlayFrame): void {
  const locked = (slot: number) => (g.fielders[slot]?.actionLockTicks ?? 0) > 0
  g.fumbleMarks = g.fumbleMarks.map((value, slot) => tickMarkCounter(value, locked(slot)))
  g.throwErrorMarks = g.throwErrorMarks.map((value, slot) => tickMarkCounter(value, locked(slot)))
  g.fielders = g.fielders.map(listTickFielder)
}
