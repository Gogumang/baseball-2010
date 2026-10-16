import { ABILITY_AXIS_ANGLES, abilityVertexOf } from '@/pages/create-player/lib/teamSelectLayout'
import type { ChartPoint } from '@/pages/create-player/lib/teamSelectLayout'

/**
 * 스페셜 목록 배치 (메인 메뉴 상태 6 — P6 2d).
 *
 * 그리기 = 메뉴 판 `0x24b1c`(반원 바퀴, F-5) + **하위 목록 `0x2524c`** + 머리띠 `0x54d95(skin, 0, 5)`
 * (제목 "2010프로야구", 바닥 되돌아가기 — P6 1-1).
 *
 * 항목 그림은 `mainui/main_ui.pzx` 의 **프레임**이고 상태 6 의 표는 `0xceb2f` 다 (여덟 칸, 확정).
 * 칸 차례는 갱신 표 `0xceb88`(하위 상태 24~31)·설명 `StrMAINMENU[16]~[23]` 과 같다.
 */

export const SCREEN = { width: 240, height: 320 } as const

/** 웹판에서 그 칸이 실제로 되는지 — 원본에 있는 칸은 못 써도 지우지 않고 흐리게 보여 준다 */
export type SpecialItemState = '됨' | '통신' | '아직'

export interface SpecialItem {
  readonly id: string
  /** main_ui 프레임 번호 (표 0xceb2f) */
  readonly labelFrame: number
  /** 프레임 그림 크기 — PNG 머리에서 읽은 실제 값 (origins.json 은 다 (0,0) 원점이다) */
  readonly labelWidth: number
  readonly labelHeight: number
  /** 원본 하위 상태 (표 0xceb88, P6 1-2 표) */
  readonly state: number
  /** 설명 글 StrMAINMENU[16 + 칸] 원문 (base/extracted/StrMAINMENU.json) */
  readonly description: string
  readonly availability: SpecialItemState
  /** 못 쓰는 칸을 눌렀을 때 띄우는 안내 (환경설정 "게임 데이터 관리" 와 같은 말투) */
  readonly blockedText?: string
}

/**
 * 여덟 칸 — 15 G포인트충전 · 16 G포인트선물 · 17 친구추천 · 18 명예의전당 ·
 * 19 마선수선택 · 20 에디트 · 21 기록연감 · 28 선물받기 (표 0xceb2f 확정).
 *
 * 항목 글자는 원본이 `#212B70`(RGB 33,43,112) 로 칠해 그리는데(프레임 그리기 색 인자),
 * 뽑아 둔 PNG 가 이미 그 남색이라 따로 칠하지 않는다.
 */
export const SPECIAL_ITEMS: readonly SpecialItem[] = [
  {
    id: 'G포인트 충전', labelFrame: 15, labelWidth: 124, labelHeight: 27, state: 24,
    description: 'G포인트를 충전!N할 수 있습니다', // [16]
    availability: '통신', blockedText: 'G포인트 충전은!N통신이 필요합니다',
  },
  {
    id: 'G포인트 선물', labelFrame: 16, labelWidth: 125, labelHeight: 27, state: 25,
    description: '친구에게 G포인트를!N선물할 수 있습니다', // [17]
    availability: '통신', blockedText: 'G포인트 선물은!N통신이 필요합니다',
  },
  {
    id: '친구추천', labelFrame: 17, labelWidth: 97, labelHeight: 27, state: 26,
    description: '친구에게 2010프로야구를!N추천할 수 있습니다', // [18]
    availability: '통신', blockedText: '친구추천은!N통신이 필요합니다',
  },
  {
    id: '명예의전당', labelFrame: 18, labelWidth: 115, labelHeight: 27, state: 27,
    description: '명예 선수를 확인하거나!N선물할 수 있습니다', // [19]
    availability: '됨',
  },
  {
    id: '마선수선택', labelFrame: 19, labelWidth: 118, labelHeight: 27, state: 28,
    description: '마선수의 오픈이나 레벨을!N관리할 수 있습니다', // [20]
    // 상태 28 (그리기 0x2df78 · 갱신 0x2af20) — 화면은 앱이 `renderAceSelect` 로 꽂는다 (pages 끼리 import 금지)
    availability: '됨',
  },
  {
    id: '에디트', labelFrame: 20, labelWidth: 73, labelHeight: 27, state: 29,
    description: '선수의 이름을 자유롭게!N변경할 수 있습니다', // [21]
    // 상태 29 (진입 0x24804 · 갱신 0x2b2e0 · 그리기 0x2e1e0) — 화면은 앱이 `renderEdit` 으로 꽂는다 (pages 끼리 import 금지)
    availability: '됨',
  },
  {
    id: '기록연감', labelFrame: 21, labelWidth: 97, labelHeight: 27, state: 30,
    description: '각종 기록과 게임 통계를!N확인할 수 있습니다', // [22]
    availability: '됨',
  },
  {
    id: '선물받기', labelFrame: 28, labelWidth: 90, labelHeight: 25, state: 31,
    description: '친구에게 받은 선물을!N확인할 수 있습니다', // [23]
    availability: '통신', blockedText: '선물받기는!N통신이 필요합니다',
  },
]

export const ITEM_COUNT = SPECIAL_ITEMS.length

/**
 * **목록 = 메인 메뉴 아랫단과 같은 세로 릴 0x2524c(this, 6, 틱)** — 그리기 0x2860c 는 0x2863c(게임시작 5)와 목록 종류만 다르다
 * (0x2860c: `0x24b1c(this)` → `0x2524c(this, 6, [this+0x2c])` → `0x54d95(skin, 0, 5)`, 직접 떴다).
 * 그래서 줄 y · 바탕 띠 · 설명 판 · 회색 제목 · 설명 띠는 `pages/main-menu/lib/mainMenuLayout` 의 `MENU_REEL_*` ·
 * `MENU_BAND_*` · `MENU_DESCRIPTION_PANEL` 을 그대로 쓴다 (S9 7절):
 * ```
 * 줄 글자 = img_text 0xcea24 [7, 11, 189, 14, 17, 19, 21, 315] — 슬롯 표 0xceaf2[1] = [−1, 6, 7, 8, 1, 2, 3, 4, 5]
 * 슬롯 1·2·3 y = 320 + 20i − 100 − 7 (+ 스크롤) · 4 는 안 그림(판이 대신) · 5·6·7 은 320 + 20i − 60 (화면 밖)
 * 설명 판 main_ui 이미지 3 (96, 289) · 판 안 큰 글자 main_ui 프레임(칸) · 회색 제목 img_text 0xcea6c[1] = 1 "스페셜"
 * 설명 띠 0x55545(StrMAINMENU[0x10 + 커서]) — 바탕 띠가 자라는 동안은 줄 · 띠를 안 그린다(0x254d8)
 * ```
 * 판 안 큰 글자의 main_ui 프레임은 표 0xceb2f (`SPECIAL_ITEMS[].labelFrame`).
 */
export const SPECIAL_REEL_STATE = 6

/*
 * 설명 판 까딱임 — 판 그리기 0x25716~0x25752 가 판 자리에 더한다.
 *
 * 갱신 0x28b9c 가 ↑ · ↓ 에 [메뉴+0xf4] = 1 을 세우고 0x5550d 로 방향([skin+0x8c])을 적는다(0x28c56~0x28c8a).
 * 그리기 머리 0x252c6~0x252e8 이 [+0xf4] 면 t [메뉴+0xf8] = 0 · 방향 [메뉴+0xfc] = [skin+0x8c], 판 그리기가
 * [+0xfc] ≠ −1 이면 판 자리에 `0xce8bc[2·방향 + t]` · `0xce88c[3·방향 + t]` 를 더하고 t 를 올린다(t > 1 이면 −1).
 * 판 안 큰 글자 · 회색 제목도 판 자리에서 재므로 함께 까딱인다 — 표 값은 기록연감과 같다(`shared/lib/cursorShake`):
 * ↑ (0,−2)(0,+2) · ↓ (0,+2)(0,−2), 두 그리기.
 * 키는 [메뉴+0xe1] ≠ 0 이고 바탕 띠가 다 자랐을 때([메뉴+0xe2] == 0)만 받는다(0x28ba0~0x28bb4).
 */

/*
 * 반원 바퀴 (0x24b1c — F-5 확정)는 메인 메뉴의 `MenuWheel`(pages/main-menu/ui/MenuWheel.tsx)을 그대로 깐다 —
 * 중심 (120, 320), 테두리 원 3겹 반지름 93·95·97, 가운데에서 `main_ball` 애니 0 이 돈다.
 */

/**
 * 머리띠·바닥띠 `0x54d95(skin, 0, 5)` — 다 내려온 상태 (P6 1-1 확정).
 * 그림은 `ui/game_frame.pzx`, 제목번호 0 → 이미지 3 "2010프로야구", 바닥 비트 5 = 되돌아가기만.
 *
 * **미끄러지지 않는다 — 원본 그대로**: 상태 6 들어옴 0x23d60(들어옴 표 0xcf06c 칸 4)은 [skin+0x84] 를 안 세우고,
 * 그리기 0x2860c 는 0x63b14 를 안 부른다(`ScreenFrame` 의 `slides` 머리말 전수). 머리띠는 앞 화면(처음 메뉴 상태 4)에서
 * 다 내려온 그대로다 — 다 내려온 자리에 바로 그린다.
 */
export const HEADBAND = {
  /** fillRect(0, −8, W, 15) #3145C6 → 화면에는 y 0~6 */
  band: { y: -8, height: 15, color: '#3145C6' },
  /** 선 y = 6·7 RGB(33,51,160) */
  line: { y: 6, height: 2, color: '#2133A0' },
  /** 이미지 0 (49×30 파란 막대) 을 x = −10, 39, 88 · 이미지 1 (30×30 사선 끝) 을 x = 135, y = 3 */
  tileImage: 0, tileXs: [-10, 39, 88], cornerImage: 1, cornerX: 135, tileY: 3,
  /** 제목 이미지 3 "2010프로야구" (123×21) 를 (8, 7) */
  title: { image: 3, x: 8, y: 7 },
} as const

export const FOOTER = {
  /** fillRect(0, 315, W, 5) #4074FB + 선 y=315 RGB(24,52,124) */
  band: { y: 315, height: 5, color: '#4074FB' },
  line: { y: 315, color: '#18347C' },
  /** 오른쪽 탭: 이미지 20(7×16) 을 x = 233…198, 이미지 19(16×16 사선) 를 x = 182, y = 300 */
  tileImage: 20, tileXs: [233, 226, 219, 212, 205, 198], cornerImage: 19, cornerX: 182, tileY: 300,
  /** 바닥 비트 0x4 = 되돌아가기 이미지 21 (19×13) 을 (W − 19 − 15 = 206, 304) */
  backIcon: { image: 21, x: SCREEN.width - 19 - 15, y: 304, width: 19, height: 13 },
} as const

/**
 * 명예의 전당 (하위 상태 27 = 공용 목록 페이지 `0x63b15` 의 **k = 8**) — P6 2a-3 · S9 3~4절.
 *
 * 화면은 위쪽 **자세히 보기 두 자리**(A = 선수, B = 능력치)와 아래쪽 **5×3 격자 15칸**,
 * 그리고 커서 칸 옆에 뜨는 **말풍선**(친구에게 선물 / 슬롯에서 삭제) 으로 되어 있다.
 *
 * 격자는 공용 위젯 `0x79ed5(격자, 6, 120, H/2 + 19 = 179, 칸너비표, 줄높이 40, 5열, 3행, …)` 이고,
 * 그리기 `0x7a571` 의 식은 S9 4절에서 확정됐다:
 * ```
 * 왼쪽 x = cx − (Σ칸너비 + (열−1)·가로틈)/2        위쪽 y = cy (가운데 정렬 안 함)
 * x[i] = 왼쪽 + 열·(칸너비 + 가로틈)              y[i] = 위쪽 + 줄·(줄높이 + 세로틈)
 * 종류 6 이면 y[i] -= 0xd40b8[열] = [3,3,3,13,13]  ← 4·5열만 10px 더 위
 * ```
 * 칸너비 표는 0xd1df8 = [40 ×5], 가로 · 세로틈 0 이다(0x651be~0x651d6) — 왼쪽 x 가 20, 칸이 (20·60·100·140·180) 로 떨어진다.
 * 칸 바탕(남색 둥근 네모)은 **없다** — 시작 0x7a005 의 넷째 인자 [격자+8] = 0 (0x651e6). 칸 그림은 `HALL_OF_FAME_CELL_ART`.
 * 시작 셋째 인자 [격자+6] = 1 이라 커서 튕김(`useGridCursorBounce`)은 있다.
 */
export const HALL_OF_FAME_GRID = {
  kind: 6,
  centerX: 120,
  /** cy = H/2 + 19 — **첫 줄 위쪽 y** 다 (가운데가 아니다, S9 3-2) */
  firstRowY: SCREEN.height / 2 + 19,
  columns: 5,
  rows: 3,
  /** 칸너비 표 = 0xd1df8 [40 ×5] (0x63b3a 에서 [sp+0x294] 로 베끼고 0x651be 가 다섯째 인자로 넘긴다, 직접 떴다) */
  cellWidth: 40,
  rowHeight: 40,
  /** 가로 · 세로틈 0 — 0x79ed5 아홉째 · 열째 인자가 둘 다 r5 = 0 이다(0x651c6 · 0x651d4 · 0x651d6, 직접 떴다) */
  horizontalGap: 0,
  verticalGap: 0,
  /** 종류 6 의 열별 y 보정 표 0xd40b8 (확정) */
  columnYAdjust: [3, 3, 3, 13, 13],
} as const

/**
 * 명전 격자의 **칸 그림** — 종류 3 · 6(k 6 · 8)은 0x7ac2e, 칸 바탕(남색 둥근 네모)은 없다: 시작 0x7a005(격자, [skin+0xe8], 1, 0) 의
 * 넷째 인자 [격자+8] = 0 이라(0x651e6 `movs r3, #0`) 0x7a7da 가 바탕 갈래를 건너뛴다. 칸마다 (직접 떴다):
 * ```
 * 7ac4e  slt_frame 이미지 0(39×38) 을 (x, y)                                   ; 칸 틀
 *        가운데 (cx, cy) = (x + 39/2, y + 38/2) — 아래 그림은 모두 (cx − w/2, cy − h/2)
 *        칸 상태 [목록+0x20c + 칸×8] (점프표 0xd40e8):
 * 7acb6    0 → 이미지 115 (×)
 * 7ad02    1 · 3 → 칸 ≤ 4 ? 23 (글러브) : 24 (방망이) 위에 딱지 0xd40a0[[목록+0x20c + 칸×8 + 4]]
 *              딱지 표 0xd40a0 = [28 BAL, 30 SLG, 29 SPD, 25 OVER, 27 SIDE, 26 UNDER] — 칸 채우기 0x5eb8c 가 투수는
 *              (폼 rec+0xb >> 4) >> 1 + 3 (0x5ed92 · 0x5ed8c 0xb6e25), 타자는 rec+0xb >> 5 (0x5ede4 · 0x5ee46) 를 적는다 = 타입
 * 7adcc    2 · 4 → 칸 ≤ 4 ? 21 (어두운 글러브) : 22 (어두운 방망이)
 * 7ae54    5 → 31 (자물쇠)
 * 7aeaa  목록 종류 [목록+0x1fc] == 3(나리 145 등록)이고 전역 모드 [0x1552d10] 가 3(투수편)이면 칸 > 4, 4(타자편)이면 칸 ≤ 4 를
 *        0x6b7d5(gfx, x, y, 39, 38, 둥글기 1, 0x80000000) — 반투명 검정으로 덮는다
 * ```
 * 커서는 열림 애니가 끝났고([격자+9]) 깜빡일 때([격자+0x18] % 8 ≤ 4) slt_frame 이미지 1(42×42) 을 (x − 2, y − 2) (0x7b3a0 → 0x7b432).
 */
export const HALL_OF_FAME_CELL_ART = {
  frame: { image: 0, width: 39, height: 38 },
  cursor: { image: 1, dx: -2, dy: -2 },
  none: { image: 115, width: 19, height: 19 },
  /** 찬 칸 — [투수 칸, 타자 칸] */
  filled: [{ image: 23, width: 25, height: 27 }, { image: 24, width: 31, height: 31 }],
  /** 빈 칸 — [투수 칸, 타자 칸] */
  empty: [{ image: 21, width: 27, height: 29 }, { image: 22, width: 33, height: 33 }],
  locked: { image: 31, width: 21, height: 25 },
  /** 딱지 표 0xd40a0 — 타자 타입 0 · 1 · 2, 투수 타입 0 · 1 · 2 (+3) */
  typeLabels: [
    { image: 28, width: 19, height: 7 },
    { image: 30, width: 19, height: 7 },
    { image: 29, width: 19, height: 7 },
    { image: 25, width: 25, height: 7 },
    { image: 27, width: 21, height: 7 },
    { image: 26, width: 31, height: 7 },
  ],
  /** 덮개 0x80000000 — 위 바이트 알파 0x80 */
  dimOpacity: 0x80 / 0xff,
} as const

export interface HallOfFameCellImage {
  readonly image: number
  readonly width: number
  readonly height: number
}

/**
 * 칸 하나에 칸 틀 위로 그리는 그림 (차례대로, 모두 칸 가운데 맞춤 — `HALL_OF_FAME_CELL_ART` 머리말).
 * `typeIndex` 는 찬 칸 선수의 타입 — 모르면(생김새 없는 옛 저장) 딱지를 뺀다(⚠️ 웹 저장 한계).
 */
export function hallOfFameCellImagesOf(slot: number, state: HallOfFameSlotState, typeIndex: number | null): readonly HallOfFameCellImage[] {
  const art = HALL_OF_FAME_CELL_ART
  const side = slot < HALL_OF_FAME_PITCHER_SLOTS ? 0 : 1
  if (state === 0) return [art.none]
  if (state === 5) return [art.locked]
  if (state === 2 || state === 4) return [art.empty[side]]
  const label = typeIndex === null ? undefined : art.typeLabels[(side === 0 ? 3 : 0) + typeIndex]
  return label === undefined ? [art.filled[side]] : [art.filled[side], label]
}

/** 그림 하나의 왼쪽 위 — 칸 가운데 (x + 39/2, y + 38/2) 에서 (w/2, h/2) 를 뺀다 (모두 양수라 내림) */
export function hallOfFameCellImageTopLeftOf(image: HallOfFameCellImage): { readonly dx: number; readonly dy: number } {
  const { frame } = HALL_OF_FAME_CELL_ART
  return {
    dx: Math.floor(frame.width / 2) - Math.floor(image.width / 2),
    dy: Math.floor(frame.height / 2) - Math.floor(image.height / 2),
  }
}

/** 0x7aeaa — 나리 145 등록에서 지금 편이 아닌 칸을 덮나 (투수편은 칸 > 4, 타자편은 칸 ≤ 4) */
export function isHallOfFameCellDimmed(edition: '투수' | '타자' | null, slot: number): boolean {
  if (edition === null) return false
  return edition === '투수' ? slot >= HALL_OF_FAME_PITCHER_SLOTS : slot < HALL_OF_FAME_PITCHER_SLOTS
}

export const HALL_OF_FAME_SLOTS = HALL_OF_FAME_GRID.columns * HALL_OF_FAME_GRID.rows

/** 격자 왼쪽 x = cx − (Σ칸너비 + (열−1)·가로틈)/2 (S9 3-2) */
export const HALL_OF_FAME_GRID_LEFT =
  HALL_OF_FAME_GRID.centerX -
  Math.trunc(
    (HALL_OF_FAME_GRID.cellWidth * HALL_OF_FAME_GRID.columns +
      (HALL_OF_FAME_GRID.columns - 1) * HALL_OF_FAME_GRID.horizontalGap) / 2,
  )

export interface GridCell {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly column: number
  readonly row: number
}

/**
 * 홈런더비 선수 고르기(공용 목록 k 7, 격자 종류 4)의 첫 줄 위쪽 y = H/2 + 0x18 = 184 — 0x65152~0x65158 이 k 7 이면
 * dy 를 0x13 대신 0x18 로 둔다(행 2). 열별 보정 0xd40b8 은 종류 4 에도 걸린다(0x7a79c~0x7a7a2).
 */
export const HOME_RUN_DERBY_FIRST_ROW_Y = SCREEN.height / 2 + 0x18

/** 칸 i 의 자리 (0x7a708~0x7a78e, 열림 애니가 끝난 뒤의 값). `firstRowY` 는 격자 cy(첫 줄 위쪽) */
export function hallOfFameCellOf(index: number, firstRowY: number = HALL_OF_FAME_GRID.firstRowY): GridCell {
  const column = index % HALL_OF_FAME_GRID.columns
  const row = Math.trunc(index / HALL_OF_FAME_GRID.columns)
  return {
    x: HALL_OF_FAME_GRID_LEFT + column * (HALL_OF_FAME_GRID.cellWidth + HALL_OF_FAME_GRID.horizontalGap),
    y:
      firstRowY +
      row * (HALL_OF_FAME_GRID.rowHeight + HALL_OF_FAME_GRID.verticalGap) -
      HALL_OF_FAME_GRID.columnYAdjust[column],
    width: HALL_OF_FAME_GRID.cellWidth,
    height: HALL_OF_FAME_GRID.rowHeight,
    column,
    row,
  }
}

/**
 * 슬롯 **0~4 는 투수 칸, 5~14 는 타자 칸**이다 (0x653ee: 빈 칸 아이콘이 슬롯 ≤ 4 면 글러브,
 * 아니면 방망이 — P6 2a-3 확정).
 */
export const HALL_OF_FAME_PITCHER_SLOTS = 5

/**
 * 칸 배치 (칸 채우기 0x5eb8c · 빈 칸 찾기 0x62514 확정):
 * ```
 * 0 = 나리 투수 · 1~4 = 명예 투수 0~3 · 5 = 나리 타자 · 6~9 = 명예 타자 0~3 · 10 = 안 씀 · 11~14 = 명예 타자 4~7
 * ```
 */
export const NARI_PITCHER_SLOT = 0
export const NARI_BATTER_SLOT = 5
const UNUSED_SLOT = 10

/** 칸 → 명예의 전당 편과 번호. 나리 칸·안 쓰는 칸은 null */
export function hallOfFameEntryOfSlot(slot: number): { readonly side: '투수' | '타자'; readonly index: number } | null {
  if (slot >= 1 && slot <= 4) return { side: '투수', index: slot - 1 }
  if (slot >= 6 && slot <= 14 && slot !== UNUSED_SLOT) return { side: '타자', index: slot <= 9 ? slot - 6 : slot - 7 }
  return null
}

/**
 * 칸 상태 `[목록+0x20c + 칸×8]` (0x5eb8c) — 0 아무것도 아님 · 1 나리 선수 있음 · 2 나리 선수 없음 ·
 * 3 명예 선수 있음 · 4 열린 빈 칸 · 5 잠긴 칸(열림 깃발 g+0x80+i / g+0x88+i 가 0).
 * 목록 종류 `[목록+0x1fc]` 가 **2(스페셜 명예의 전당, 상태 27 — 0x26024)** 면 나리 칸 0·5 를 채우지 않아 0 으로 남고,
 * **3(엔딩 뒤 등록, 나리 상태 145 — 0x1c91e)** 이면 나리 저장이 있는지로 1·2 를 넣는다. 칸 10 은 늘 0 이다.
 */
export type HallOfFameSlotState = 0 | 1 | 2 | 3 | 4 | 5

/**
 * 키 결과 코드 `0x5eae0` — 칸 상태와 편(칸 ≤ 4 면 투수)으로:
 * 1 → 투수 1 · 타자 2 · 3 → 투수 3 · 타자 4 · 2 → 5 · 4 → 6 · 5 → 7 · 그 밖 0.
 */
export function hallOfFameKeyCodeOf(state: HallOfFameSlotState, slot: number): number {
  const isBatter = slot >= HALL_OF_FAME_PITCHER_SLOTS
  if (state === 1) return isBatter ? 2 : 1
  if (state === 3) return isBatter ? 4 : 3
  if (state === 2) return 5
  if (state === 4) return 6
  if (state === 5) return 7
  return 0
}

/**
 * 능력치 도형 (B 자리) — `0x5aefc(skin, anim, B.x, B.y + 8, 종류 = 칸 ≤ 4 ? 3(투수) : 2(타자), 기록, 0, 30, 최대표)` (0x656ce~0x65740).
 * 종류 2·3 은 축 최대치(서술자 +0)를 넘겨받은 표로 바꾸는데, 그 표는 `0x5e864` 가 s8 0xd1743(투수)·0xd174b(타자)
 * 의 0 행 × 10 = **800** 네 칸으로 채운다. 값은 `0xb6415(기록, k, 1)` (장비·장착 스킬을 얹은 능력치, 0x5b228~0x5b23c).
 * 길이는 팀 도형과 같은 0x75ebc: 최대길이 = 반지름 × 800 / 999 = 24, 현재길이 = 최대길이 × 값 / 999.
 */
export const HALL_OF_FAME_CHART = { dy: 8, radius: 30, axisMaximum: 800 } as const

const ORIGINAL_AXIS_SCALE = 999

/** 최대길이 = 반지름 30 × 축 최대치 800 / 999 = 24 (0x75f30) */
export const HALL_OF_FAME_CHART_MAXIMUM_LENGTH = Math.trunc((HALL_OF_FAME_CHART.radius * HALL_OF_FAME_CHART.axisMaximum) / ORIGINAL_AXIS_SCALE)

/** 네 값의 꼭짓점 — 축 각도·꼭짓점 식은 팀 도형(`teamSelectLayout`)과 같고 축 최대치만 800 이다 */
export function hallOfFameChartVerticesOf(center: ChartPoint, values: readonly number[]): readonly ChartPoint[] {
  const maximum = HALL_OF_FAME_CHART_MAXIMUM_LENGTH
  return ABILITY_AXIS_ANGLES.map((angle, axis) =>
    abilityVertexOf(center, Math.trunc((maximum * (values[axis] ?? 0)) / ORIGINAL_AXIS_SCALE), angle))
}

/**
 * 자세히 보기 두 자리 (k = 6·7·8 의 보정, 표 0xd1eac — P6 2a-1 확정).
 * A = 선수 그림 자리, B = 능력치 도형 자리.
 */
export const HALL_OF_FAME_DETAIL = { a: { x: 58, y: 110 }, b: { x: 178, y: 96 } } as const

export const SLT_FRAME = './sprites/slt_frame'

/**
 * 빈 칸 그림 (0x6535a~0x65432 확정).
 *   원 두 개: (A−38) 지름 77 #5A86BD · (A−31) 지름 63 #29348C
 *   이름 막대: slt_frame 이미지 9 (82×15) 을 (A.x−41, A.y+40)
 *   막대 글씨: 113 "EMPTY"(29×7) 또는 114 "LOCK"(23×7) 을 막대 가운데
 *   아이콘: 글러브 23(25×27) · 방망이 24(31×31) · 자물쇠 31(21×25) 을 A 가운데
 */
export const HALL_OF_FAME_SLOT_ART = {
  circles: [
    { offset: 38, size: 77, color: '#5A86BD' },
    { offset: 31, size: 63, color: '#29348C' },
  ],
  nameBar: { image: 9, width: 82, height: 15, dx: -41, dy: 40 },
  /** 이름 글은 막대보다 2px 아래에서 폭 82 가운데 흰 글씨 (0xd24b4 `"!C!cFFFFFF%s"`) */
  nameTextDy: 42,
  empty: { image: 113, width: 29, height: 7 },
  lock: { image: 114, width: 23, height: 7 },
  glove: { image: 23, width: 25, height: 27 },
  bat: { image: 24, width: 31, height: 31 },
  padlock: { image: 31, width: 21, height: 25 },
} as const

/**
 * 딱지 (0x65744, 모든 k 공통 — P6 2a-3 확정).
 *   A 딱지 = slt_frame 116(57×15 흰 막대) 을 (A.x−28, A.y−53) + img_text 157 "PLAYER" 를 (A.x−w/2, A.y−48)
 *   B 딱지 = slt_frame 117(파란 막대) 을 (B.x−28, B.y−43) + img_text 159 "ABILITY" 를 그 +5
 */
export const HALL_OF_FAME_TAGS = {
  a: { plate: 116, plateDx: -28, plateDy: -53, label: 157, labelDy: -48, labelWidth: 39, labelHeight: 5 },
  b: { plate: 117, plateDx: -28, plateDy: -43, label: 159, labelDy: -38, labelWidth: 39, labelHeight: 5 },
  plateWidth: 57,
  plateHeight: 15,
} as const

/**
 * 명예의 전당 말풍선 ([skin+0x126] 켜짐, 0x65866~0x659ea — P6 2a-3 확정).
 * 격자 커서 칸 (gx, gy) 기준 `x = gx + 26` (열이 3 이상이면 `x = gx + 13 − 76`), `y = gy − 8`.
 * 판 76×36 #2E4694(둥글기 1) + 흰 둥근 테두리, 칸 두 개 70×14 #213473 을 (x+3, gy−5)·(x+3, gy+11),
 * 글은 흰 가운데, 고른 칸은 노랑 둥근 테두리 RGB(255,255,0).
 */
export const HALL_OF_FAME_BUBBLE = {
  width: 76,
  height: 36,
  panelColor: '#2E4694',
  borderColor: '#FFFFFF',
  cornerRadius: 1,
  cell: { width: 70, height: 14, color: '#213473', dx: 3, dys: [-5, 11] },
  /**
   * 글 `"!C!cffffff친구에게 선물"`(0xd24c4) · `"!C!cffffff슬롯에서 삭제"`(0xd24dc) 를 0xba269(글, x + 3, gy − 3 / gy + 0xd, 폭 0x46)
   * — 호출 6599a · 659ac. 칸 위(gy − 5 / gy + 0xb, 0x65940~0x6597a)보다 **2px 아래**다. *(정정 r129 — 전에는 칸 안 세로 가운데)*
   */
  labelDy: 2,
  selectedBorderColor: '#FFFF00',
  /** 0xd24c4 · 0xd24dc */
  labels: ['친구에게 선물', '슬롯에서 삭제'],
} as const

/** 말풍선 왼쪽 위 — 오른쪽 두 열이면 칸 왼쪽으로 뒤집는다 */
export function hallOfFameBubblePositionOf(cell: GridCell): { x: number; y: number } {
  const x = cell.column >= 3 ? cell.x + 13 - HALL_OF_FAME_BUBBLE.width : cell.x + 26
  return { x, y: cell.y - 8 }
}
