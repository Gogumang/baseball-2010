/** 윗단 반원 바퀴 (하위 상태 4, 0x24b1c) — 바퀴 중심 · 각도 표 · 칸 밑판 */
import { isBugFixed } from '@/shared/config/bugfixes'
import { MENU_WHEEL_ITEM_FRAMES, SCREEN_CENTER_X, SCREEN_HEIGHT } from '@/pages/main-menu/lib/mainMenuLayout/menuScreen'
import { rotateMenuReel } from '@/pages/main-menu/lib/mainMenuLayout/menuReel'
import { MENU_DESCRIPTION_PANEL } from '@/pages/main-menu/lib/mainMenuLayout/menuPanel'

// ──────────────────────────── 반원 바퀴 (윗단 = 처음 메뉴 6칸) ────────────────────────────

/** 바퀴 중심 (120,320) — 초기화 0x237c4 (확정) */
export const MENU_WHEEL_CENTER = { x: SCREEN_CENTER_X, y: SCREEN_HEIGHT } as const

/** 칸이 놓이는 반지름 — 0x24e92 의 0x5d (확정) */
export const MENU_WHEEL_RADIUS = 93

/** 테두리 원 3겹 — 0x24cf6~0x24d70 (확정) */
export const MENU_WHEEL_RINGS = [
  { radius: 93, color: 'rgb(37, 55, 120)' },
  { radius: 95, color: 'rgb(138, 185, 235)' },
  { radius: 97, color: 'rgb(36, 55, 120)' },
] as const

/** 각도 표 0xcead4 (s16, 도) — 확정 */
export const MENU_WHEEL_ANGLES = [0, 45, 90, 180, 270, 315] as const
/** 순서 표 0xceae0 — 확정. 표 자리와 칸 번호가 1:1 이다. */
export const MENU_WHEEL_ORDER = [0, 1, 2, 3, 4, 5] as const

/**
 * 고른 칸이 오는 배열 자리 = **0번(각도 0°)** — 0x24780 이 구간 첫 칸을 기준으로 돌리고,
 * 설명 판도 이 자리(`[sp+0x38] == 0`)에서만 그린다 (0x24ff0). **확정**.
 * 각도 0° 는 아래 `isMenuWheelAngleDrawn` 에서 걸러지므로 **고른 칸은 바퀴에 안 그려진다.**
 */
export const MENU_WHEEL_SELECTED_SLOT = 0

/** 한 칸 이동에 걸리는 틱 — 카운터 0→4, 5틱째 회전 (확정) */
export const MENU_WHEEL_TURN_TICKS = 5

/** 기준점 가운데 맞춤이라 화면 밖으로 넘치는 칸도 그대로 그린다 (stage 가 잘라 준다) */
export interface MenuWheelPoint {
  readonly x: number
  readonly y: number
}

/** 원본 키 방향 값 `[obj+0x100]` — ↑·← 가 −1, ↓·→ 가 −2 다 (0x294e6 · 0x28e26) */
export type MenuTurnDirection = -1 | -2

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
 * 20px 보정은 **각도로만** 갈리므로 도는 도중 270° 를 지날 때 x 가 20 만큼 툭 튄다(90° 로 들어서는 마지막 걸음도 같다).
 * 원본 식 그대로다(B-90). 고친 길은 멈추는 자리(45 · 315 는 20, 90 · 180 · 270 은 0)는 같게 두고 45~90 · 270~315 사이를
 * 각에 따라 고르게 옮긴다(`menuWheelSideShiftOf`). 굴림 없음
 */
export function menuWheelPointOf(angle: number): MenuWheelPoint {
  const a = wrapDegrees(angle)
  const radians = (a * Math.PI) / 180
  const sideShift = isBugFixed('B-90') ? menuWheelSideShiftOf(a) : a < 90 || a > 270 ? 20 : 0
  return {
    x: MENU_WHEEL_CENTER.x + scaled(Math.cos(radians)) + sideShift,
    y: MENU_WHEEL_CENTER.y + scaled(Math.sin(radians)),
  }
}

/** B-90 고친 길의 x 보정 — 45° 이하 · 315° 이상 20, 90~270 0, 그 사이는 각에 비례(정수로 자른다) */
export function menuWheelSideShiftOf(a: number): number {
  if (a <= 45 || a >= 315) return 20
  if (a < 90) return Math.trunc((20 * (90 - a)) / 45)
  if (a > 270) return Math.trunc((20 * (a - 270)) / 45)
  return 0
}

/**
 * 그 각에 칸을 그리는지 — 0x24ef0 `r2 = a − 0x13 ; cmp r2, #0x142 ; bhi 건너뜀` (부호 없음)
 * 곧 **19 ≤ a ≤ 341** 만 그린다. 표의 0° 자리(= 고른 칸)는 여기서 걸린다.
 */
export function isMenuWheelAngleDrawn(angle: number): boolean {
  const a = wrapDegrees(angle)
  return a >= 19 && a <= 341
}

/**
 * 도는 동안 한 틱에 움직이는 각 — 보통 9°, **90° 벌어지는 자리만 18°** (0x24de6~0x24e06, 확정).
 * dir −1(각이 커지는 쪽)은 90·180 에서, dir −2(작아지는 쪽)는 180·270 에서 18° 다.
 */
export function menuWheelStepOf(angle: number, direction: MenuTurnDirection): number {
  if (direction === -1 && (angle === 90 || angle === 180)) return 18
  if (direction === -2 && (angle === 180 || angle === 270)) return 18
  return 9
}

/**
 * 배열 자리 `slot` 이 카운터 `counter` 일 때 놓이는 각.
 * dir −1 이면 표값 + 걸음×카운터, −2 면 −. 360 을 넘으면 360 으로 잘리고(0x24e2e),
 * 음수면 +360 한다(0x24e74). `direction` 이 null 이면 멈춰 있는 표값 그대로다.
 */
export function menuWheelAngleAt(slot: number, direction: MenuTurnDirection | null, counter: number): number {
  const base = MENU_WHEEL_ANGLES[slot]
  if (direction === null || counter <= 0) return base
  const moved = menuWheelStepOf(base, direction) * Math.min(counter, MENU_WHEEL_TURN_TICKS)
  const angle = direction === -1 ? base + moved : base - moved
  if (angle > 360) return 360
  return angle < 0 ? angle + 360 : angle
}

/**
 * 커서가 `cursor` 일 때 각도 표 자리마다 놓이는 칸 번호.
 * 아랫단과 같은 0x24780 회전이라 "왼쪽으로 cursor 번 돌린 것" 과 같다 — 곧 `(cursor + 자리) % 6`.
 */
export function menuWheelOrderOf(cursor: number): number[] {
  let order: number[] = [...MENU_WHEEL_ORDER]
  for (let step = 0; step < cursor; step += 1) order = rotateMenuReel(order, -2)
  return order
}

/** 멈춘 바퀴의 칸 글자 하나 — 각도 표 자리 · 칸 번호 · img_text 프레임 · 기준점 */
export interface MenuWheelRestingLabel {
  readonly slot: number
  readonly entryIndex: number
  readonly frame: number
  readonly point: MenuWheelPoint
  /** 글자 밑판 (`menuWheelSlotDrawOf`) — 멈춘 표 각(45 · 90 · 180 · 270 · 315)은 늘 이미지 0 */
  readonly underlay: MenuWheelUnderlay
}

/**
 * **멈춘 바퀴(0x24b1c)의 칸 글자** — 커서 `cursor` 로 돈 배열(`menuWheelOrderOf`)을 표 각도에 놓고, 그리는 각(19~341)만 남긴다.
 * 고른 칸은 0° 라 빠진다. 메인 메뉴 아랫단(하위 5 · 9)과 스페셜(하위 6)처럼 바퀴가 돌지 않는 하위 상태가 쓴다 — 그때 배열은
 * 윗단에서 마지막으로 돈 그대로다(0x24780 은 하위 4 의 키 0x294e6 만 부른다).
 */
export function menuWheelRestingLabelsOf(cursor: number): readonly MenuWheelRestingLabel[] {
  return menuWheelOrderOf(cursor).flatMap((entryIndex, slot) => {
    const angle = menuWheelAngleAt(slot, null, 0)
    const draw = menuWheelSlotDrawOf(angle)
    if (draw === null || !draw.showsLabel) return []
    return [{ slot, entryIndex, frame: MENU_WHEEL_ITEM_FRAMES[entryIndex], point: menuWheelPointOf(angle), underlay: draw.underlay }]
  })
}

/** main_ui 이미지 0 · 1 · 2 의 크기 — 칸 밑판 76×28 · 접히는 93×23 · 더 접힌 125×15 (public/sprites/main_ui, R6 2절) */
export const MENU_WHEEL_UNDERLAY_SIZES = [
  { width: 76, height: 28 },
  { width: 93, height: 23 },
  { width: 125, height: 15 },
] as const

/** 칸 밑판 하나 — main_ui 이미지 · 좌상단 · 상하 뒤집기(효과 0x11 · 인자 1) */
export interface MenuWheelUnderlay {
  readonly image: 0 | 1 | 2
  readonly x: number
  readonly y: number
  readonly flipsVertically: boolean
}

/** 칸 하나를 그리는 법 — 밑판과 그 위 칸 글자(img_text 프레임)를 그리는가 */
export interface MenuWheelSlotDraw {
  readonly underlay: MenuWheelUnderlay
  readonly showsLabel: boolean
}

/**
 * **칸 밑판** — 바퀴 그리기 0x24b1c 의 칸 고리 24eca~24f94 (R6 2절, 2026-10-14 다시 뜸). 그리는 각(19~341, 24ef0)에서
 * 이미지 0 크기로 기준점 가운데 (x0, y0) = (x − (w0 >> 1), y − (h0 >> 1)) 를 잡고 각으로 갈린다:
 * ```
 * 24efe  a > 332 → 이미지 2 를 (판 x, 판 y − 5)                        ; 판 = main_ui 이미지 3 (0x24d80 0xba815 · 24db0~24dc6)
 * 24f1c  a > 323 → 이미지 1 을 (x0 + 10, y0)
 * 24f32  a ≤ 27  → 이미지 2 를 (판 x, 판 y + 판 높이 − 5) 효과 0x11 · 인자 1(상하 뒤집기)
 * 24f56  a ≤ 36  → 이미지 1 을 (x0 + 10, y0) 효과 0x11 · 인자 1
 *        그 밖    → 이미지 0 을 (x0, y0)
 * 24f98  이미지 0 일 때(경우 0)만 그 위에 칸 글자를 그린다
 * ```
 * 바퀴가 도는 동안 칸이 오른쪽 아래 설명 판(이미지 3) 쪽으로 납작하게 접혀 들어가는 연출이다. 그리지 않는 각이면 null.
 */
export function menuWheelSlotDrawOf(angle: number): MenuWheelSlotDraw | null {
  if (!isMenuWheelAngleDrawn(angle)) return null
  const a = wrapDegrees(angle)
  const point = menuWheelPointOf(angle)
  const base = MENU_WHEEL_UNDERLAY_SIZES[0]
  const x0 = point.x - (base.width >> 1)
  const y0 = point.y - (base.height >> 1)
  const panel = MENU_DESCRIPTION_PANEL
  const folded = (underlay: MenuWheelUnderlay): MenuWheelSlotDraw => ({ underlay, showsLabel: false })
  if (a > 332) return folded({ image: 2, x: panel.x, y: panel.y - 5, flipsVertically: false })
  if (a > 323) return folded({ image: 1, x: x0 + 10, y: y0, flipsVertically: false })
  if (a <= 27) return folded({ image: 2, x: panel.x, y: panel.y + panel.height - 5, flipsVertically: true })
  if (a <= 36) return folded({ image: 1, x: x0 + 10, y: y0, flipsVertically: true })
  return { underlay: { image: 0, x: x0, y: y0, flipsVertically: false }, showsLabel: true }
}

/** 칸 그림의 좌상단 — 기준점 가운데 맞춤 (0x24fc4: x − w/2, y − h/2) */
export function menuWheelLabelTopLeftOf(point: MenuWheelPoint, width: number, height: number): MenuWheelPoint {
  return { x: point.x - Math.trunc(width / 2), y: point.y - Math.trunc(height / 2) }
}
