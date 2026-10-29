/**
 * **장비 창 0x83378** — 상점(상태 111)·장비착용(121)의 창 종류 3.
 *
 * 창 그리기 0x8453c 는 `[창+0x1a4] == 3` 이면 0x83378, 아니면 0x81dc0 으로 간다(0x84546 `cmp r3,#3`, 직접 떴다).
 * 그래서 장비는 서브·GP 의 10칸 격자(0x81dc0, mode_ui 프레임 33·34)를 **쓰지 않는다** — 앞서 웹이 44칸 격자에 레벨
 * 숫자를 적어 둔 것은 웹이 만든 꼴이었다. 0x83378 은 시즌 구장 아이템(종류 4, 0xb158 이 직접 부른다)과 같은 함수다.
 *
 * 배치는 mode_ui **프레임 30(타자, `0x7b970` 참) · 31(투수)** 박스 일곱 개(0x833a6~0x833ba, 시즌·종류 4 면 프레임 32):
 * ```
 * 박스 0 (134,164,19,13)  부위 탭 칸 — 네 칸이 x 로 (폭 + 2) 씩. 프레임 그림에 부위 아이콘 넷이 들어 있다
 * 박스 1 (26,180,37,15)   왼쪽 이름표 세 줄 — img_text 표 0xd495c [302 소지금 · 303 가격 · 333 효과]
 * 박스 2 (64,180,63,15)   왼쪽 값 세 줄 — 소지금 · 가격 · 효과(능력치 이름 + "+" + 보너스)
 * 박스 3 (134,180,70,15)  오른쪽 목록 다섯 줄 — 장비 이름
 * 박스 4 (27,233,100,37)  설명 (프레임 32 는 (27,217,100,53))
 * 박스 5 (207,185,7,73)   스크롤 막대
 * 박스 6 (18,176,203,90)  판 0x7c110(창, 박스 6, 1)
 * ```
 * 줄 간격은 박스 높이 + 2 = 17 이다(0x836be · 0x8434a).
 *
 * 그리는 차례 (0x83378, 직접 떴다):
 * ```
 * 833f6  판 0x7c110(창, 박스 6, 1)
 * 83426  박스 0 칸마다(4) 세로선 (x, y)~(x, y + h − 2) #4A7BDE · (x + 1, …) #29318C, x += w + 2
 * 8349a  박스 4 설명 판 (`descriptionPanelRectsOf`)
 * 8360a  프레임 그림 (vt+0x10, (0, 0)) — 부위 아이콘 · 왼쪽 막대 셋 · 오른쪽 막대 다섯 · ▲▼
 * 83630  이름표 셋 — img_text 팔레트 0, 박스 1 줄 k 에 정렬 0x24 · ox −2 (시즌 · 종류 ≠ 3 이면 셋째 줄은 건너뜀)
 * 83714  소지금 0x63331(박스 2 줄 0, 선수 +2 × 100, num, 정렬 0x24, ox −2)
 * 83740  부위 탭 커서 mode_ui 51 — [창+0x1a8](목록 초점) 이거나 틱 % 10 ≠ 0 이면 (박스0.x + 2 + (w + 2)·부위, 박스0.y) 칸 가운데
 * 837ea  목록 줄 (위 줄부터 다섯 줄, `줄 ≥ 개수` 면 건너뜀):
 *          글색 하늘 (135,248,255) · 바탕 없음
 *          상점(상태 111)이고 가진 것  → 바탕 mode_ui 44(흰 막대) · 글색 베이지 (206,199,189)
 *          지금 낀 것(니블 − 1 == 레벨)  → 바탕 mode_ui 43(주황 막대) · 글색 남색 (24,44,107)   ; 가진 것보다 나중이라 이긴다
 *          이름 — 레벨 > 6 이고 해금표(0x9f69d)가 0 이면 0xd4c18 "????", 아니면 0x832e8 이름 · 0xba411 정렬 0x22
 *          목록 초점이고 고른 줄이면:
 *            83c28  틱 % 10 ≠ 0 이면 노랑 (255,255,0) 사각 테두리 0xb9ed5(줄 박스)
 *            83d38  가격 0x63331(박스 2 줄 1, 표 0xd4510 × 1000 만원 — 타자면 +44칸)
 *            83de8  효과 줄 (박스 2 줄 2) — `effectRowLayoutOf`
 *            84256  설명 (박스 4, 정렬 0x11, (5, 5)) — `equipmentRows` 의 description
 * 84380  스크롤 막대 (`scrollBarRectsOf`, 한 화면 5줄)
 * ```
 */
export {
  ABILITY_LABEL_BASE,
  ABILITY_LABEL_PALETTE,
  DESCRIPTION_INSET,
  EQUIPMENT_BOXES,
  EQUIPMENT_COLORS,
  EQUIPMENT_FRAME,
  EQUIPMENT_LABEL_FRAMES,
  EQUIPMENT_MODE_UI_FRAME,
  EQUIPMENT_PART_COUNT,
  EQUIPMENT_TAB_STEP,
  EQUIPMENT_VISIBLE_ROWS,
  LOCKED_NAME,
  PLUS_FRAME,
  VALUE_RIGHT_INSET,
} from '@/pages/shop/lib/equipmentWindowLayout/equipmentConstants'
export type { EquipmentEdition } from '@/pages/shop/lib/equipmentWindowLayout/equipmentConstants'
export {
  BOARD_COLORS,
  boardRectsOf,
  descriptionPanelRectsOf,
  scrollBarRectsOf,
  tabSeparatorRectsOf,
} from '@/pages/shop/lib/equipmentWindowLayout/pixelRects'
export type { PixelRect } from '@/pages/shop/lib/equipmentWindowLayout/pixelRects'
export { alignedPositionOf, digitShiftOf, effectOffsetsOf, rowBoxOf, tabCursorBoxOf } from '@/pages/shop/lib/equipmentWindowLayout/placement'
