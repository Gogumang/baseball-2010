import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runnerStates } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'
import { rollCpuThrowDecision } from '@/features/defense-play/model/pickoff/throw/cpuThrowDecision'
import { runPickoffAutoAdvance } from '@/features/defense-play/model/pickoff/tick/autoAdvanceTick'
import { rollPickoffBounce } from '@/features/defense-play/model/pickoff/tick/bounceTick'
import { rollPickoffCatch } from '@/features/defense-play/model/pickoff/tick/catchTick'
import { applyPickoffKeys } from '@/features/defense-play/model/pickoff/tick/controls'
import { drawPickoffTick } from '@/features/defense-play/model/pickoff/tick/drawTick'
import { runPickoffGate } from '@/features/defense-play/model/pickoff/tick/gateTick'
import { rollPickoffJudgement } from '@/features/defense-play/model/pickoff/tick/judgeTick'
import { rollPickoffLaser } from '@/features/defense-play/model/pickoff/tick/laser'
import { movePickoffListTick } from '@/features/defense-play/model/pickoff/tick/listTickMove'
import { runPickoffScoring } from '@/features/defense-play/model/pickoff/tick/scoringTick'
import { beginPickoffTick } from '@/features/defense-play/model/pickoff/tick/tickHead'
import { rollPickoffVt4c } from '@/features/defense-play/model/pickoff/tick/vt4cTick'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'

/**
 * **견제 판 틱 하나** — 공용 갱신 0x3f060(야수 틱) → 사람 키 → 레이저 → 슬롯 2 0x524c0 → 그리기 0x46c88 → 다음 그림 목록 틱(이동) →
 * 판 진행 관문 0xb0d28 (`runnerPlayEngine` 과 같은 차례)
 */
export function runPickoffTick(g: PickoffFrame, tick: number, press: DefenseKeyPress | null): void {
  beginPickoffTick(g)
  applyPickoffKeys(g, tick, press)
  rollPickoffLaser(g, tick, press)
  // 멈춘 그림은 슬롯 2(포구 · 판정 · 득점 · AI · 자동 진루 · CPU 송구)가 없다 — 그림은 그대로 남긴다
  if (!g.gamePaused) rollPickoffSlot2(g, tick)
  drawPickoffTick(g, tick)
  // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(아래 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
  const runnersBeforeListTick = runnerStates(g)
  // 이동은 다음 그림의 목록 틱(0x3f060)이다 — 이 틱에 멈췄으면 다음 그림도 멈춰 있어 없다(타구 진행기 nextFrame 과 같다)
  if (!g.pausedThisTick) movePickoffListTick(g)
  runPickoffGate(g, tick, runnersBeforeListTick)
}

/** 슬롯 2 0x524c0 — 포구 · 판정 · 튕김 · 득점 · vt4c · 자동 진루 · CPU 송구 */
function rollPickoffSlot2(g: PickoffFrame, tick: number): void {
  rollPickoffCatch(g, tick)
  rollPickoffJudgement(g, tick)
  rollPickoffBounce(g, tick)
  runPickoffScoring(g, tick)
  rollPickoffVt4c(g, tick)
  runPickoffAutoAdvance(g, tick)
  // ── CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 자동) ──
  // 견제를 받은 야수도 쥐기 0xb2710 이 +0x128 = 1 을 세우므로, 준비 틱(내야 3)이 지난 틱에 점수식이 루를 고른다
  if (!g.play.finished && g.cpuThrowEnabled) rollCpuThrowDecision(g, tick)
}
