import { COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'

/**
 * 시즌모드 커맨드 줄 — 공용 커맨드 줄 **0x7e418** 에 시즌 상태별 표를 얹는다 (직접 떴다).
 *
 * 표 고르기 **0x7e84c(gfx, 상태)** — 시즌 장면 0xe9ac 가 상태가 바뀐 틀마다(0xd3 · 0xdf · 0xe8 빼고) 부른다:
 * ```
 * [gfx+0x174] = 상태 · 칸 수 [gfx+0x180] · 아이콘 표 [gfx+0x178](mode_icon) · 글 표 [gfx+0x17c](img_text)
 * 0xc9        6  0xd47f4 [21, 22, 1, 3, 4, 5]     0xd4800 [117 시즌정보 · 226 구단관리 · 91 트레이닝 · 93 외출 · 94 아이템 · 89 다음경기]
 * 0xcd        4  0xd47e4 [23, 8, 9, 10]           0xd47ec [283 구단정보 · 94 아이템 · 90 선수정보 · 111 기록순위]
 * 0xce        4  0xd47d4 [26, 24, 27, 25]         0xd47dc [284 구장관리 · 118 트레이드 · 351 선수영입 · 285 코치채용]
 * 0xcf · 0xde 5  0xd47c0 [17, 11, 13, 14, 19]     0xd47ca [254 투구훈련 · 119 타격훈련 · 286 집중훈련 · 287 근성훈련 · 121 지옥훈련]
 * 0xd0        4  0xd47b0 [7, 26, 8, 20]           0xd47b8 [100 장착아이템 · 288 구장아이템 · 105 서브아이템 · 110 GP아이템]
 * 그 밖       0  (표를 비운다)
 * ```
 * 칸 자리: 메인 메뉴 [gfx+0x38] = 표 0xd4740 · 하위 메뉴 [gfx+0x68] = 표 0xd4758 앞에서부터 (나리와 같다 — `managementLayout`).
 * 0x7e418 은 [gfx+0x15c](하위 메뉴 객체)가 서 있으면 하위 칸을, 아니면 메인 칸을 그린다. 하위 메뉴의 부모 칸(메인 메뉴 커서 칸)은
 * 시즌이면 표 **0xd47f4** 아이콘(0x7e544 `0x7b998` 갈래 — 나리는 0xd4868)을 주황으로 (6, 245) 까지 미끄러뜨린다.
 * 하위 메뉴 객체는 0xcd(0x4d58) · 0xce · 0xcf · 0xd0 진입이 세우고, 그 하위 화면(0xd6 · 0xdc)에서도 남는다 —
 * 그때 칸 수가 0 이라 **부모 칸 하나만** 그려진다.
 * 회색 칸(0xc37a8)은 메인 메뉴의 켬 표(메뉴 +0x28)가 0 인 칸, 하위 메뉴는 상태 0xce 일 때만 그 메뉴의 켬 표를 본다.
 */

/** 0xd47f4 · 0xd4800 — 관리 메뉴 여섯 칸 (자리는 0xd4740) */
const SEASON_MAIN: readonly (readonly [string, number, number])[] = [
  ['시즌정보', 21, 117], ['구단관리', 22, 226], ['트레이닝', 1, 91], ['외출', 3, 93], ['아이템', 4, 94], ['다음경기', 5, 89],
]

export const SEASON_COMMAND_SLOTS: readonly MenuSlot[] = SEASON_MAIN.map(([id, icon, labelFrame], index) => ({
  id, x: COMMAND_SLOTS[index].x, y: COMMAND_SLOTS[index].y, icon, labelFrame,
}))

/** 하위 메뉴 칸 (표 0xd4758) */
const SUB_SLOT_POSITIONS: readonly (readonly [number, number])[] = [[44, 245], [82, 245], [122, 236], [161, 236], [199, 236]]

function subMenu(entries: readonly (readonly [string, number, number])[]): readonly MenuSlot[] {
  return entries.map(([id, icon, labelFrame], index) => ({
    id, x: SUB_SLOT_POSITIONS[index][0], y: SUB_SLOT_POSITIONS[index][1], icon, labelFrame,
  }))
}

export type SeasonSubMenuKind = '시즌정보' | '구단관리' | '트레이닝' | '아이템'

export const SEASON_SUB_COMMAND_SLOTS: Readonly<Record<SeasonSubMenuKind, readonly MenuSlot[]>> = {
  시즌정보: subMenu([['구단정보', 23, 283], ['아이템', 8, 94], ['선수정보', 9, 90], ['기록순위', 10, 111]]),
  구단관리: subMenu([['구장관리', 26, 284], ['트레이드', 24, 118], ['선수영입', 27, 351], ['코치채용', 25, 285]]),
  트레이닝: subMenu([['투구', 17, 254], ['타격', 11, 119], ['집중', 13, 286], ['근성', 14, 287], ['지옥훈련', 19, 121]]),
  아이템: subMenu([['장착아이템', 7, 100], ['구장아이템', 26, 288], ['서브아이템', 8, 105], ['GP아이템', 20, 110]]),
}

/** 하위 메뉴의 부모 칸 — 관리 메뉴에서 그 하위 메뉴를 여는 칸 */
export function seasonParentSlotOf(kind: SeasonSubMenuKind): MenuSlot {
  return SEASON_COMMAND_SLOTS.find((slot) => slot.id === kind) ?? SEASON_COMMAND_SLOTS[0]
}
