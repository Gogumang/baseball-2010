import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'

/**
 * **정산 0xa8024 가 훑는 사건 목록 ctx+0x30 중 앞 판에서 남아 있는 몫** — 견제 판(종류 4) 정산이 함께 센다 (직접 떴다).
 *
 * 정산 머리 a8084~a80f6 은 목록 `ctx+0x30[0 .. ctx+0x2c)` 를 훑어 [sp+0x30] = 사건 5(삼진) · 0xd(아웃) 수,
 * [sp+0x28] = 사건 0xf(득점) 수, [sp+0x20] = 사건 5 수를 센다. 이 값으로 R[3](a8f8c) · 투수 레코드 +0x20(a8cb0) ·
 * 병살·삼중살 26/27(a8e58) · state[0x8a](a8dd0) · 36(a80f8) · 모드 4 의 0xa59c0(a8c2a) 이 돈다.
 *
 * - 넣는 곳: 삼진 0xa7c4c(5) · 아웃 콜 0xa7d0c(0xd) · 득점 0xa5c34(0xf, 점수판 1점마다) · 0xa5fec(8) · 0xa5ffc(6).
 * - **비우는 곳(`ctx+0x2c = 0` 쓰기 전수)**: 경기 준비 0xa5636 · 타석 초기화 0xa5bcc(상태 0xd 진입 0x48d50 의 48eaa,
 *   간이 0xc262c) · 간이 0xa5c2c · 투구 0xa5e14(상태 0x11 진입 0x3de10 의 3dec6 — 공마다).
 *   정산 0xa8024 · 판정 B 0xae3e8 · 0x17 진입 0x46418 · 0xf 진입 0x3d954 는 안 비운다.
 * - 견제는 0xf 에서 메시지 0x10 → 0x50f28(종류 4 · 상태 0x17)로 가 0x11 을 안 지난다. 그래서 **같은 투구 틈에 앞서 돈 판**
 *   (공 도착의 도루 5 · 폭투·포일 9 판, 앞 견제 판)의 아웃 · 득점 사건이 견제 정산에 함께 든다 — 앞 판이 이미 정산됐어도
 *   다시 센다(원본 그대로). 도루 · 폭투 판은 그 공의 0x11 이 목록을 비운 뒤라 앞 몫이 없다.
 * - 타석이 끝나는 판(삼진 · 타구 · 볼넷 …)이나 반 이닝이 바뀌는 판 뒤에는 다음 타석 초기화가 비운다.
 */
export interface PendingSettlementEvents {
  /** 사건 5 · 0xd — 아웃 */
  readonly outs: number
  /** 사건 0xf — 점수판 득점 */
  readonly runs: number
}

export const NO_PENDING_SETTLEMENT_EVENTS: PendingSettlementEvents = { outs: 0, runs: 0 }

/** 판 하나가 목록에 넣은 아웃 · 득점 */
export function settlementEventsOfPlay(result: Pick<DefensePlayResult, 'advance'>): PendingSettlementEvents {
  return { outs: result.advance.outsAdded, runs: result.advance.runsScored }
}

/** 남은 몫에 판 하나를 더한다 — 견제 정산이 보는 값이자, 같은 타석이 이어질 때 다음 견제로 넘길 몫이다 */
export function withSettlementEvents(
  pending: PendingSettlementEvents | undefined,
  play: PendingSettlementEvents,
): PendingSettlementEvents {
  const base = pending ?? NO_PENDING_SETTLEMENT_EVENTS
  return { outs: base.outs + play.outs, runs: base.runs + play.runs }
}

/**
 * 판이 끝난 뒤 남길 몫 — 같은 타석이 이어지면(다음 공 0xf) 판의 사건을 얹고, 타석 · 반 이닝 · 경기가 끝났으면 다음 타석 초기화
 * 0xa5bcc 가 비우므로 없앤다.
 */
export function pendingSettlementEventsAfter(
  pending: PendingSettlementEvents | undefined,
  play: PendingSettlementEvents,
  atBatContinues: boolean,
): PendingSettlementEvents | undefined {
  return atBatContinues ? withSettlementEvents(pending, play) : undefined
}

/**
 * **판정 B 0xae3e8 이 공 도착 판(종류 5 · 9)을 정산 0xa8024 로 보내는가** (ae554~ae5a8, 직접 떴다):
 * ```
 * ae402  0xb68fd(경기 끝) → 0x18 · 정산
 * ae554  아웃 > 2 → 0x18 · 정산
 * ae560  state[0xb] == 0xb → 0xd · 정산
 * ae568  0xb68dc(파울) → 0xf, 정산 없음      ; 파울 각 state[0x1c] 는 0xf 진입 0x3d954 → 0x35650 → 0xb68bc → 0xb67d0 이 지워 주자 판에선 거짓
 * ae576  종류 4 · 5 → 정산 (0xd 또는 0xf)
 * ae596  종류 9 → state[0xc] == 5(삼진)면 0xd · 정산, 아니면 0xf, 정산 없음(ae5a2 → ae5b6)
 * ```
 * 낫아웃(`batterRuns`)도 state[0xc] == 5 라 정산한다 — 그 판은 타석 결과 쪽이 먹인다.
 */
export function arrivalPlaySettles(
  play: Pick<PitchArrivalPlay, 'kind' | 'strikeout'>,
  ended: { readonly halfOrGameEnded: boolean },
): boolean {
  if (play.kind !== 9) return true
  return play.strikeout !== 'none' || ended.halfOrGameEnded
}
