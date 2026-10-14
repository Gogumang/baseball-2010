/**
 * 상점·아이템 창 배치 (binary.mod 0x8453c → 0x81dc0 / 0x83378 — P6 3절 확정).
 *
 * 창 객체는 관리 장면의 0x7b7b8(크기 0x398)이고, 그림은 [this+0x138] = `ui/mode_ui.pzx` 다.
 * 갈림은 `[this+0x1a4]`(창 종류):
 *   1 서브아이템 상점 · 2 GP아이템 상점 · 3 장비 상점 · 4 구장 아이템  (R12 1a 표)
 * 0x8453c 는 **종류 3 이면 0x83378, 아니면 0x81dc0** 이다(0x84546 `cmp r3,#3`, 직접 떴다).
 *   — 종류 1·2 는 0x81dc0(프레임 33 박스 6개 + 34 격자 10칸, 이 파일),
 *     종류 3 장비는 0x83378(프레임 30 타자 · 31 투수, `equipmentWindowLayout`),
 *     종류 4 구장 아이템은 0xb158 이 0x83378 을 직접 부른다(프레임 32).
 *   P6 3절의 "==3 이면 구장 아이템" 은 0x8453c 의 갈림을 0x83378 안의 구장 갈래(종류 4)와 섞은 것이다.
 *
 * 스프라이트 확인 (public/sprites/mode_ui/frames):
 *   프레임 33·34 는 **PNG 가 없다** — 그림 없이 박스만 있는 배치 프레임이라 그렇다
 *   (프레임 54~57 대진 선분과 같은 꼴). 창·격자는 그림이 아니라 여기 좌표로 그린다.
 *   프레임 32 는 150×98, 원점 (64,165) 로 있다. 문서의 "박스 6 판 (18,176,203,90)" 과 크기가 다른데,
 *   PNG 는 **그림 54조각의 겉넓이**고 박스는 판 자리라 서로 다른 값이다.
 *   프레임 38(92×13 노란 꺾쇠) · 52(61×15 파란 막대) 는 문서 크기와 같다.
 */
import { ORIGINAL_COLORS } from '@/shared/config/design'

export const SCREEN = { width: 240, height: 320 } as const

export interface ShopBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 창 종류 [this+0x1a4] (R12 1a) — 장비(3)는 0x83378 장비 창으로 간다 */
export const SHOP_WINDOW_KIND = { 서브: 1, GP: 2, 장착: 3, 착용: 3, 구장: 4 } as const
export type ShopWindowKindName = keyof typeof SHOP_WINDOW_KIND

/**
 * mode_ui 프레임 33 박스 0~5 — 아이템·스킬 창 0x81dc0 (P6 3절 표).
 * 박스 0 은 공용 판 0x55e61(skin, 24, 48, 192, 212, 정렬 0x11, 16) 로 그려진다.
 */
export const WINDOW_BOX: ShopBox = { x: 24, y: 48, width: 192, height: 212 }
export const LEFT_TAB_BOX: ShopBox = { x: 26, y: 50, width: 92, height: 15 }
export const RIGHT_TAB_BOX: ShopBox = { x: 122, y: 50, width: 92, height: 15 }
export const NAME_BOX: ShopBox = { x: 33, y: 163, width: 75, height: 15 }
export const DESCRIPTION_BOX: ShopBox = { x: 33, y: 180, width: 174, height: 65 }
export const VALUE_BOX: ShopBox = { x: 123, y: 163, width: 84, height: 15 }

/** mode_ui 프레임 34 — 아이템 격자 10칸 33×33 (5열 × 2행) */
export const SLOT_SIZE = 33
export const SLOT_XS: readonly number[] = [34, 69, 104, 139, 174]
export const SLOT_YS: readonly number[] = [77, 115]
export const SLOT_COLUMNS = SLOT_XS.length
export const SLOT_ROWS = SLOT_YS.length
export const SLOT_COUNT = SLOT_COLUMNS * SLOT_ROWS

export function slotPositionOf(index: number): { readonly x: number; readonly y: number } {
  return { x: SLOT_XS[index % SLOT_COLUMNS], y: SLOT_YS[Math.trunc(index / SLOT_COLUMNS)] }
}

/**
 * mode_ui 프레임 32 박스 0~6 — 구장 아이템 창 0x83378 (P6 3절 · R12 4절).
 * 웹판에는 아직 구장 아이템 데이터가 없어서(R12 5절 "웹 미구현") 화면은 안 만들고 좌표만 둔다.
 * 나중에 시즌 구단관리를 옮길 때 이 값을 그대로 쓰면 된다.
 */
export const STADIUM_BOXES: readonly ShopBox[] = [
  { x: 134, y: 164, width: 19, height: 13 }, // 0 수치 칸
  { x: 26, y: 180, width: 37, height: 15 }, // 1
  { x: 64, y: 180, width: 63, height: 15 }, // 2
  { x: 134, y: 180, width: 70, height: 15 }, // 3
  { x: 27, y: 217, width: 100, height: 53 }, // 4 설명
  { x: 207, y: 185, width: 7, height: 73 }, // 5 스크롤 막대
  { x: 18, y: 176, width: 203, height: 90 }, // 6 판
]
/** 구장 아이템 판 색 (0x83378) — 선 #4A7BDE·#29318C, 칸 #1D44A8, 테두리 #18244A·#4A7DDE */
export const STADIUM_COLORS = {
  line: '#4A7BDE',
  lineDark: '#29318C',
  cellFill: ORIGINAL_COLORS.panelDeep,
  cellEdgeDark: '#18244A',
  cellEdgeLight: '#4A7DDE',
} as const

/** 머리 그림 — img_text 프레임 번호 (P6 3절 2번) */
export const HEAD_LABEL_FRAME = {
  스킬: 278,
  서브아이템: 105,
  GP아이템: 110,
  소지금: 302,
  가격: 303,
} as const
/** img_text 글 높이 (origins.json 확인 — 105·110·278·302·303 모두 10px) */
export const LABEL_HEIGHT = 10

/** mode_ui 프레임 번호 */
export const MODE_UI_FRAME = {
  /** 92×13 노란 꺾쇠 — 목록에 포커스가 없을 때 고른 탭 왼쪽 위(0x11)에 */
  tabCursor: 38,
  /** 61×15 파란 막대 — 소지금·가격 칸 바탕 */
  valueBar: 52,
} as const

/**
 * 색 (0x81ea2~0x82396).
 * `ORIGINAL_COLORS.tabSelected` 는 토큰 이름과 달리 **안 고른 탭** 색(#5897FF)이다 —
 * 고른 탭이 창 바탕과 같은 #335FCD(boardFill) 라서 앞선 이식이 거꾸로 붙인 이름이다. 여기서는 원본대로 쓴다.
 */
export const SHOP_COLORS = {
  tabOn: ORIGINAL_COLORS.boardFill,
  tabOff: ORIGINAL_COLORS.tabSelected,
  /** 이름 딱지 박스 3 — 채우기 #12307E, 위·왼 선 #0A266F, 아래·오른 빛 #5683F5 */
  nameFill: ORIGINAL_COLORS.bandDark,
  nameEdge: ORIGINAL_COLORS.nameBoxEdge,
  nameHighlight: ORIGINAL_COLORS.nameBoxDot,
  /** 값 박스 5 글색 — 노랑 RGB(255,255,0) */
  value: ORIGINAL_COLORS.highlightYellow,
  text: ORIGINAL_COLORS.text,
} as const

/**
 * 머리 칸 자리 — 0x81dc0 의 종류 1·5(0x81fb6~0x82134) · 종류 2(0x8216c~0x82254) 를 직접 떴다:
 * ```
 * 종류 1·5  박스 1  img_text 105 효과 11(#335FCD) 정렬 0x22
 *           박스 2  mode_ui 52 정렬 0x11 · (ox 30, oy 4) · img_text 302 팔레트 0 정렬 0x21 · (ox −4, oy 4)
 *                   소지금 0x63331(박스 2, 선수 +2 × 100, num, 정렬 0x24, ox −2, oy 4)
 *           박스 5  mode_ui 52 정렬 0x14 · img_text 303 팔레트 0 정렬 0x21          ; 0x8223a 로 GP 와 같은 꼬리
 * 종류 2    박스 1  img_text 110 효과 11(#335FCD) 정렬 0x22
 *           박스 5  mode_ui 52 정렬 0x14 · img_text 303 팔레트 0 정렬 0x21
 * 값        0x63331(박스 5, 가격 × 1000, num, 정렬 0x24, ox −2, oy 0)                ; 0x8286e
 * ```
 * 숫자 글꼴은 num 그림 목록을 그대로 받는 0x63118 이 `[목록 + 0x50 + 자리 × 4]` = **그림 20 + 자리**(주황)로 고른다.
 * P6 3절의 "0x63331(skin, 박스 2, …, 글꼴 36, 4)" 의 36 은 글꼴이 아니라 **정렬 0x24** 이고 4 는 oy 다
 * (postseasonBracketLayout 이 같은 오독을 짚었다). 앞서 웹은 이것을 글꼴로 읽어 num 36 부터 셌는데, num 30~39 가 하늘색 0~9 라
 * 숫자가 여섯씩 밀려 찍혔다.
 */
export const MONEY_BAR_OFFSET = { x: 30, y: 4 } as const
export const MONEY_LABEL_OFFSET = { x: -4, y: 4 } as const
export const MONEY_DIGIT_OFFSET = { x: -2, y: 4 } as const
export const VALUE_DIGIT_RIGHT_INSET = 2

/** 막대 52 를 놓는 왼쪽 위 — 정렬 0x11 이면 박스 왼쪽 위, 0x14 면 박스 오른쪽 위에 (ox, oy) 를 더한다 */
export function valueBarPositionOf(
  box: ShopBox, align: 0x11 | 0x14, barWidth: number, ox = 0, oy = 0,
): { readonly x: number; readonly y: number } {
  return { x: (align === 0x14 ? box.x + box.width - barWidth : box.x) + ox, y: box.y + oy }
}

/**
 * 박스 **안쪽** 좌표는 문서에 없어서 근사했다 (P6 3절이 박스 자리까지만 확정했다):
 *   이름 딱지 글 — 박스 3 가운데(0x22), 검정 그림자 (+1,+1) 뒤 흰 글 → 세로는 글 높이로 가운데 맞춤
 *   설명 — 박스 4 왼쪽 위(0x11) 에서 4px 안쪽, 줄 간격 13 (0xb9d35 의 줄 y 74/81 차가 7~8 이지만
 *          웹 글꼴이 더 커서 11px 글자에 맞는 13px 로 둔다)
 * *   격자 아이콘 — 33×33 칸 가운데
 */
export const INNER = {
  nameTextLeft: 5,
  nameShadow: 1,
  descriptionPadding: 4,
  descriptionLineHeight: 13,
} as const

/** 커서는 칸을 1px 둘러싸고 깜박인다 (필살타법 창 0x803d4 와 같은 방식) */
export const CURSOR_BLINK_PERIOD = 10
export const CURSOR_VISIBLE_UPDATES = 9

/**
 * 아이템 아이콘은 `item_icon.pzx` 를 목록 순서대로 쓴다 — 서브 k → k, GP k → 10+k (투수 GP 는 표 0xd4676).
 * 장비(창 종류 3)는 이 격자를 쓰지 않는다 — 0x8453c 가 종류 3 을 장비 창 0x83378(목록 줄)로 보낸다(`equipmentWindowLayout`).
 * (앞서 여기 "원본 아이콘 표 0x7e764" 라 적었으나 0x7e764 는 아이콘 표가 아니라 아래 **칸 바탕** 함수다.)
 */
export const GP_ICON_OFFSET = 10
export const SUB_ICON_COUNT = 10

export function itemIconFrameOf(kind: '서브' | 'GP', index: number): number | null {
  if (kind === '서브') return index < SUB_ICON_COUNT ? index : null
  return GP_ICON_OFFSET + index
}

/** 칸 바탕 0x7e764 의 색 — 셋째 인자(깃발)가 0 이면 파랑, 아니면 빨강·주황 (0x7e776~0x7e7bc). 0x81dc0 은 늘 0 으로 부른다 */
export const SLOT_CELL_COLORS = {
  normal: { edge: '#041D52', fill: '#2033AA', shine: '#3045CD' },
  flagged: { edge: '#932F31', fill: '#FF6C3F', shine: '#FFBD3C' },
} as const

export interface SlotCellRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

/**
 * 칸 바탕 0x7e764(창, 칸 xy, 칸 wh, 깃발, 0) — 격자 칸마다(0x82420, 칸 10개 모두) 아이콘보다 먼저 그린다. 직접 떴다:
 * ```
 * 7e7d2  0xba0bd(칸, 둥글기 1, 테 색)            ; 둥근 칠은 (w+1)×(h+1) 을 덮고 네 모서리 한 칸을 비운다
 * 7e800  0xb9f75((x+1, y+1), (w−1, h−1), 채우기 색)
 * 7e834  0xb9f75((x+2, y+2), (w−3, trunc((h−1)/2) − 2), 빛 색)   ; 위 절반 밝은 띠
 * ```
 */
export function slotCellRectsOf(cell: { readonly x: number; readonly y: number }, isFlagged = false): readonly SlotCellRect[] {
  const colors = isFlagged ? SLOT_CELL_COLORS.flagged : SLOT_CELL_COLORS.normal
  const { x, y } = cell
  const size = SLOT_SIZE
  return [
    // 둥근 칠 — 모서리를 뺀 테두리 네 변 (안쪽은 아래 채우기가 덮는다)
    { x: x + 1, y, width: size - 1, height: 1, color: colors.edge },
    { x: x + 1, y: y + size, width: size - 1, height: 1, color: colors.edge },
    { x, y: y + 1, width: 1, height: size - 1, color: colors.edge },
    { x: x + size, y: y + 1, width: 1, height: size - 1, color: colors.edge },
    { x: x + 1, y: y + 1, width: size - 1, height: size - 1, color: colors.fill },
    { x: x + 2, y: y + 2, width: size - 3, height: Math.trunc((size - 1) / 2) - 2, color: colors.shine },
  ]
}

/** 박스 가운데에 폭 w 짜리 그림을 놓을 왼쪽 x (정렬 0x22 의 가로) */
export const centeredLeftOf = (box: ShopBox, width: number) => box.x + Math.trunc((box.width - width) / 2)
/** 박스 가운데에 높이 h 짜리 그림을 놓을 위 y */
export const centeredTopOf = (box: ShopBox, height: number) => box.y + Math.trunc((box.height - height + 1) / 2)
