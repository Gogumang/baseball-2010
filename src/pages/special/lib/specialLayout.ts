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
    availability: '아직', blockedText: '마선수 선택은!N아직 만들지 않았습니다',
  },
  {
    id: '에디트', labelFrame: 20, labelWidth: 73, labelHeight: 27, state: 29,
    description: '선수의 이름을 자유롭게!N변경할 수 있습니다', // [21]
    availability: '아직', blockedText: '에디트(이름 변경)는!N아직 만들지 않았습니다',
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
 * 줄 자리 (0x253d4~0x256d0).
 *
 * 원본 식 (S9 7-1 확정):
 * ```
 * off_i = −80 + 20·(i − 1) = 20i − 100      // 줄 간격 20px
 * y_i   = [메뉴+0xdc](= 화면높이 320) + off_i + 스크롤[0x1552d68] − 6
 * 가운데 x = W − 39 − w/2                    // 즉 오른쪽 끝이 x = 201 에 맞는다
 * ```
 * 가로(오른쪽 끝 201)는 원본 그대로다.
 *
 * ⚠️ **세로는 배치 근사다.** 원본은 커서를 한자리에 두고 아홉 칸짜리 창 표(−1 이면 그 줄은 건너뜀)로
 * 목록을 굴려 한 번에 몇 줄만 보여 주고, 스크롤 값이 애니메이션과 섞여 있어 줄 y 를 그대로 옮길 수 없다.
 * 웹판은 여덟 칸을 **한 번에 다 보여 주는 게 목적**이라 27px 짜리 글자 그림이 겹치지 않게
 * 줄 간격을 30 으로 벌리고(원본 20), 첫 줄을 머리띠 아래 52 에 두었다 — 줄 7 = 262, 글자 밑이 289 라
 * 바닥띠(300) 위에 들어온다.
 */
export const ROW = {
  /** 원본 줄 간격 (S9 7-1) — 여덟 줄을 한 번에 세우려고 웹판은 step 을 쓴다 */
  originalStep: 20,
  step: 30,
  firstY: 52,
  rightEdge: SCREEN.width - 39,
} as const

export const rowTopOf = (index: number) => ROW.firstY + ROW.step * index

/** 항목 그림 왼쪽 끝 — 가운데 x = W − 39 − w/2 이므로 오른쪽 끝이 201 에 붙는다 */
export const rowLeftOf = (item: SpecialItem) => ROW.rightEdge - item.labelWidth

/**
 * 고른 줄 옆 설명 판 = main_ui **이미지 3**(149×63 흰 둥근 판) 을 (W − 149 + 5, 줄 y − 31) 에.
 * 그 안에 항목 그림 + 설명 글을 (+8, +8) 로 (P6 2d).
 *
 * ⚠️ 원본은 판을 좌우로 흔드는 보정값이 붙는데(표 0xce8bc/0xce88c) 그건 빼고 제자리에 둔다.
 * 설명 글의 y 는 원본이 "(+8, +8)" 한 줄만 적어 두어, 항목 그림(높이 27) 아래로 내려 적는다 — **근사**.
 */
export const DESCRIPTION_PANEL = {
  image: 3,
  width: 149,
  height: 63,
  x: SCREEN.width - 149 + 5,
  dy: -31,
  padding: 8,
  /** 설명 글 RGB(128,128,128) (0x55545 인자) */
  textColor: '#808080',
  textDy: 38,
} as const

export const descriptionPanelTopOf = (index: number) => rowTopOf(index) + DESCRIPTION_PANEL.dy

/**
 * 반원 바퀴 (0x24b1c — F-5 확정): 중심 (120, 320), 테두리 원 3겹 반지름 93·95·97,
 * 가운데에서 `main_ball` 애니 0 이 돈다.
 *
 * ⚠️ 바퀴의 여섯 칸(게임시작·스페셜…)은 **메인 메뉴 화면 몫**이고 웹 메인 메뉴는 아직 바퀴가 아니라
 * (F-5, MainMenuScreen 은 글자 목록) 여기서는 뒤에 깔리는 호와 공만 그린다 — **배치 근사**.
 */
export const WHEEL = {
  centerX: SCREEN.width / 2,
  centerY: SCREEN.height,
  radii: [93, 95, 97],
  /** RGB(37,55,120) · RGB(138,185,235) · RGB(36,55,120) (0x24cfe·0x24d16·0x24d2e) */
  colors: ['#253778', '#8AB9EB', '#243778'],
  /** main_ball 프레임 0 (141×141, origins.json 원점 (−70,−70) = 가운데 맞춤). 도는 애니는 안 넣었다 */
  ball: { frame: 0, dx: -70, dy: -70 },
} as const

/**
 * 머리띠·바닥띠 `0x54d95(skin, 0, 5)` — 다 내려온 상태 (P6 1-1 확정).
 * 그림은 `ui/game_frame.pzx`, 제목번호 0 → 이미지 3 "2010프로야구", 바닥 비트 5 = 되돌아가기만.
 *
 * ⚠️ 슬라이드 인(높이 ×2 로 내려오기)은 넣지 않았다 — 다 내려온 자리에 바로 그린다.
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
 * 칸마다 둥근 네모 RGB(48,69,205) 를 (x−3, y−3, 칸너비+3, 줄높이+3) 에 (모서리 1)
 * ```
 *
 * ⚠️ **근사**: 칸 너비 배열과 가로·세로 틈(인자 5·9·10)은 P6 요약에 값이 없다. 줄높이 40 과
 *    같은 40·틈 0 으로 둔다 — 그래야 왼쪽 x 가 20, 칸이 (20·60·100·140·180) 로 떨어진다.
 * ⚠️ **미해독**: 칸 **안**에 무엇을 그리는지(종류 6 → `0x7ac2e`)는 S9 도 "(미확인)" 이다.
 *    웹은 칸 바탕(확정)만 깔고 내용은 A 자리에서 보여 준다.
 */
export const HALL_OF_FAME_GRID = {
  kind: 6,
  centerX: 120,
  /** cy = H/2 + 19 — **첫 줄 위쪽 y** 다 (가운데가 아니다, S9 3-2) */
  firstRowY: SCREEN.height / 2 + 19,
  columns: 5,
  rows: 3,
  /** ⚠️ 근사 — 줄높이(40)와 같은 값으로 둔다 */
  cellWidth: 40,
  rowHeight: 40,
  /** ⚠️ 근사 — 인자에 값이 없어 0 으로 둔다 */
  horizontalGap: 0,
  verticalGap: 0,
  /** 종류 6 의 열별 y 보정 표 0xd40b8 (확정) */
  columnYAdjust: [3, 3, 3, 13, 13],
  /** 칸 바탕 둥근 네모 RGB(48,69,205), 칸보다 3px 크게 (0x7a844) */
  backingColor: '#3045CD',
  backingInset: 3,
  cornerRadius: 1,
} as const

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

/** 칸 i 의 자리 (0x7a708~0x7a78e, 열림 애니가 끝난 뒤의 값) */
export function hallOfFameCellOf(index: number): GridCell {
  const column = index % HALL_OF_FAME_GRID.columns
  const row = Math.trunc(index / HALL_OF_FAME_GRID.columns)
  return {
    x: HALL_OF_FAME_GRID_LEFT + column * (HALL_OF_FAME_GRID.cellWidth + HALL_OF_FAME_GRID.horizontalGap),
    y:
      HALL_OF_FAME_GRID.firstRowY +
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
  selectedBorderColor: '#FFFF00',
  /** 0xd24c4 · 0xd24dc */
  labels: ['친구에게 선물', '슬롯에서 삭제'],
} as const

/** 말풍선 왼쪽 위 — 오른쪽 두 열이면 칸 왼쪽으로 뒤집는다 */
export function hallOfFameBubblePositionOf(cell: GridCell): { x: number; y: number } {
  const x = cell.column >= 3 ? cell.x + 13 - HALL_OF_FAME_BUBBLE.width : cell.x + 26
  return { x, y: cell.y - 8 }
}
