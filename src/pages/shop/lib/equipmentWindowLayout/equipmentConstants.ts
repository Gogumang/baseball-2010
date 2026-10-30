/** 장비 창 0x83378 의 프레임 · 박스 · 색 상수 — 그리는 차례는 `equipmentWindowLayout.ts` 머리말 */
import type { ShopBox } from '@/pages/shop/lib/shopLayout'

export type EquipmentEdition = '타자' | '투수'

/** mode_ui 프레임 — `0x7b970`(타자편) 이면 30, 아니면 31 (0x8339e~0x833aa) */
export const EQUIPMENT_FRAME: Readonly<Record<EquipmentEdition, number>> = { 타자: 30, 투수: 31 }

/** 박스 하나 */
const box = (x: number, y: number, width: number, height: number): ShopBox => ({ x, y, width, height })

/** 프레임 30 · 31 박스 (`public/sprites/mode_ui/frames/boxes.json` 의 "030" · "031" — 두 프레임이 같다) */
export const EQUIPMENT_BOXES = {
  tab: box(134, 164, 19, 13),
  label: box(26, 180, 37, 15),
  value: box(64, 180, 63, 15),
  row: box(134, 180, 70, 15),
  description: box(27, 233, 100, 37),
  scrollBar: box(207, 185, 7, 73),
  board: box(18, 176, 203, 90),
} as const

/** 탭 칸 수 · 한 화면 줄 수 ([목록+0x38] = 5, 0x815ea) · 줄 간격 (h + 2) */
export const EQUIPMENT_PART_COUNT = 4
export const EQUIPMENT_VISIBLE_ROWS = 5
export const EQUIPMENT_TAB_STEP = EQUIPMENT_BOXES.tab.width + 2

/** 이름표 img_text — 표 0xd495c [302 소지금 · 303 가격 · 333 효과] */
export const EQUIPMENT_LABEL_FRAMES: readonly number[] = [302, 303, 333]
/** 효과 줄의 능력치 이름 img_text — `[창+0x24c]`(타자 깃발) 이면 336 + 부위(히트·파워·수비·주루), 아니면 340 + 부위(제구·구속·변화·체력) */
export const ABILITY_LABEL_BASE: Readonly<Record<EquipmentEdition, number>> = { 타자: 336, 투수: 340 }
/** 효과 줄 능력치 이름은 img_text **팔레트 1**(노랑 #FFE352 · #FFB229)로 찍는다 (0x83f70 `0x913e5(애니, 1)`) */
export const ABILITY_LABEL_PALETTE = 1
/** num "+" 그림 (`[num+0x1a4]` = 105) */
export const PLUS_FRAME = 105
/** 잠긴 히든 칸 이름 0xd4c18 */
export const LOCKED_NAME = '????'

export const EQUIPMENT_MODE_UI_FRAME = {
  /** 21×14 노란 테 — 고른 부위 탭 (0xcc/4) */
  tabCursor: 51,
  /** 70×15 주황 막대 — 지금 낀 줄 (0x2b) */
  equippedBar: 43,
  /** 70×15 흰 막대 — 상점에서 가진 줄 (0x2c) */
  ownedBar: 44,
} as const

export const EQUIPMENT_COLORS = {
  tabLine: '#4A7BDE',
  tabLineDark: '#29318C',
  /** 설명 판 — 위·왼 선 #18244A · 채우기 #1D44A8 · 오른·아래 빛 #4A7DDE */
  panelEdge: '#18244A',
  panelFill: '#1D44A8',
  panelLight: '#4A7DDE',
  /** 목록 글색 (0x83802 · 0x83904 · 0x83984) */
  rowText: '#87F8FF',
  ownedText: '#CEC7BD',
  equippedText: '#182C6B',
  /** 설명 글 — 가격을 그리기 전 0x9c735(…, 흰색) (0x83d5c) */
  descriptionText: '#FFFFFF',
  cursor: '#FFFF00',
  /** 스크롤 막대 — 바탕 #102152 · 손잡이 흰 테 + #1D44A8 */
  scrollTrack: '#102152',
  scrollThumbEdge: '#FFFFFF',
  scrollThumb: '#1D44A8',
} as const

/** 설명 글 자리 — 0xba411(박스 4, 글, 정렬 0x11, ox 5, oy 5) */
export const DESCRIPTION_INSET = 5
/** 왼쪽 값·이름표 ox −2 (정렬 0x24) */
export const VALUE_RIGHT_INSET = 2
