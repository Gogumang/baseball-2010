import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { applyMissionAimShake } from '@/entities/pitching/model/pitchTarget'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **사람 투구 입력** — 경기 상태 0xf(구질) → 0x10(조준) → 0x11(게이지·놓기)의 키와 틱 규칙 (원본 그대로).
 *
 * 키는 조작 객체(사람 vtable 0xd0a14) 슬롯 3 `0x536bc` 가 **새로 누른 키(`[+0x1c] == 0`)만** 상태표 0xd0a24 로 넘긴다.
 * 누르고 있는 반복(키 처리 0xbca04 의 반복 계수 하위 4비트)과 뗌(비트 8)은 [+0x1c] 가 0 이 아니라 0xf · 0x10 에는 안 온다
 * (0x11 비트 9 · 0x17 만 따로 받는다). 그래서 화면은 `event.repeat` 를 버리고, 키를 **떼는 것**은 아무 일도 안 한다.
 */

/* ── 원본 키 코드 ─────────────────────────────────────────────────────────────── */

/** WIPI 원시 키 코드 (I-controls 0절) — 위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16 · 숫자는 '0'~'9' 그대로 */
export const KEY_UP = -1
export const KEY_DOWN = -2
export const KEY_LEFT = -3
export const KEY_RIGHT = -4
export const KEY_OK = -5
export const KEY_CLEAR = -16

const DIGIT_ZERO = 0x30

/**
 * 웹 키 이름 → 원본 키 코드. 웹에서 OK 는 Enter·Space, CLR 은 Escape·Backspace 로 받는다(다른 화면과 같은 약속).
 * 원본 키가 아닌 것은 null.
 */
export function originalKeyCodeOf(key: string): number | null {
  switch (key) {
    case 'ArrowUp':
      return KEY_UP
    case 'ArrowDown':
      return KEY_DOWN
    case 'ArrowLeft':
      return KEY_LEFT
    case 'ArrowRight':
      return KEY_RIGHT
    case 'Enter':
    case ' ':
      return KEY_OK
    case 'Escape':
    case 'Backspace':
      return KEY_CLEAR
    case '*':
    case '#':
      return key.charCodeAt(0)
    default:
      return key.length === 1 && key >= '0' && key <= '9' ? key.charCodeAt(0) : null
  }
}

/* ── 0xf 구질 고르기 ──────────────────────────────────────────────────────────── */

/**
 * 구질 키 `0x534d8` → 메시지 7 의 칸 (0x50da8 이 `scene+0xfac[칸]` 의 구질을 `+0xfc8` 에 적는다).
 *
 * | 키 | OK · '5' | '2' · 위 | '4' · 왼 | '6' · 오른 | '8' · 아래 | '0' |
 * |---|---|---|---|---|---|---|
 * | 칸 | 0 | 1 | 2 | 3 | 4 | 5 (마구) |
 *
 * 그 밖의 키는 메시지가 없다(견제 '3'·'1'·'7' 은 이어 부르는 0x53548 몫).
 */
export function pitchSlotOfKey(key: string): number | null {
  switch (originalKeyCodeOf(key)) {
    case KEY_OK:
    case 0x35:
      return 0
    case KEY_UP:
    case 0x32:
      return 1
    case KEY_LEFT:
    case 0x34:
      return 2
    case KEY_RIGHT:
    case 0x36:
      return 3
    case KEY_DOWN:
    case 0x38:
      return 4
    case DIGIT_ZERO:
      return 5
    default:
      return null
  }
}

/**
 * **0xf → 0x10 넘김** `0x39c1c` (0xf 매 틱): 상태 틱 `[+0x2c] > 7` 이고 `+0xfc8`(고른 구질)이 0 이 아닐 때만 0x10 을 예약한다.
 * 0xf 진입 `0x3d954` 가 `+0xfc4 = +0xfc8 · +0xfc8 = 0` 으로 지우므로(3d9b8~3d9c4) 들어설 때마다 처음부터 고른다.
 * 그 전에 누른 키는 칸만 바꿔 적고(마지막 키가 이긴다) 넘김은 틱 8 을 기다린다.
 */
export const PITCH_SELECT_WAIT_TICKS = 7

export function isPitchSelectionDue(tick: number, chosenSlot: number | null): boolean {
  return tick > PITCH_SELECT_WAIT_TICKS && chosenSlot !== null
}

/* ── 0x10 조준 ───────────────────────────────────────────────────────────────── */

/** 조준점이 한 틱에 움직이는 방향 `+0x10b0`(dx) · `+0x10b4`(dy) — 각각 −1 · 0 · 1 */
export interface AimDirection {
  readonly dx: number
  readonly dy: number
}

export const AIM_STILL: AimDirection = { dx: 0, dy: 0 }

/** 0x10 의 키 하나가 하는 일 (메시지 8 `0x50e3a`) */
export type AimKeyAction =
  | { readonly kind: 'move'; readonly direction: AimDirection }
  /** OK · '5' — 0x50e9c: 코스 확정(마구면 남은 횟수 −1) 뒤 상태 0x11 예약 */
  | { readonly kind: 'confirm' }
  /** CLR — 0x50ee0: 상태 0xf 예약 (0xf 진입 0x3d954 가 다시 돈다) */
  | { readonly kind: 'cancel' }

/**
 * 메시지 8 `0x50e3a~0x50f24` — 0x10 에서 **새로 누른 키는 모두** 여기로 온다(0x534b0 → 메시지 8).
 * 머리(50e3a~50e46)에서 dx · dy 를 **먼저 0 으로** 지우고 키로 가른다:
 * ```
 * '2' · 위 → dy = +1          '8' · 아래 → dy = −1
 * '4' · 왼 → dx = −1          '6' · 오른 → dx = +1
 * '1' → (−1, +1)  '3' → (+1, +1)  '7' → (−1, −1)  '9' → (+1, −1)
 * OK · '5' → 0x50e9c (확정)   CLR → 0x50ee0 (0xf 로)   그 밖 → dx = dy = 0 (멈춤)
 * ```
 * 방향은 다른 키를 누를 때까지 남는다 — 키를 떼도(0x536bc 가 0x10 에 안 넘긴다) 조준점은 계속 흐른다.
 *
 * ⚠️ 미확인: '*'(경기 중 메뉴) · '#' 가 공용 키 0x498d4 와 함께 조작 객체에도 가서 dx · dy 를 지우는지는 안 봤다.
 * 웹은 그 둘을 조준 키로 보지 않는다(부르는 쪽이 null 을 받는다).
 */
export function aimKeyActionOf(key: string): AimKeyAction | null {
  const code = originalKeyCodeOf(key)
  if (code === null || code === 0x2a || code === 0x23) return null
  const move = (dx: number, dy: number): AimKeyAction => ({ kind: 'move', direction: { dx, dy } })
  switch (code) {
    case KEY_OK:
    case 0x35:
      return { kind: 'confirm' }
    case KEY_CLEAR:
      return { kind: 'cancel' }
    case KEY_UP:
    case 0x32:
      return move(0, 1)
    case KEY_DOWN:
    case 0x38:
      return move(0, -1)
    case KEY_LEFT:
    case 0x34:
      return move(-1, 0)
    case KEY_RIGHT:
    case 0x36:
      return move(1, 0)
    case 0x31:
      return move(-1, 1)
    case 0x33:
      return move(1, 1)
    case 0x37:
      return move(-1, -1)
    case 0x39:
      return move(1, -1)
    default:
      return move(0, 0)
  }
}

/** 한 틱 걸음 (0x39c5c) — x · y 는 방향 × 20, z 는 dy × 10 을 **뺀다** */
export const AIM_STEP = { x: 20, y: 20, z: 10 } as const
/** 존 중심 기준 자르기 (0x39c5c) — x ±600 · y ±400 · z ±200 */
export const AIM_CLAMP = { x: 600, y: 400, z: 200 } as const

/**
 * **0x10 진입 `0x39894`** — 조준점 `+0x10b8/bc/c0` 을 존 중심 표 `0xcfbcc[side]`(x · y · z 세 칸)로 놓는다
 * (그 전 값은 `+0x10c4` 로 옮긴다). 코스 단계에 들어설 때마다 한가운데서 다시 시작한다.
 */
export function aimStartOf(side: number): WorldPoint {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: center.x, y: center.y, z: center.z }
}

const clampAround = (value: number, middle: number, half: number) =>
  Math.max(middle - half, Math.min(middle + half, value))

/**
 * 0x10 매 틱 `0x39c5c` 의 앞부분 — 걸음 뒤 자르기 (모든 모드):
 * ```
 * 39c5c  x += dx·20 · y += dy·20 · z −= dy·10
 * 39cb0  x 를 [cx − 600, cx + 600] · y 를 [cy − 400, cy + 400] · z 를 [cz − 200, cz + 200] 로 (중심 = 0xcfbcc[side])
 * ```
 */
export function stepAim(aim: WorldPoint, direction: AimDirection, side: number): WorldPoint {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return {
    x: clampAround(aim.x + direction.dx * AIM_STEP.x, center.x, AIM_CLAMP.x),
    y: clampAround(aim.y + direction.dy * AIM_STEP.y, center.y, AIM_CLAMP.y),
    z: clampAround(aim.z - direction.dy * AIM_STEP.z, center.z, AIM_CLAMP.z),
  }
}

/**
 * 0x10 의 **틱 하나** `0x39c5c` 전부 — 걸음 · 자르기 뒤, 투수 미션(`+0x1788` 미션 객체 · 모드 `+0x1104 == 5`)이면
 * 미션 레코드 바이트 13(`conditionCode`)대로 흔든다(39d24~39dde, `applyMissionAimShake`). 흔든 값은 다음 틱에야 잘린다.
 *
 * 원본은 이 틱을 0x10 에 있는 동안 **매 틱** 돌린다 — OK · CLR 을 누른 틱도 메시지 8 이 dx · dy 를 0 으로 지운 뒤
 * 한 번 더 돈다(상태 바꿈은 0xbcb48 예약이라 다음 틱이다). 미션 흔들림 난수도 그 틱마다 먹는다.
 * 미션이 아니거나 세기가 0 이면 난수를 한 톨도 안 쓴다.
 */
export function aimTickOf(
  aim: WorldPoint,
  direction: AimDirection,
  side: number,
  /** 투수 미션의 흔들림 세기와 경기 난수. 미션이 아니면 안 넘긴다 */
  mission?: { readonly conditionCode: number; readonly random: RandomPort },
): WorldPoint {
  const stepped = stepAim(aim, direction, side)
  if (mission === undefined || mission.conditionCode === 0) return stepped
  return applyMissionAimShake(stepped, mission.conditionCode, side, mission.random)
}

/** 존 중심(0x39894)에서 한 방향을 `ticks` 틱 동안 흘린 조준점 — 걸음 · 자르기만(흔들림 없음) */
export function aimAfterTicks(side: number, direction: AimDirection, ticks: number): WorldPoint {
  let aim = aimStartOf(side)
  for (let tick = 0; tick < ticks; tick += 1) aim = stepAim(aim, direction, side)
  return aim
}

/* ── 0x11 게이지 · 놓기 ──────────────────────────────────────────────────────── */

/**
 * **0x11 의 놓기** `0x4e060`: 상태 틱 `[+0x2c] > 9` 이고 아직 안 던졌으면(`+0x1980`) 투구 `0x4dc78` 를 부른다.
 * 게이지를 누르든 안 누르든 **틱 10 에 던진다** — 게이지 OK(0x50e08)는 등급 t 만 정하고 공을 내보내지 않는다.
 */
export const PITCH_RELEASE_WAIT_TICKS = 9

export function isPitchReleaseDue(tick: number): boolean {
  return tick > PITCH_RELEASE_WAIT_TICKS
}

/**
 * 게이지 OK `0x50e08` — 메시지 9(0x53670 → 키 OK · '5')가 부른다:
 * ```
 * 50e08  +0x17c8 == 0 이면 +0x17c8 = 커서 칸 +0x17bc
 * 50e1a  (+0x17c8 − 1) 이 0..8 이 아니면(칸 1~9 가 아니면) 그냥 끝 — 등급 t 를 안 정한다
 * 50e26  +0x17c0(t) = max(+0x17c8 − 4, 1)
 * ```
 * 커서 0 에서 누르면 +0x17c8 이 0 으로 남아 **다시 누를 수 있다**. 한 번 칸 1~9 로 정하면 커서(0x4d708, t == 0 일 때만 +1)가
 * 멈추고, 그 뒤 누름은 같은 칸을 다시 적을 뿐이다. 돌려주는 값 = 새 `+0x17c8`.
 */
export function gaugePressedCellOf(pressedCell: number, cursorCell: number): number {
  return pressedCell === 0 ? cursorCell : pressedCell
}

