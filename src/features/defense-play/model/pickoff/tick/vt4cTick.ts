import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE } from '@/entities/fielding/model/fieldingState'
import { PICKOFF_THROW, PITCHER_SLOT } from '@/features/defense-play/model/pickoff/constants'
import { coverTick, isHolderReady } from '@/features/defense-play/model/pickoff/context/pickoffContext'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { rollSendToBase } from '@/features/defense-play/model/pickoff/throw/sendToBase'
import { rollThrowBall } from '@/features/defense-play/model/pickoff/throw/throwBall'
import { rollPickoffFielderAi } from '@/features/defense-play/model/pickoff/tick/fielderAiLoop'

/**
 * **플레이 vt4c 0xb45dc** — 2b' · 2c · 3 · AI 9 는 슬롯 2 52612 라 플레이 틱(vt48) · 득점 0xaa0a8 뒤에 돈다. 종류 4 는 vt4c 가 도는 판이다.
 * 투수의 견제 송구(AI 0xe)는 판 끝 표시를 안 본다(원본 그대로 — 판 끝은 관문이 틱 끝에만 세운다)
 */
export function rollPickoffVt4c(g: PickoffFrame, tick: number): void {
  if (!g.play.finished) {
    rollRelayThrow(g, tick)
    rollManualThrowTarget(g, tick)
  }
  rollPitcherPickoffThrow(g, tick)
  if (g.play.finished) return
  rollPickoffFielderAi(g, tick)
  // ── vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
  // 야수 AI 고리(b46ae~b4c6a — AI 0xe · AI 9) 뒤 조건 없이 부른다. 종류 4 는 vt4c 가 도는 판이라 매 틱
  coverTick(g, tick)
}

/**
 * **2b'. 중계 이어 던지기** — vt4c 머리 b45ee~b465e (`runnerPlayEngine` 3a 절과 같다): 쥠 && 계획 [4] ≠ 공 가진 야수 && [0](중계)면
 * vt5c([4], 0) = 0xb2e38, [4] == 공 가진 야수면 [0] = 0. 준비 틱(쥐기의 내야 3)이 끝날 때까지 0xb2e38 머리 vtC4 가 막는다
 */
function rollRelayThrow(g: PickoffFrame, tick: number): void {
  const holderSlot = g.play.ballHolderSlot
  if (g.play.held && g.relayFinalSlot !== NONE && g.relayFinalSlot !== holderSlot) {
    rollThrowBall(g, tick, g.relayFinalSlot, g.relayBase, ' (중계 이어 던지기)', false)
    return
  }
  if (g.relayFinalSlot !== holderSlot) return
  g.relayFinalSlot = NONE
  g.relayBase = NONE
}

/**
 * **2c. 사람 목표 +0x160** — 플레이 vt4c 0xb45dc 의 b4660~b46a8 (야수 고리의 AI 0xe b47da 보다 앞): 쥠 && 준비(vtC4)면
 * 발밑 루가 아닐 때 0xb2c90, 그리고 −1. 판 시작에 투수가 쥔 공(b29da vt88(0) — 준비 틱 0)도 이 갈래가 먼저 본다
 */
function rollManualThrowTarget(g: PickoffFrame, tick: number): void {
  if (g.manualThrowBase === NONE || !isHolderReady(g)) return
  const target = g.manualThrowBase
  g.manualThrowBase = NONE
  if (!isSamePoint(g.fielders[g.play.ballHolderSlot].position, basePosition(target))) {
    rollSendToBase(g, tick, target, ' (사람 송구 키)', false)
  }
}

/**
 * **3. AI 상태 0xe 0xb47da** — 투수가 0xe 인 동안 매 틱 플레이.vt58(state[0x27], 0) = 0xb2c90 (직접 뜬 것, S8 3절).
 * 0xb2c90 → 0xb2e38: 커버(루 번호 + 1)가 1구간 틱 안에 루에 못 닿으면 AI 9 로 미루고(b30a2), 던지면 0xa1620(악송구 ·
 * 긴 송구 흔들림 굴림) · 세계 0xbfed0 · 받는 점(커버 목표 = 대상 루) 끼워 넣기 · 예보 vt24(0) · vt34, 던진 투수는 AI 0(b2df8)
 */
function rollPitcherPickoffThrow(g: PickoffFrame, tick: number): void {
  if (!isPitcherAboutToPickoff(g)) return
  const sent = rollSendToBase(g, tick, g.targetBase, PICKOFF_THROW, false)
  if (sent && g.flight !== null && g.throwArrivalTick < 0) g.throwArrivalTick = g.chase?.catchTick ?? tick
}

function isPitcherAboutToPickoff(g: PickoffFrame): boolean {
  return g.play.held && g.play.ballHolderSlot === PITCHER_SLOT && g.fielders[PITCHER_SLOT]?.aiState === AI_STATE.PICKOFF
}
