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
