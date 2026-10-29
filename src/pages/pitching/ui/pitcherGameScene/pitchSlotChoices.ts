import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlotChoice } from '@/pages/pitching/ui/PitchSlotPicker'

/** 마구 칸의 덧글 — 남은 횟수, 0 이면 못 던짐 */
const magicDetailOf = (magicRemaining: number) => `마구 · 남은 ${magicRemaining}회${magicRemaining === 0 ? ' (못 던짐)' : ''}`

/** 칸 5 는 '0' 키 자리다 (0x534d8 의 메시지 7). 빈 칸(구질 0)은 그리지 않는다 */
export function slotChoices(magicRemaining: number, slots: readonly PitchSlot[]): PitchSlotChoice[] {
  return slots
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => ({
      slot: slot.slot,
      name: slot.name,
      ...(slot.isMagic ? { detail: magicDetailOf(magicRemaining) } : {}),
      isBlocked: !canSelectSlot(slot, magicRemaining),
    }))
}

/** 칸 0..5 의 구질 번호 (경기 +0xfac + 4·칸) — 장면 위 구질 목록 재료 */
export function slotTypeNumbersOf(slots: readonly PitchSlot[]): number[] {
  const numbers = [0, 0, 0, 0, 0, 0]
  for (const slot of slots) if (slot.slot >= 0 && slot.slot < numbers.length) numbers[slot.slot] = slot.typeNumber
  return numbers
}
