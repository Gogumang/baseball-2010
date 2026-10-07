import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'

/**
 * 투수편(모드 3) 커맨드 줄 — 공용 0x7e418 에 0x7e84c 의 투수 표를 얹는다 (직접 떴다, 0x7e84c · 0x7b970 갈래):
 * ```
 * 0x69 · 0x7f          6  0xd4868 [0..5]               0xd4874 [90 선수정보 · 91 · 92 · 93 · 94 · 89]   (타자편과 같다)
 * 0x6a · 0x79~0x7c     5  0xd4840 [6, 7, 8, 19, 9]     0xd484a [96 기본정보 · 228 장비착용 · 101 아이템/스킬 · 298 마구/변화구 · 297 기록실]
 * 0x6b · 0x6c · 0x7d   5  0xd4818 [16, 17, 18, 12, 19] 0xd4822 [97 제구훈련 · 102 구속훈련 · 107 변화훈련 · 112 체력훈련 · 116 마구/변화구]
 * 0x6e · 0x6f          3  0xd480c [7, 8, 20]           0xd4812 [100 장착 · 105 서브 · 110 GP]                 (타자편과 같다)
 * ```
 * (타자편 모드 4 는 0xd4854/0xd485e · 0xd482c/0xd4836 을 쓴다.) 이름표 0x7e300 은 모드 3 이고 상태 0x6b·0x6c 에서
 * 이름표 116(0x74) 이면 칸 x 를 −6 한다 — 트레이닝 하위 메뉴의 칸 4.
 */
const SUB_SLOT_POSITIONS: readonly (readonly [number, number])[] = [[44, 245], [82, 245], [122, 236], [161, 236], [199, 236]]

function subMenu(entries: readonly (readonly [string, number, number])[]): readonly MenuSlot[] {
  return entries.map(([id, icon, labelFrame], index) => ({
    id, x: SUB_SLOT_POSITIONS[index][0], y: SUB_SLOT_POSITIONS[index][1], icon, labelFrame,
  }))
}

export type PitcherCommandKind = '관리' | '선수정보' | '트레이닝' | '아이템'

export const PITCHER_COMMAND_BAR: Readonly<Record<PitcherCommandKind, readonly MenuSlot[]>> = {
  관리: COMMAND_SLOTS,
  선수정보: subMenu([['기본정보', 6, 96], ['장비착용', 7, 228], ['아이템/스킬', 8, 101], ['구질', 19, 298], ['기록실', 9, 297]]),
  트레이닝: subMenu([['제구', 16, 97], ['구속', 17, 102], ['변화', 18, 107], ['체력', 12, 112], ['마구', 19, 116]]),
  아이템: COMMAND_MENUS.아이템,
}

/** 이름표 116 "마구/변화구" 의 x −6 (0x7e30c~0x7e336) — 트레이닝 하위 메뉴(0x6b)에서만 */
const SHIFTED_LABEL_FRAME = 0x74
const SHIFTED_LABEL_DX = -6

export function pitcherLabelDxOf(kind: PitcherCommandKind, slot: MenuSlot): number {
  return kind === '트레이닝' && slot.labelFrame === SHIFTED_LABEL_FRAME ? SHIFTED_LABEL_DX : 0
}

/** 하위 메뉴의 부모 칸 — 관리 메뉴에서 그 하위 메뉴를 여는 칸 */
export function pitcherParentSlotOf(kind: PitcherCommandKind): MenuSlot | null {
  if (kind === '관리') return null
  return COMMAND_SLOTS.find((slot) => slot.id === kind) ?? null
}
