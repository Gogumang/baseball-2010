import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { VT4C_BLOCKED_PLAY_KINDS } from '@/features/defense-play/model/defensePlay/constants'
import { runCoverOnce } from '@/features/defense-play/model/defensePlay/cover/coverOnce'
import { rollFielderAiLoop } from '@/features/defense-play/model/defensePlay/fielderAi/fielderAiLoop'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { isHolderReady } from '@/features/defense-play/model/defensePlay/throw/holderReady'
import { rollSendToBase } from '@/features/defense-play/model/defensePlay/throw/sendToBase'
import { rollThrowBall } from '@/features/defense-play/model/defensePlay/throw/throwBall'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **플레이 vt4c = 0xb45dc (1a~1d 절)** — 슬롯 2 의 52612 라 플레이 틱 vt48(0xb401c, 525e8) · 득점 0xaa0a8(525fc) 뒤에 돈다
 * (vtable 0xd8618: +0x48 = 0xb401d · +0x4c = 0xb45dd — 직접 뜸). 예전 웹은 포구(1 절) 바로 뒤에 두었다.
 * 슬롯 2 의 52602~52614 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c {2, 3, 7, 8, 10})일 때만 vt4c 를 부른다. 한 번 세어
 * 1a~1d 모두에 건다(r171 — 예전 웹은 1d 만 보았다. 바운드 2루타 7 · 폴 홈런 10 이 된 판은 중계 · 사람 목표 · AI 9 도 없다)
 */
export function rollFielderAiPhase(s: DefensePlayState, t: TickFrame): void {
  if (VT4C_BLOCKED_PLAY_KINDS.includes(s.play.kind) || s.play.finished) return
  if (!s.uncatchable) {
    rollRelayThrow(s, t)
    rollManualThrowTarget(s, t)
  }
  rollFielderAiLoop(s, t)
  // ── 1d. vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
  // 슬롯 2 의 vt4c(52612)는 자동 진루(52660) · CPU 송구(526ae)보다 앞이다. 머리 관문: (+0x111 || +0x129) && 공+0x68 > 공+0xaa4 · state[7] == 0
  runCoverOnce(s, t)
}

/**
 * **1a. 중계 이어 던지기** — 플레이 틱 vt4c(0xb45dc) 머리 b45ee~b465e (직접 뜬 것)
 * ```
 * b45f0: +0x12c(쥠) 이면
 * b4608:   [4](+0x150) ≠ +0x130(공 가진 야수) && [0](+0x14c 중계) 이면 vt5c([4], 0) = 0xb2e38 ; 참이면 메시지 0xbc6 → b4660
 * b4638: (쥠이 0 인 틱(b45f4 beq)도, 위 두 조건이 깨진 틱(b460a · b4614)도 여기로 온다 — 쥠 갈래 밖)
 *        [4] == +0x130 이면 [0] = 0 · +0x117 = 0
 * ```
 * 중계맨은 쥐기(0xb2710)가 넣은 준비 틱(내야 3)이 끝난 틱에 던진다 — 0xb2e38 머리의 vtC4 가 그때까지 0 을 돌려준다.
 * 0xb2c90 을 거치지 않으므로 들고 뛰기·직접 밟기 관문도, 던진 뒤 AI 0 도 없다.
 * 지우기(b4638)는 쥠과 상관없다(r225 — 예전 웹은 쥠 갈래 안에 두었다). +0x130 은 고르기 0xb3b38 이 송구 때 받을 야수로
 * 옮기므로, 최종 받는 야수에게 공이 날아가는 중(안 쥔 틱)에 이미 계획이 지워진다. vt5c 가 거짓(준비 전)이면 b4624 → b4660
 * 이라 지우지 않는다 — [4] ≠ +0x130 이라 어차피 지울 일이 없다.
 */
function rollRelayThrow(s: DefensePlayState, t: TickFrame): void {
  const holderSlot = s.play.ballHolderSlot
  if (s.play.held && s.relayFinalSlot !== NONE && s.relayFinalSlot !== holderSlot) {
    rollThrowBall(s, t, holderSlot, s.relayFinalSlot, s.relayBase, '중계', false)
    return
  }
  if (s.relayFinalSlot !== holderSlot) return
  s.relayFinalSlot = NONE
  s.relayBase = NONE
}

/**
 * **1b. 포구 뒤에 사람이 고른 목표** — 플레이 틱 vt4c(0xb45dc) 의 b4660~b46a8 (직접 뜬 것)
 * ```
 * b4660: +0x160 ≠ −1 && +0x12c(쥠) && 공가진야수.vtC4()(준비) 이면
 * b4686:   공가진야수.vt58()(발밑 루) ≠ +0x160 이면 플레이.vt58(+0x160, 0) = 0xb2c90   ; 루로 보내기
 * b46a4:   +0x160 = −1
 * ```
 * 포구 전에 고른 키든 뒤에 고른 키든 같다 — 공 가진 야수(받은 야수 포함)의 준비가 끝난 틱(포구 + R)부터 그 루로
 * 보낸다. 발밑 루(좌표 완전일치)가 그 루면 보내지 않는다. 어느 쪽이든 본 뒤에는 +0x160 = −1 이다.
 */
function rollManualThrowTarget(s: DefensePlayState, t: TickFrame): void {
  if (s.play.manualThrowBase === NONE || t.tick <= s.catchTick || !isHolderReady(s)) return
  const manual = s.play.manualThrowBase
  const holderSlot = s.play.ballHolderSlot
  if (!isSamePoint(s.fielders[holderSlot].position, basePosition(manual))) {
    rollSendToBase(s, t, holderSlot, manual, '사람', false)
  }
  s.play = { ...s.play, manualThrowBase: NONE }
}
