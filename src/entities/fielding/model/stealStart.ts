import type { BaseState } from '@/entities/game/model/baseState'
import { startsPassedBallPlay, PASSED_BALL_PLAY_KIND } from '@/entities/fielding/model/passedBall'

/**
 * **사람 경기 도루의 문턱** — 주자가 출발하는 자리(0xa9bd4)와 투구가 끝난 뒤 수비 판을 여는 자리(0x3e0e4).
 *
 * 간이 엔진 도루(0xc1818 · 표 0xd9064, `entities/game/model/steal`)와는 **완전히 다른 길**이다.
 * 사람 경기에서는 도루 메시지 `0x583`(사람 키 '3'→1 · '2'→2 · '1'→3, CPU 는 `0x520de` 가 루를 고른다)이
 * 주자를 **출발만** 시키고, 성공·실패는 투구가 끝난 뒤 열리는 **플레이 종류 5(주자만)** 수비 판에서
 * 포수 송구와 주자 도착이 겨뤄 정한다 (`features/defense-play/model/stealPlay`).
 *
 * ## 0xa9bd4(주자관리, 루) — 주자 출발 (직접 뜬 것)
 * ```
 * a9bd8: 0xae794(관리+0x14)  ; 플레이 종류(state[0x26])가 비트마스크 0x232 = {1,4,5,9} 가 아니면 0
 * a9bea: 루 == −1 → 0..3 모두에 대해 자기 자신을 부르고 OR (CPU 키 −1 이 아니라 이 함수 안의 갈래)
 * a9c06: r = 0xa97a0(관리, 루)        ; 그 루에 마지막으로 닿은 산 주자 (+0x8c == 루)
 * a9c10: i = 0xa9ad4(관리, r)         ; r 의 목록 번호
 * a9c1a: r 없음 → 0
 * a9c1e: 0xa9924(관리, i) 거짓 → 0   ; 앞길 검사 (아래 `canStartSteal`)
 * a9c2a: state[0x14+루] = 1 ; state[0x90+루] = 1 ; state[0x24] = 1
 * a9c44: r.vt48(0xb6228(r+0x78))      ; 목표 루 = 닿은 루 + 1 (3 이하일 때만 +1 → 3루 주자는 홈 4)
 * ```
 * → **3루 주자도 홈으로 뛴다**(사람 키 '1'). 간이 엔진의 "3루 주자는 안 뛴다" 는 그쪽 표 이야기다.
 */

/** 도루 수비 판의 플레이 종류 — 주자만 움직인다 (0x3e108 · 0x4e71a 가 세운다) */
export const STEAL_PLAY_KIND = 5

/**
 * 도루를 받는 플레이 종류 — `0xae794` 의 비트마스크 `0x232` = {1, 4, 5, 9}.
 * 투구가 나가는 상태 0x11 진입(0x3de10)이 플레이 종류를 1 로 세우므로 투구 중에는 늘 통과한다.
 */
const STEAL_ALLOWED_PLAY_KIND_MASK = 0x232

export function isStealAllowedInPlayKind(playKind: number): boolean {
  if (playKind < 0 || playKind > 9) return false
  return (STEAL_ALLOWED_PLAY_KIND_MASK & (1 << playKind)) !== 0
}

/** 도루 목표 루 = `0xb6228(주자+0x78)`: 닿은 루가 3 이하면 +1 (3루 → 4 = 홈) */
export function stealTargetBaseOf(base: number): number {
  return base <= 3 ? base + 1 : base
}

export type StealBase = 1 | 2 | 3

export interface StealStartInput {
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 이번 투구에서 이미 출발한 주자들의 루 (같은 투구에 키를 두 번 누르면 겹도루가 된다) */
  readonly alreadyStealing?: readonly StealBase[]
  /** state[0x26] 플레이 종류. 안 주면 1(투구 중) */
  readonly playKind?: number
}

/**
 * 루 `base` 의 주자가 지금 출발할 수 있는가 — `0xae794` · `0xa97a0` · `0xa9924` 를 그대로 옮겼다.
 *
 * ## 0xa9924(관리, i) — 앞길 검사 (직접 뜬 것)
 * ```
 * r6 = 주자[i].+0x8c                         ; 내가 선 루
 * f  = 0xa97d4(관리, i)                       ; 목록에서 내 뒤 번호 = **앞선** 산 주자. 없으면 1
 * r7 = f.+0x8c ; 끝 = 0xb6238(f) (= r7 > 1 ? r7 − 1 : r7) ; 앞으로 = !0x9fe80(f)
 * f.vt18() 참(제 목표점에 서 있다):  r6+1 < r7 또는 r6+1 < 끝 → 1, 아니면 r6 == 0 일 때만 1
 * f.vt18() 거짓(달리는 중):          r6 < r7 이고 앞으로 → 1 ; r6 < 끝 이고 뒤로 → 1 ; (3루 예외) ; 아니면 r6 == 0
 * ```
 * 투구 중의 주자는 루 위에 서 있거나(목표 = 제 루) 이번 투구에 이미 출발했다(목표 = 다음 루, 아직 제자리).
 * 그래서 쓰이는 갈래는 둘뿐이다:
 * - 앞 주자가 서 있으면 **바로 앞 루가 비어야** 한다 (`r6 + 1 < r7`). 1·2루에서 1루 주자만은 못 뛴다.
 * - 앞 주자가 이미 출발했으면 **뛸 수 있다** (`r6 < r7`, 앞으로 가는 중). 겹도루다.
 *
 "앞으로 가는 중" `!0x9fe80` 은 끝까지 떴다(`autoAdvance.isHeadingBack`) — 출발한 주자는 +0x7c(닿은 루 + 1) > +0x8c 라
 * 9feb2 에 안 걸리고 9fed0 에서 0 이 되어 "앞으로" 다(확정). 이 갈래 밖(뒤로 가는 주자 · 3루 예외)은 투구 중에 안 생긴다.
 * 판 중 주자(+0x8c · +0x7c · 방향)로 일반화한 같은 함수가 `autoAdvance.isPathClear` 다 — 자동 진루 0xaf918 이 그것을 쓴다.
 */
export function canStartSteal(input: StealStartInput, base: StealBase): boolean {
  if (!isStealAllowedInPlayKind(input.playKind ?? 1)) return false
  if (!isOccupied(input.bases, base)) return false
  const stealing = input.alreadyStealing ?? []
  if (stealing.includes(base)) return false
  // 앞선 산 주자 = 내 루보다 큰 루 가운데 가장 가까운 찬 루 (목록이 찬 루 오름차순이다 — 0xa9a10)
  const front = ([1, 2, 3] as const).find((other) => other > base && isOccupied(input.bases, other))
  if (front === undefined) return true
  if (stealing.includes(front)) return base < front
  return base + 1 < front
}

function isOccupied(bases: BaseState, base: number): boolean {
  if (base === 1) return bases.first
  if (base === 2) return bases.second
  if (base === 3) return bases.third
  return false
}

/**
 * 투구가 끝난 뒤(상태 0x12 진입 0x3dfac) 어느 수비 판을 여는가 — `0x3e062~0x3e116` 그대로 (직접 뜬 것).
 * ```
 * 3e062: r4 = state[0x19](0.1% 굴림) ; v = 투구 판정(0x9d57c)
 *        r4 && v ≠ 3(볼넷) && v ≠ 4(사구) → 0x3507c · 종류 9 · 포수+0xb8 = 6 · 상태 0x17   ← 폭투·포일
 * 3e0e4: 그렇지 않고 state[0x24](도루 중) ≠ 0 이고 !(state[6] > 1 && v == 5) → 종류 5 · 상태 0x17  ← 도루
 * ```
 * - 0.1% 사건이 서면 **도루보다 먼저** 종류 9 가 열린다(도루 중이어도).
 * - 볼넷·사구로 끝난 투구도 도루 중이면 종류 5 판이 열린다 — 원본 그대로.
 * - 2아웃에서 삼진이면 판을 열지 않는다(3아웃 — 이닝이 끝난다). 1아웃 이하의 삼진은 판이 열린다.
 * - `state[6]` 은 이 투구의 판정을 반영하기 **전**의 아웃 수다(판정 v 는 `[scene+0x10ac]` 에 적어 두고 뒤에서 처리한다).
 */
export function pitchPlayKindOf(input: {
  /** state[0x19] — `rollPassedBall` 결과 */
  readonly passedBall: boolean
  /** 투구 판정 v (R10: 3 볼넷 · 4 사구 · 5 삼진 …) */
  readonly pitchJudgement: number
  /** state[0x24] — 이번 투구에 출발한 주자가 있다 (0xa9bd4 가 세운다) */
  readonly stealing: boolean
  /** state[6] — 이 투구 전의 아웃 수 */
  readonly outs: number
}): typeof PASSED_BALL_PLAY_KIND | typeof STEAL_PLAY_KIND | null {
  if (input.passedBall && startsPassedBallPlay(input.pitchJudgement)) return PASSED_BALL_PLAY_KIND
  if (!input.stealing) return null
  if (input.outs > 1 && input.pitchJudgement === STRIKEOUT_JUDGEMENT) return null
  return STEAL_PLAY_KIND
}

/** 투구 판정 5 = 삼진 (R10) */
const STRIKEOUT_JUDGEMENT = 5
