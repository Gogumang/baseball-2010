export type ManagementCommand = '선수정보' | '트레이닝' | '휴식' | '외출' | '아이템' | '다음경기'

export interface MenuSlot {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly icon: number
  readonly labelFrame: number
}

/** 하위 메뉴 칸 (표 0xd4758) */
const SUB_SLOT_POSITIONS: readonly (readonly [number, number])[] = [
  [44, 245],
  [82, 245],
  [122, 236],
  [161, 236],
  [199, 236],
]

function subMenu(entries: readonly (readonly [string, number, number])[]): readonly MenuSlot[] {
  return entries.map(([id, icon, labelFrame], index) => ({
    id,
    x: SUB_SLOT_POSITIONS[index][0],
    y: SUB_SLOT_POSITIONS[index][1],
    icon,
    labelFrame,
  }))
}

export type SubMenuKind = '선수정보' | '트레이닝' | '아이템'

/** 하위 메뉴 (0x7e84c — 아이콘 표 +0x178, 이름표 표 +0x17c) */
export const COMMAND_MENUS: Readonly<Record<SubMenuKind, readonly MenuSlot[]>> = {
  선수정보: subMenu([
    ['기본정보', 6, 96],
    ['장비착용', 7, 228],
    ['아이템/스킬', 8, 101],
    ['필살타법', 15, 115],
    ['기록실', 9, 297],
  ]),
  트레이닝: subMenu([
    ['히트', 11, 98],
    ['파워', 12, 103],
    ['수비', 13, 108],
    ['주루', 14, 113],
    ['필살타법', 15, 115],
  ]),
  아이템: subMenu([
    ['장착', 7, 100],
    ['서브', 8, 105],
    ['GP', 20, 110],
  ]),
}

/** 하위 메뉴가 열리면 부모 칸이 첫 메인 칸 자리(표 0xd4740[0])로 간다 (0x8003c) */
export const PARENT_SLOT_TARGET = { x: 6, y: 245 }

/** 칸 32×32. 좌3·우3 계단형 (표 0xd4740 · 초기화 0x7b590) — 아이콘 mode_icon 0~5 (표 0xd4868) */
export const COMMAND_SLOTS: readonly MenuSlot[] = [
  { id: '선수정보', x: 6, y: 245, icon: 0, labelFrame: 90 },
  { id: '트레이닝', x: 44, y: 245, icon: 1, labelFrame: 91 },
  { id: '휴식', x: 82, y: 245, icon: 2, labelFrame: 92 },
  { id: '외출', x: 122, y: 236, icon: 3, labelFrame: 93 },
  { id: '아이템', x: 161, y: 236, icon: 4, labelFrame: 94 },
  { id: '다음경기', x: 199, y: 236, icon: 5, labelFrame: 89 },
]
export const COMMAND_SLOT_SIZE = 32
/** 이름표 칸 (x, y+34, 32, 12) 가운데 */
export const COMMAND_LABEL_OFFSET_Y = 34
export const COMMAND_LABEL_HEIGHT = 12

/**
 * 이름표 정렬 — 0x7e418 이 0x7e300 에 넘기는 정렬 (0x7e666~0x7e67e 직접 떴다):
 * ```
 * [gfx+0x15c](하위 메뉴) ≠ 0 && 칸 > 1 && 칸 ≠ 4 → 0x21(왼쪽) ; 그 밖 0x22(가운데)
 * ```
 * 하위 메뉴의 칸 2·3 만 칸 왼끝에 붙는다(원본 그대로 — 칸 4 는 다시 가운데).
 */
export const COMMAND_LABEL_ALIGN = { left: 0x21, center: 0x22 } as const

export function commandLabelAlignOf(isSubMenu: boolean, index: number): number {
  return isSubMenu && index > 1 && index !== 4 ? COMMAND_LABEL_ALIGN.left : COMMAND_LABEL_ALIGN.center
}

/** 이름표 그림 왼쪽 — 그림은 테두리 1px 을 둘러 글자보다 1px 왼쪽에서 시작한다 */
export function commandLabelLeftOf(slotX: number, labelWidth: number, align: number): number {
  const glyphLeft = align === COMMAND_LABEL_ALIGN.left ? slotX : slotX + Math.trunc((COMMAND_SLOT_SIZE - labelWidth) / 2)
  return glyphLeft - 1
}
