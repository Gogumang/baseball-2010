/**
 * 아이템 창 원본 배치 — binary.mod 0x81dc0 (layout-re 3차 명세, 틀·색은 바이트 확인).
 * 나만의리그 [아이템] 하위 메뉴의 [서브]·[GP] 가 이 창으로 온다. [장착] 은 다른 화면(0x83378)이다.
 */

/** 창 — mode_ui f33 박스0 */
export const ITEM_WINDOW = { x: 24, y: 48, width: 192, height: 212 } as const

export interface ItemBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 위 칸 두 개 — f33 박스1·2.
 * 왼쪽은 지금 보고 있는 목록 이름(img_text 105 "서브아이템" / 110 "GP아이템"),
 * 오른쪽은 img_text 302 "소지금" 과 금액이다. 목록을 바꾸는 것은 창이 아니라 관리 메뉴의 하위 커맨드다.
 * (명세는 "한쪽 탭에 소지금" 까지만 확인했고, 왼쪽/오른쪽 배정은 이 읽기다 — 부분 확인)
 */
export const TITLE_BOX = { x: 26, y: 50, width: 92, height: 15 } as const
export const MONEY_BOX = { x: 122, y: 50, width: 92, height: 15 } as const
export const TAB_LABEL_FRAMES = { 서브: 105, GP: 110 } as const
export const MONEY_LABEL_FRAME = 302

/** 아이콘 칸 10개 — mode_ui f34 (2줄 × 5칸, 33×33) */
export const SLOT_SIZE = 33
export const SLOT_XS: readonly number[] = [34, 69, 104, 139, 174]
export const SLOT_YS: readonly number[] = [77, 115]
export const SLOT_COUNT = SLOT_XS.length * SLOT_YS.length

export function slotPositionOf(index: number): { readonly x: number; readonly y: number } {
  return { x: SLOT_XS[index % SLOT_XS.length], y: SLOT_YS[Math.trunc(index / SLOT_XS.length)] }
}

/** 이름칸 f33 박스3 · 설명칸 박스4 · 가격칸 박스5 */
export const NAME_BOX = { x: 33, y: 163, width: 75, height: 15 } as const
export const DESCRIPTION_BOX = { x: 33, y: 180, width: 174, height: 65 } as const
export const PRICE_BOX = { x: 123, y: 163, width: 84, height: 15 } as const

/** 커서는 목록 칸을 1px 둘러싼다 (필살타법 창과 같은 방식) */
export const CURSOR_BLINK_PERIOD = 10
export const CURSOR_VISIBLE_UPDATES = 9

/**
 * 아이템 아이콘은 item_icon.pzx 를 목록 순서대로 쓴다 — 서브 k → k, GP k → 10+k.
 * 원본 아이콘 표(0x7e764)는 미해독이지만 **그림이 이름과 하나씩 맞는 것으로 확인했다**
 * (0 과녁=표적판, 1 바벨=1톤 바벨, 15 복권=또또상품권, 16 버섯=영지버섯, 17 주사기=종합건강진단,
 *  18 소용돌이=최면요법, 19 눈=이글아이).
 */
export const GP_ICON_OFFSET = 10

export function itemIconFrameOf(tab: '서브' | 'GP', index: number): number {
  return tab === 'GP' ? GP_ICON_OFFSET + index : index
}
