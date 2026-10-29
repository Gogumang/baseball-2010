import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import { MAGIC_TYPE_NUMBER } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { PitchSlotChoice } from '@/pages/pitching/ui/PitchSlotPicker'

/** 구질 칸 수 0~5 (0xb6d2c) */
const PITCH_SLOT_COUNT = 6

/** 구질 목록의 재료 — 레퍼토리 · 칸 번호 · 마구 칸 판정 · 남은 마구 횟수 */
export interface PitchSlotSource {
  readonly repertoire: readonly PitchTypeInfo[]
  /** 항목마다 구질 칸 번호 0~5 (0xb6d2c) — 안 넘기면 항목 차례를 칸으로 본다 */
  readonly repertoireSlots?: readonly number[] | undefined
  readonly isMagicType?: ((type: PitchTypeInfo) => boolean) | undefined
  readonly magicRemaining?: number | undefined
}

/** 마구 칸인데 남은 횟수가 0 이하 — 0x50db8 이 키를 버린다 */
export const isBlockedMagicOf = (source: PitchSlotSource, type: PitchTypeInfo): boolean =>
  source.magicRemaining !== undefined && source.isMagicType?.(type) === true && source.magicRemaining <= 0

/** 구질 번호 t (이름표 칸 + 1, 마구 22) — 장면 위 그림 재료 */
export function typeNumberOf(source: PitchSlotSource, type: PitchTypeInfo | null): number {
  if (type === null) return 0
  if (source.isMagicType?.(type) === true) return MAGIC_TYPE_NUMBER
  return PITCH_TYPES.findIndex((candidate) => candidate === type || candidate.name === type.name) + 1
}

/** 칸 0~5 마다 구질 번호 — 0xf 그림(0x4c4bc 4c528~)의 구질 이름표 */
export function slotTypeNumbersOf(source: PitchSlotSource): number[] {
  const numbers = Array.from({ length: PITCH_SLOT_COUNT }, () => 0)
  source.repertoire.forEach((type, index) => {
    const slot = source.repertoireSlots?.[index] ?? index
    if (slot >= 0 && slot < numbers.length) numbers[slot] = typeNumberOf(source, type)
  })
  return numbers
}

/** 구질 칸 설명 — 마구는 남은 횟수, 그 밖은 구속 · 변화 */
function slotDetailOf(source: PitchSlotSource, type: PitchTypeInfo): string {
  const { magicRemaining } = source
  if (source.isMagicType?.(type) === true && magicRemaining !== undefined)
    return `마구 · 남은 ${magicRemaining}회${magicRemaining <= 0 ? ' (못 던짐)' : ''}`
  return `구속 ${Math.round(type.speed * 100)} · 변화 ${Math.round((Math.abs(type.horizontalBreak) + Math.abs(type.verticalBreak)) * 100)}`
}

/** 0xf 구질 목록 칸 — 키 0x534d8 이 고르는 칸 번호 · 이름 · 설명 · 막힘 */
export function slotChoicesOf(source: PitchSlotSource): PitchSlotChoice[] {
  return source.repertoire.map((type, index) => ({
    slot: source.repertoireSlots?.[index] ?? index,
    name: type.name,
    detail: slotDetailOf(source, type),
    isBlocked: isBlockedMagicOf(source, type),
  }))
}
