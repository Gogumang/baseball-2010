import { recordAbilityOf } from '@/entities/season-mode/model/seasonEntry/otherSlices'
import type { SeasonEntryRecordParts } from '@/entities/season-mode/model/seasonEntry/types/records'

/**
 * 기록으로 선 선수의 경기 능력치 `0xb6414(기록, k, 1)` — 니블은 시즌 명단 값(`SeasonPlayer.equipment` — 장비 창이 쓴 것),
 * 없으면 영입 때 옮긴 기록의 니블. 밑값이 없는 옛 사본은 `ability` 그대로.
 */
export function seasonRecordAbilityOf(
  record: SeasonEntryRecordParts,
  rosterEquipment: readonly number[] | undefined,
  isPitcher: boolean,
): readonly [number, number, number, number] {
  if (record.baseAbility === undefined) return record.ability
  return recordAbilityOf(
    { ability: record.baseAbility, skillBits: record.skillBits ?? 0, equipment: rosterEquipment ?? record.equipment ?? [] },
    isPitcher,
  )
}

/**
 * 기록 +0xb 한 바이트 — 등록(타자 0x16f28 · 투수 0x16f9a)이 쓴 그대로: `타입 << 5 | 손 << 4 | 피부 << 2 | 아랫 2비트`.
 * 아랫 2비트는 타자 내야 0 · 외야 1, 투수 보직(0xb6dec). 카드 정보 칸 0x7c450 이 이 비트로 타입·손·피부·보직을 읽는다.
 */
export function seasonRecordProfileOf(typeIndex: number, handIndex: number, skinIndex: number, low: number): number {
  return ((typeIndex & 7) << 5) | ((handIndex & 1) << 4) | ((skinIndex & 3) << 2) | (low & 3)
}
