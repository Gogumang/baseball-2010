/**
 * 투수 기본 변화구 고르기 커서 (나만의리그 상태 0x67 — 진입 0x10b18 · 키 0x12410, 직접 떴다).
 *
 * 격자 [this+0x88] 은 장면 셋업 0xf7ba 의 `new(0x28)` → 0x6bd7d(기본 목록, vtable 0xd2e60) 이고,
 * 0x10b18 이 `vtable+0x10(1열, 9줄, 숫자키 꼴 1, 꼴 0x330, 소리 0)`(0x10b82~0x10b8a = 0x6bfe1) 뒤
 * `vtable+0x14(0, 0)` 으로 **들어올 때마다 칸 0** 에 둔다. 칸 0~7 = 표 0xcc520 의 구질, 칸 8 = OK.
 *
 * 키 0x12410 은 ↑ ↓ 를 목록에 맡기지 않고 **칸 번호를 ±2** 로 직접 바꾼다(그림은 두 줄씩 놓인다):
 * ```
 * OK · '5'  칸 8 이면 개수 ≤ 1 → StrMODE[13] · 아니면 StrMODE[2] (웹은 화면 쪽)
 *           아니면 0x123ac 로 칸을 켜고/끄고, 개수 = 2 면 칸 8 로 · 아니면 칸 + 2 (9 면 8)
 * ↓ · '8'   칸 + 2 — 9 면 8 · 그보다 크면(칸 8 → 10) 칸 − 7 = **1**   (0x12578~0x1259c)
 * ↑ · '2'   칸 8 → 7 · 칸 0 → 8 · 칸 − 2 < 0 (칸 1) 이면 칸 + 7 = 8 · 아니면 칸 − 2 (0x1259e~0x125cc)
 * ← → '4' '6'  목록 키 0x6c031 로 넘긴다 → 0x6be71 → 0x6bead(dx = ∓1)
 * CLR       0x66 으로 (웹은 화면 쪽)
 * ```
 * ← → 는 꼴 0x330 을 탄다: 0x10(가로 감기) 이라 1열에서 넘치면 x = (0 ± 1 + 1) % 1 = 0 이고,
 * 0x100 이라 가로로 감길 때 **세로로 한 칸** 같은 방향(부호 dx)으로 옮긴다(되부름 깊이 1 까지, 줄 > 1).
 * 세로는 0x20(세로 감기)이라 (y ± 1 + 9) % 9 — 그래서 ← → 는 칸 번호 ±1 을 9 칸 안에서 감는다.
 * 0x200(세로로 감길 때 가로 한 칸)은 열이 1 이라 걸리지 않는다. 소리 바이트 [+0x20] = 0 이라 목록은 소리를 안 낸다.
 */

/** 칸 수 — 구질 8 + OK 1 */
export const BREAKING_PITCH_CELL_COUNT = 9
/** OK 칸 */
export const BREAKING_PITCH_OK_CELL = 8

export type BreakingPitchKey = 'up' | 'down' | 'left' | 'right'

/** ↑ ↓ ← → 로 옮긴 칸 (0x12410) */
export function breakingPitchCursorAfter(cell: number, key: BreakingPitchKey): number {
  if (key === 'down') {
    const next = cell + 2
    if (next === 9) return BREAKING_PITCH_OK_CELL
    return next <= BREAKING_PITCH_OK_CELL ? next : cell - 7
  }
  if (key === 'up') {
    if (cell === BREAKING_PITCH_OK_CELL) return 7
    if (cell === 0) return BREAKING_PITCH_OK_CELL
    const next = cell - 2
    return next < 0 ? cell + 7 : next
  }
  const step = key === 'right' ? 1 : -1
  return (cell + step + BREAKING_PITCH_CELL_COUNT) % BREAKING_PITCH_CELL_COUNT
}

/**
 * 구질 칸(0~7)에서 OK 를 눌러 켜고/끈 뒤의 칸 (0x124fe~0x12560). `chosenCount` 는 바꾼 뒤 개수다.
 * 칸 + 2 가 9 를 넘는 갈래(칸 − 7)는 구질 칸이 7 까지라 닿지 않는다 — 원본 그대로 둔다.
 */
export function breakingPitchCursorAfterToggle(cell: number, chosenCount: number): number {
  if (chosenCount === 2) return BREAKING_PITCH_OK_CELL
  const next = cell + 2
  if (next === 9) return BREAKING_PITCH_OK_CELL
  return next <= BREAKING_PITCH_OK_CELL ? next : cell - 7
}

/**
 * 웹 키 → 0x67 키. OK = Enter · '5', CLR = Esc · Backspace.
 * '2' '8' 은 0x12410 이 ↑ ↓ 와 함께 보고, '4' '6' 은 목록(숫자키 꼴 1, 표 0xd2e7c)이 ← → 로 바꾼다.
 */
export function breakingPitchKeyOf(key: string): BreakingPitchKey | 'ok' | 'clr' | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  if (key === 'ArrowLeft' || key === '4') return 'left'
  if (key === 'ArrowRight' || key === '6') return 'right'
  if (key === 'Enter' || key === '5') return 'ok'
  if (key === 'Escape' || key === 'Backspace') return 'clr'
  return null
}
