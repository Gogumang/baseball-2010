import { AI_STATE, NONE, type DefenseContext, type FielderState } from '@/entities/fielding/model/fieldingState'
import { idleFielder, type CoverDraft } from '@/entities/fielding/model/coverAssignment/assign/draft'
import { baseAtPoint, needsCover } from '@/entities/fielding/model/coverAssignment/coverNeed'

/** b1d48 — 공 가진 야수(+0x130) → 투수에게 넘기는 루: 포수 → 홈 · 1루수 → 1루 · 3루수 → 3루 */
const HANDED_BASE_OF_HOLDER: Readonly<Record<number, number>> = { 1: 0, 2: 1, 4: 3 }
const PITCHER_SLOT = 0

/** b1d1a — 제 루(k == +0x130 − 1)를 목표로 선 기본 야수이고 쫓기(1) · 받기 대기(9)가 아니다 */
function isDefaultFielderOnOwnBase(holder: FielderState | undefined, holderSlot: number): boolean {
  if (holder === undefined) return false
  const base = baseAtPoint(holder.target)
  if (base === NONE || base !== holderSlot - 1) return false
  return holder.aiState !== AI_STATE.CHASE && holder.aiState !== AI_STATE.RECEIVE
}

/**
 * b1d0a · b1d48 — 기본 야수가 공을 가졌으면 그 루를 투수에게. 제 루에 선 기본 야수면 넘기기 없이 투수 AI 0,
 * 아니면 그 루에 커버가 필요할 때만 투수(0), 필요 없으면 −1.
 */
export function handOffHolderBase(draft: CoverDraft, context: DefenseContext, holder: FielderState | undefined): void {
  const holderSlot = context.play.ballHolderSlot
  if (isDefaultFielderOnOwnBase(holder, holderSlot)) {
    idleFielder(draft, PITCHER_SLOT)
    return
  }
  const handed = HANDED_BASE_OF_HOLDER[holderSlot] ?? NONE
  if (handed === NONE) return
  draft.covers[handed] = needsCover(context, handed) ? PITCHER_SLOT : NONE
}

/** b23a4 — 공 가진 야수가 루로 가고 있으면 그 루의 커버다 (b23a6 0xb0c90 을 다시 읽는다 — 자리 잡기 뒤의 야수) */
export function claimHolderTargetBase(draft: CoverDraft, holderSlot: number): void {
  const holder = draft.working[holderSlot]
  if (holder === undefined || holder.aiState === AI_STATE.RECEIVE) return
  const base = baseAtPoint(holder.target)
  if (base !== NONE) draft.covers[base] = holderSlot
}
