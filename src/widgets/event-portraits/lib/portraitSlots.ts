import type { EventPortrait } from '@/shared/config/original/eventTypes'

/** 원작 자리 목표 거리 (binary.mod 0xd4770). 왼쪽은 x = 거리, 오른쪽은 x = 화면폭 − 거리. */
export const SLOT_OFFSETS = [45, 75, 105] as const
/** 한쪽에 설 수 있는 자리 수 */
const SLOTS_PER_SIDE = SLOT_OFFSETS.length
/** 한 번 갱신에 목표 거리의 1/6 씩 들어온다 (0x7f998). */
export const SLIDE_DIVISOR = 6

export interface PlacedPortrait {
  readonly portrait: EventPortrait
  readonly slot: number
  /** 자리 목표 x (화면 기준) */
  readonly targetX: number
  /** 같은 자리에 같은 인물이 이어지면 다시 미끄러져 들어오지 않게 쓰는 열쇠 */
  readonly key: string
}

/** 명령의 초상화 목록을 좌우 자리에 나눈다. 나온 순서대로 자리를 채우고 넘치면 버린다. */
export function placePortraits(portraits: readonly EventPortrait[], screenWidth: number): PlacedPortrait[] {
  const used = { left: 0, right: 0 }
  const placed: PlacedPortrait[] = []
  for (const portrait of portraits) {
    const slot = used[portrait.side]
    if (slot >= SLOTS_PER_SIDE) continue
    used[portrait.side] += 1
    const offset = SLOT_OFFSETS[slot]
    placed.push({
      portrait,
      slot,
      targetX: portrait.side === 'left' ? offset : screenWidth - offset,
      key: `${portrait.side}-${slot}-${portrait.file}`,
    })
  }
  return placed
}

/** 미끄러져 들어온 뒤의 x. 자리 목표 거리의 1/6 씩, 갱신 횟수만큼 들어온다. */
export function slideX(placed: PlacedPortrait, update: number, screenWidth: number): number {
  const offset = SLOT_OFFSETS[placed.slot]
  const travelled = Math.min(offset, (offset / SLIDE_DIVISOR) * Math.max(0, update))
  return placed.portrait.side === 'left' ? travelled : screenWidth - travelled
}
