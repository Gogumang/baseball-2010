import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { coverTick } from '@/features/defense-play/model/runnerPlay/context/playContext'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { isHolderReady } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { rollSendToBase } from '@/features/defense-play/model/runnerPlay/throw/sendToBase'
import { rollThrowBall } from '@/features/defense-play/model/runnerPlay/throw/throwBall'
import { rollRunnerPlayFielderAi } from '@/features/defense-play/model/runnerPlay/tick/fielderAiLoop'

/**
 * **플레이 vt4c 0xb45dc (3a~3d 절)** — 슬롯 2 52612 라 플레이 틱(vt48) · 득점 0xaa0a8 뒤에 돈다. 판 종류가 마스크 0x58c 밖일 때만
 * 돈다(0x52602, `vt4cRuns`) — 밀어내기(종류 2)는 키가 +0x160 만 적고 안 던진다(다음 판 시작 vt1c 가 지운다)
 */
export function rollRunnerPlayVt4c(g: RunnerPlayFrame, tick: number): void {
  if (g.play.finished || !g.vt4cRuns) return
  rollRelayThrow(g, tick)
  rollManualThrowTarget(g, tick)
  rollRunnerPlayFielderAi(g, tick)
  // ── 3d. vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
  // 야수 AI 고리(b46ae~b4c6a) 뒤 조건 없이 부른다 — vt4c 가 도는 판(종류 4 · 5 · 9)이면 매 틱
  coverTick(g, tick)
}

/**
 * **3a. 중계 이어 던지기** — vt4c 머리 b45ee~b465e (직접 뜬 것, `runDefensePlay` 1a 절과 같다)
 * ```
 * b45f0: +0x12c(쥠) 이면
 * b4608:   [4](+0x150) ≠ +0x130(공 가진 야수) && [0](+0x14c 중계) 이면 vt5c([4], 0) = 0xb2e38 ; 참이면 메시지 0xbc6
 * b4638: (쥠이 0 인 틱(b45f4 beq)도, 위 두 조건이 깨진 틱(b460a · b4614)도 여기로 온다 — 쥠 갈래 밖)
 *        [4] == +0x130 이면 [0] = 0 · +0x117 = 0
 * ```
 * 중계맨은 쥐기(0xb2710)가 넣은 준비 틱(내야 3)이 끝난 틱에 던진다 — 0xb2e38 머리의 vtC4 가 그때까지 0 을 돌려준다.
 * 0xb2c90 을 거치지 않으므로 들고 뛰기 · 직접 밟기 관문도, 던진 뒤 AI 0 도 없다. CPU 송구 결정이 던진 공은 계획이 지워져
 * 여기를 안 탄다(4c 절) — 사람 목표(3b) · 미룬 송구(3c)의 0xb2c90 이 낸 중계만 남는다
 */
function rollRelayThrow(g: RunnerPlayFrame, tick: number): void {
  const holderSlot = g.play.ballHolderSlot
  if (g.play.held && g.relayFinalSlot !== NONE && g.relayFinalSlot !== holderSlot) {
    rollThrowBall(g, tick, g.relayFinalSlot, g.relayBase, '중계', false)
    return
  }
  if (g.relayFinalSlot !== holderSlot) return
  g.relayFinalSlot = NONE
  g.relayBase = NONE
}

/** **3b. 사람 목표 +0x160** — 플레이 틱 vt4c 의 b4660~b46a8: 쥠 && 준비(vtC4) 이면 발밑 루가 아닐 때 vt58, 그리고 −1 */
function rollManualThrowTarget(g: RunnerPlayFrame, tick: number): void {
  if (g.manualThrowBase === NONE || !isHolderReady(g)) return
  const target = g.manualThrowBase
  g.manualThrowBase = NONE
  g.play = { ...g.play, manualThrowBase: NONE }
  if (!isSamePoint(g.fielders[g.play.ballHolderSlot].position, basePosition(target))) {
    rollSendToBase(g, tick, target, true, false)
  }
}
