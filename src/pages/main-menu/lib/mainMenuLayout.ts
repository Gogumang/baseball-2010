/**
 * 메인 메뉴 배치 — 원본 그림·좌표를 그대로 쓴다.
 *
 * 원작 메뉴 판(0x24b1c)은 **화면 아래 반원 바퀴**다 (F-ui-layout F-5 · 4-2).
 *
 * ## 확정 (디스어셈에서 읽은 값 — F-ui-layout 4-2)
 * - 바퀴 중심 `(scrW>>1, scrH)` = **(120, 320)** — 초기화 0x237c4~0x237dc
 * - 테두리 원 3겹: 반지름 **93 · 95 · 97**, 색 RGB(37,55,120) · RGB(138,185,235) · RGB(36,55,120) — 0x24cf6~0x24d70
 * - 가운데에 main_ball 애니 0 을 (120,320) 기준점으로 그린다 — 0x24cda
 * - 칸 6개 각도 표 0xcead4 = **[0,45,90,180,270,315]**, 순서 표 0xceae0 = [0..5]
 * - 칸 위치: `x = 120 + (cos a·93 >> 16) + (a 가 [90,270] 밖이면 20)`, `y = 320 + (sin a·93 >> 16)` — 0x24e8a~0x24eba
 * - 도는 동안 각 = 표값 ± 카운터×9, **90° 벌어진 칸(90↔180 · 180↔270)은 ×18** — 0x24de6~0x24e2c
 * - 카운터 0→4, 즉 **한 칸 이동이 5틱** — 0x24c42~0x24c4c
 * - 칸 그림은 기준점 가운데 맞춤 `(x − w/2, y − h/2)` — 0x24ecc~0x24ee8
 *
 * ## 유력·근사 (문서가 확정이라고 안 적은 것 — 지어내지 않고 여기 적어 둔다)
 * - **선택된 칸이 맨 위 270° 에 온다**: 4-2 가 "유력" 이라고만 적는다.
 * - **도는 방향**: 원본 방향 값은 [+0x100] = −1/−2 인데 ↑↓ 중 어느 쪽인지는 문서에 없다.
 *   웹은 "다음 칸이 315°→270° 로 올라온다"(= 표 순서 거꾸로)로 뒀다. **근사**.
 * - **칸 그림**: 원본은 ui/img_text 프레임([0x1552d4c+4i], 번호표 미해독)을 그린다.
 *   웹은 지금 쓰던 main_ui 글자 그림(높이 27)을 그대로 바퀴에 얹는다. 원본 아이콘은 10px 높이라
 *   양끝 칸(180°·0°)이 화면 밖으로 덜 삐져나갔을 것이다. **근사**.
 * - **각도 구간별 main_ui 이미지 1·2·3·4 분기**(a>332→2, 323<a≤332→1, a≤27→3, 27<a≤36→4)는
 *   뜻이 미확인(4-2 "미확인")이라 옮기지 않았다.
 * - main_ball 을 그리는 조건 `[+0xe6] ≥ 0` 의 뜻을 몰라 늘 그린다. **근사**.
 *
 * 그림 치수는 직접 읽어 확정이다:
 *   배너 `mode_back/000` 240×84 · 글자 `main_ui/frames/NNN` 높이 **27**
 *   선택 바 `main_ui/002` 125×15 · 설명 판 `main_ui/003` 149×63
 */

/** 원작 화면 */
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320
/** 화면 가운데 */
export const SCREEN_CENTER_X = 120

export const MENU_BANNER = { x: 0, y: 0, width: 240, height: 84 } as const

/** 글자 그림의 공통 높이 (main_ui/frames 원점표에서 읽었다) */
export const MENU_LABEL_HEIGHT = 27

// ──────────────────────────────── 반원 바퀴 (윗단 = 처음 메뉴 6칸) ────────────────────────────────

/** 바퀴 중심 (120,320) — 초기화 0x237c4 (확정) */
export const MENU_WHEEL_CENTER = { x: 120, y: 320 } as const

/** 칸이 놓이는 반지름 — 위치식의 93 (확정) */
export const MENU_WHEEL_RADIUS = 93

/** 테두리 원 3겹 — 0x24cf6~0x24d70 (확정). 안쪽부터 93 · 95 · 97 */
export const MENU_WHEEL_RINGS = [
  { radius: 93, color: 'rgb(37, 55, 120)' },
  { radius: 95, color: 'rgb(138, 185, 235)' },
  { radius: 97, color: 'rgb(36, 55, 120)' },
] as const

/** 각도 표 0xcead4 (s16, 도) — 확정 */
export const MENU_WHEEL_ANGLES = [0, 45, 90, 180, 270, 315] as const
/** 순서 표 0xceae0 — 확정. 표 자리와 칸 번호가 1:1 이다. */
export const MENU_WHEEL_ORDER = [0, 1, 2, 3, 4, 5] as const

/** 선택된 칸이 오는 표 자리 = 270°(맨 위) — 4-2 "유력" */
export const MENU_WHEEL_SELECTED_SLOT = 4

/** 한 칸 이동에 걸리는 틱 — 카운터 0→4 (확정) */
export const MENU_WHEEL_TURN_TICKS = 5

/** 기준점 가운데 맞춤이라 화면 밖으로 넘치는 칸도 그대로 그린다 (stage 가 잘라 준다) */
export interface MenuWheelPoint {
  readonly x: number
  readonly y: number
}

/** 각도를 0 이상 360 미만으로 접는다 */
function wrapDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/** 16.16 고정소수 `>> 16` 은 −∞ 쪽으로 자른다 — 그래서 Math.floor 다 */
function scaled(value: number): number {
  // cos 90° 같은 자리에서 떠다니는 1e-17 이 floor 때문에 −1 로 떨어지는 것만 막는다
  const clean = Math.abs(value) < 1e-9 ? 0 : value
  return Math.floor(clean * MENU_WHEEL_RADIUS)
}

/**
 * 각도 → 칸 기준점. `x = 120 + (cos a·93 >> 16) + (a 가 [90,270] 밖이면 20)`,
 * `y = 320 + (sin a·93 >> 16)` (0x24e8a~0x24eba, 확정).
 *
 * 20px 보정은 **각도로만** 갈리므로 도는 도중 270° 를 지날 때 x 가 20 만큼 툭 튄다.
 * 원본 식 그대로다 — 고치지 않는다.
 */
export function menuWheelPointOf(angle: number): MenuWheelPoint {
  const a = wrapDegrees(angle)
  const radians = (a * Math.PI) / 180
  const sideShift = a < 90 || a > 270 ? 20 : 0
  return {
    x: MENU_WHEEL_CENTER.x + scaled(Math.cos(radians)) + sideShift,
    y: MENU_WHEEL_CENTER.y + scaled(Math.sin(radians)),
  }
}

/**
 * 화면에 보이는 칸인지 — 기준점이 화면 아래(y > 320)로 내려가면 안 보인다.
 * 표의 여섯 각 중 45°·90° 가 여기 걸려, 실제로는 **네 칸(180 · 270 · 315 · 0)만** 보인다.
 */
export function isMenuWheelAngleVisible(angle: number): boolean {
  return menuWheelPointOf(angle).y <= SCREEN_HEIGHT
}

/**
 * 칸 번호 → 각도 표 자리. 고른 칸이 270°(표 4번)에 오도록 돌린 것이다.
 * 표가 여섯 자리뿐이라 **6칸짜리 윗단에만** 쓴다.
 */
export function menuWheelSlotOf(index: number, selectedIndex: number): number {
  const count = MENU_WHEEL_ANGLES.length
  return (((index - selectedIndex + MENU_WHEEL_SELECTED_SLOT) % count) + count) % count
}

/** 칸 번호 → 멈춰 있을 때의 각도 */
export function menuWheelAngleOf(index: number, selectedIndex: number): number {
  return MENU_WHEEL_ANGLES[menuWheelSlotOf(index, selectedIndex)]
}

/**
 * 두 각 사이의 짧은 쪽 차이 (−180, 180]. 표에서 이웃한 자리끼리는 늘 ±45° 아니면 ±90° 다.
 */
export function menuWheelDeltaOf(from: number, to: number): number {
  return ((((to - from + 540) % 360) + 360) % 360) - 180
}

/**
 * 도는 도중의 각 — 카운터 0..5 를 5틱에 나눠 간다.
 * 차이가 45° 면 틱마다 9°, 90° 면 18° 로 떨어진다 (원본 0x24de6 의 ×9 / ×18 과 같다).
 */
export function menuWheelTurnAngleOf(from: number, to: number, counter: number): number {
  const step = Math.min(Math.max(counter, 0), MENU_WHEEL_TURN_TICKS)
  if (step >= MENU_WHEEL_TURN_TICKS) return to
  return wrapDegrees(from + (menuWheelDeltaOf(from, to) * step) / MENU_WHEEL_TURN_TICKS)
}

/** 칸 그림의 좌상단 — 기준점 가운데 맞춤 (0x24ecc: x − w/2, y − h/2) */
export function menuWheelLabelTopLeftOf(
  point: MenuWheelPoint,
  width: number,
  height: number,
): MenuWheelPoint {
  return { x: point.x - Math.trunc(width / 2), y: point.y - Math.trunc(height / 2) }
}

// ──────────────────────── 세로 목록 (아랫단 = 게임시작 목록 7칸, 근사) ────────────────────────

/**
 * ⚠️ **아랫단(원본 하위 상태 5)은 바퀴가 아니다.**
 * 원본은 상태 5 에서도 같은 바퀴 판 0x24b1c 를 깔고 그 **위에** 하위 목록 0x2524c 를 더 그린다
 * (F-ui-layout 4-0). 그 하위 목록의 좌표는 아직 해독 안 됐고, 각도 표는 6칸뿐이라
 * 7칸이 어떻게 도는지 근거가 없다 → **지어내지 않고 지금 세로 목록을 그대로 둔다. 전부 근사다.**
 *
 * 겹침만 없앴다: 예전 값은 글자 높이 27 에 줄 간격 22 라 **줄마다 5px 씩 겹쳤다**.
 * 간격을 글자 그림 높이와 같은 **27** 로 올렸다 — 이보다 작으면 무조건 겹친다.
 *
 * 자리 계산: 배너 84 + 일곱 줄 189 + 설명 판 63 = 336 으로 화면(320)보다 16 크다.
 * 그래서 설명 판을 화면 바닥에 붙이고(257 + 63 = 320) 목록을 그 위 189px 에 꽉 채웠다
 * (68 + 189 = 257). 첫 줄만 배너 아랫단 16px 을 밟는다. **근사**다.
 */
export const MENU_LIST_TOP = 68
/** 줄 간격 = 글자 그림 높이. 이보다 작으면 글자가 겹친다. */
export const MENU_ROW_STEP = MENU_LABEL_HEIGHT

/** 고른 줄 뒤에 까는 바 (세로 목록에서만 쓴다 — 4-2 에 바퀴용 선택 바 이야기는 없다) */
export const MENU_SELECTION_BAR = { frame: 2, width: 125, height: 15 } as const

export interface MenuPanelBox {
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 설명 판 — 세로 목록 아래 가운데. 원본 좌표는 미해독이라 **추정**이다
 * (4-2: "main_ui/003 패널 위치는 원본 분기와 아직 대조 못 했다").
 * y 는 화면 바닥에 붙인 값이다: 320 − 63 = 257. 일곱 줄을 겹치지 않게 넣으려면 이만큼 필요했다.
 */
export const MENU_DESCRIPTION_PANEL: MenuPanelBox = { frame: 3, x: 46, y: 257, width: 149, height: 63 }

/**
 * 바퀴 단의 설명 판 — 바퀴가 화면 아래 반을 차지해 250 자리가 칸 글자와 겹친다.
 * 배너(~84)와 바퀴 맨 위 칸 글자(270° → y 213) 사이 빈 띠에 넣었다: 213 − 63 = **150**.
 * 원본 좌표가 아니라 **근사**다.
 */
export const MENU_WHEEL_DESCRIPTION_PANEL: MenuPanelBox = { ...MENU_DESCRIPTION_PANEL, y: 150 }

export function menuDescriptionPanelOf(isWheel: boolean): MenuPanelBox {
  return isWheel ? MENU_WHEEL_DESCRIPTION_PANEL : MENU_DESCRIPTION_PANEL
}

/** 줄 번호 → 글자 그림의 y */
export function menuRowTopOf(index: number): number {
  return MENU_LIST_TOP + index * MENU_ROW_STEP
}

/** 고른 줄의 바 y — 글자 가운데에 오도록 내린다 */
export function selectionBarTopOf(index: number): number {
  return menuRowTopOf(index) + Math.trunc((MENU_LABEL_HEIGHT - MENU_SELECTION_BAR.height) / 2)
}
