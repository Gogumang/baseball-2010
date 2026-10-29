import { AI_STATE, type FielderState } from '@/entities/fielding/model/fieldingState'

/** 0xb1c90 한 번이 적어 가는 칸 — +0xf0 · AI 0 으로 돌린 야수 · 그 자리에서 바뀐 야수 */
export interface CoverDraft {
  readonly covers: number[]
  readonly idleSlots: number[]
  /** 함수 안에서 곧바로 바뀌는 야수 — b1d38 · b2540 의 AI 0(0xb8dbc 는 상태 칸만 적는다) · 자리 잡기 0xb203a */
  working: readonly FielderState[]
}

/** b1d38 · b2540 — 야수를 AI 0 으로 (0xb8dbc 는 상태 칸만 적는다) */
export function idleFielder(draft: CoverDraft, slot: number): void {
  draft.idleSlots.push(slot)
  draft.working = draft.working.map((fielder) => (fielder.slot === slot ? { ...fielder, aiState: AI_STATE.IDLE } : fielder))
}
