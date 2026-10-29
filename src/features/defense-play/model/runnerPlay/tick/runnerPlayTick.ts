import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollCpuThrowDecision } from '@/features/defense-play/model/runnerPlay/throw/cpuThrowDecision'
import { runRunnerPlayAutoRunners } from '@/features/defense-play/model/runnerPlay/tick/autoRunnersTick'
import { rollBounceFromFumble } from '@/features/defense-play/model/runnerPlay/tick/bounceTick'
import { rollRunnerPlayCatch } from '@/features/defense-play/model/runnerPlay/tick/catchTick'
import { applyRunnerPlayKeys } from '@/features/defense-play/model/runnerPlay/tick/controls'
import { drawRunnerPlayTick } from '@/features/defense-play/model/runnerPlay/tick/drawTick'
import { runRunnerPlayGate } from '@/features/defense-play/model/runnerPlay/tick/gateTick'
import { rollRunnerPlayJudgement } from '@/features/defense-play/model/runnerPlay/tick/judgeTick'
import { rollRunnerPlayLaser } from '@/features/defense-play/model/runnerPlay/tick/laser'
import { moveRunnerPlayListTick } from '@/features/defense-play/model/runnerPlay/tick/listTickMove'
import { runRunnerPlayScoring } from '@/features/defense-play/model/runnerPlay/tick/scoringTick'
import { beginRunnerPlayTick } from '@/features/defense-play/model/runnerPlay/tick/tickHead'
import { rollRunnerPlayVt4c } from '@/features/defense-play/model/runnerPlay/tick/vt4cTick'

/**
 * **주자 판 틱 하나** — 원본 장면 갱신 0x52c50 = 공용 갱신 0x3f060(야수·주자 틱) → 슬롯 2 0x524c0 → 그리기 0x46c88.
 * 웹 판 틱 N = 그림 N 의 슬롯 2(0~4c 절) · 그림 N 그리기(5 · 5b 절) · 그림 N+1 의 목록 틱(6 절 이동) · 판 진행 관문(9 절)이다.
 */
export function runRunnerPlayTick(g: RunnerPlayFrame, tick: number, press: DefenseKeyPress | null): void {
  beginRunnerPlayTick(g)
  applyRunnerPlayKeys(g, tick, press)
  rollRunnerPlayLaser(g, tick, press)
  // 멈춘 그림은 슬롯 2(포구 · 판정 · 득점 · AI · 자동 진루 · CPU 송구)가 없다 — 그림(5 절)은 그대로 남긴다
  if (!g.gamePaused) rollRunnerPlaySlot2(g, tick)
  drawRunnerPlayTick(g, tick)
  // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(아래 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
  const runnersBeforeListTick = runnerStates(g)
  // 6 절은 다음 그림의 목록 틱(0x3f060)이다 — 이 틱에 멈췄으면 다음 그림도 멈춰 있어 없다(타구 진행기와 같다)
  if (!g.pausedThisTick) moveRunnerPlayListTick(g)
  runRunnerPlayGate(g, tick, runnersBeforeListTick)
}

/** 슬롯 2 0x524c0 — 플레이 틱 vt48 · 득점 vt18 · 플레이 vt4c · 자동 진루 · 자동 슬라이딩 · CPU 송구 */
function rollRunnerPlaySlot2(g: RunnerPlayFrame, tick: number): void {
  rollRunnerPlayCatch(g, tick)
  rollRunnerPlayJudgement(g, tick)
  rollBounceFromFumble(g, tick)
  runRunnerPlayScoring(g, tick)
  rollRunnerPlayVt4c(g, tick)
  runRunnerPlayAutoRunners(g, tick)
  // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 설정 자동) ──
  if (!g.play.finished && g.cpuThrowEnabled) rollCpuThrowDecision(g, tick)
}
