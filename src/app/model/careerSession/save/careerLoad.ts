import { batterCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 옛 저장의 컬렉터 해금을 보유에서 다시 센다 — 이미 있으면 그대로 */
export function withBatterCollectorIds(career: PlayerCareer | null): PlayerCareer | null {
  if (career === null) return null
  const missing = batterCollectorHiddenIdsOf(career).filter((id) => !career.openedHiddenIds.includes(id))
  return missing.length === 0 ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, ...missing] }
}
