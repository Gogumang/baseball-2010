import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { DefenseContext, FielderState } from '@/entities/fielding/model/fieldingState'

export interface CoverAssignmentInput {
  readonly context: DefenseContext
  /** 공 각 + 90 > 0 (b1e24 · b229e) — 웹은 포구점이 홈보다 1루 쪽인가로 읽는다(`secondBaseCoverSlot` 와 같은 값) */
  readonly ballToFirstSide: boolean
  /** 공.vt68(0) — 공 궤적의 첫 점 (b1ddc) */
  readonly ballStartPoint: WorldPoint
  /**
   * b1f06 바로 뒤 · b23a4 앞의 키스톤 자리 잡기 0xb203a — 2루 커버(+0xf0[2])를 받아 그때까지의 야수(b1d38 의 투수 AI 0 이 이미
   * 들어간)를 돌려준다. 자리 잡기가 바꾼 도움 야수의 목표점 · AI 0xa 를 b23a4(공 가진 야수의 목표 루) · b23dc(S.vt18 · d AI == 0) ·
   * b2564(c AI) 가 본다(`coverTick.runCoverTick`). 안 주면 자리 잡기가 없다
   */
  readonly placeHelper?: (fielders: readonly FielderState[], secondBaseCover: number) => readonly FielderState[]
  /** 플레이 +0x110(사건 7 파울) — 서 있으면 b2564(b2592~b259c)가 커버 야수에게 루 · AI 를 안 준다. 안 주면 0 */
  readonly foulFlag?: boolean
}

export interface CoverAssignment {
  /** 이번 틱에 b1c90 이 돌았나 — 어느 야수든 AI 8(협살)이면 안 돈다(b1c96) */
  readonly ran: boolean
  /** 새 +0xf0 (안 돌았으면 지난 값 그대로) */
  readonly covers: readonly number[]
  /** +0x138 — 2루 커버가 아닌 키스톤 야수(도움). 못 정했으면 −1 */
  readonly secondBaseHelper: number
  /** b1f06 에서 정한 2루 커버 — 공 가진 야수의 루(b23a4)·되찾기(b23dc) 앞, 자리 잡기 0xb203a 가 보는 값 */
  readonly secondBaseCover: number
  /** AI 0 으로 돌리는 야수들 (b1d38 투수 · b2540 커버를 내준 야수) */
  readonly idleSlots: readonly number[]
  /** AI 루 + 2 · 루 좌표를 받는 야수들 (b2564) */
  readonly coverStates: readonly { readonly slot: number; readonly base: number }[]
  /**
   * b2564 앞까지의 야수 — 자리 잡기(`placeHelper`)가 바꾼 것과 b1d38 · b2540 이 곧바로 적은 AI 0 이 들어 있다.
   * `applyCoverAssignment` 는 이것에 얹는다
   */
  readonly fielders: readonly FielderState[]
}
