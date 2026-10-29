import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'

/** 견제할 루에 주자가 섰나 — 0x34848 · 0x50f28 의 0xa9878 (주자 있는 루만) */
export function isBaseOccupied(bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }, base: PickoffBase): boolean {
  const occupied: Record<PickoffBase, boolean> = { 1: bases.first, 2: bases.second, 3: bases.third }
  return occupied[base]
}
