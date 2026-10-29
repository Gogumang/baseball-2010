import { ABILITY_AXIS_ANGLES, abilityVertexOf } from '@/pages/special/lib/specialLayout/otherSlices'
import type { ChartPoint } from '@/pages/special/lib/specialLayout/otherSlices'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { GridCell } from '@/pages/special/lib/specialLayout/hallOfFameCells'

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
  return ABILITY_AXIS_ANGLES.map((angle, axis) => abilityVertexOf(center, Math.trunc((maximum * (values[axis] ?? 0)) / ORIGINAL_AXIS_SCALE), angle))
}

/**
 * 자세히 보기 두 자리 (k = 6·7·8 의 보정, 표 0xd1eac — P6 2a-1 확정).
 * A = 선수 그림 자리, B = 능력치 도형 자리.
 */
export const HALL_OF_FAME_DETAIL = { a: { x: 58, y: 110 }, b: { x: 178, y: 96 } } as const

export const SLT_FRAME = assetUrl('./sprites/slt_frame')

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
