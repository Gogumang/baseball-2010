import { SEASON_EQUIPMENT_LEVEL_COUNT } from '@/entities/season-mode/model/seasonEquipment'
import { EQUIPMENT_WINDOW } from './layout'

/** 칸 목록 커서 한 걸음 — 1 열 × 11 줄, 깃발 0x30 이라 끝에서 감는다 */
export function moveEquipmentLevel(level: number, step: -1 | 1): number {
  return (level + step + SEASON_EQUIPMENT_LEVEL_COUNT) % SEASON_EQUIPMENT_LEVEL_COUNT
}

/** 부위 목록 커서 한 걸음 — 4 열 × 1 줄, 감는다 */
export function moveEquipmentPart(part: number, step: -1 | 1): number {
  return (part + step + 4) % 4
}

/** 굴림 0x6c2bd — 커서가 보이는 다섯 줄 밖이면 겨우 보이게만 맨 윗줄을 옮긴다 */
export function scrolledEquipmentTopOf(top: number, cursor: number): number {
  if (cursor < top) return cursor
  if (cursor >= top + EQUIPMENT_WINDOW.visibleRows) return cursor - EQUIPMENT_WINDOW.visibleRows + 1
  return top
}
