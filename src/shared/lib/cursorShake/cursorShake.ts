/**
 * **고른 칸 까딱임** — 커서가 옮겨 간 방향으로 고른 칸(줄 · 판)이 두 틀 동안 2px 까딱인다.
 *
 * 방향 번호는 키를 받을 때 0x5550d(skin, 키)가 [skin+0x8c] 에 적는다 — ← (−3) 0 · → (−4) 1 · ↑ (−1) 2 · ↓ (−2) 3.
 * 숫자 키 2·4·6·8 은 적지 않는다(0x5550c 는 −1~−4 만 본다). 까딱임을 그리는 곳마다 표 한 벌씩을 따로 갖지만 값은 모두 같다:
 * ```
 * 기록연감 0xce8bc · 0xce88c (0x2ec36 · 0x2f0fe) · 스페셜 목록 설명 판 0xce8bc · 0xce88c (0x2572a)
 * 환경설정 공용 판 0x593c8 0xd1784 · 0xd1754 (첫 화면 0x59626 · 상세 설정 0x59f2c · 모드 초기화 0x5a3ae)
 * ```
 * 그리기마다 `x += X[2·방향 + t]`, `y += Y[3·방향 + t]` 를 쓰고 t 를 올린다 — t > 1 이면 방향 칸을 −1 로 지워 끝낸다.
 * 표: X = [−2, 2, 2, −2, 0, 0, 0, 0] · Y = [0, 0, 0, 0, 0, 0, −2, 2, 0, 2, −2, 0] (Y 는 3칸 걸음이라 칸 2 · 5 · 8 은 안 쓴다)
 * → ← (−2,0)(+2,0) · → (+2,0)(−2,0) · ↑ (0,−2)(0,+2) · ↓ (0,+2)(0,−2).
 */

export type CursorShakeDirection = 'left' | 'right' | 'up' | 'down'

/** [skin+0x8c] 방향 번호 (0x5550d) */
export const CURSOR_SHAKE_DIRECTION_CODES: Record<CursorShakeDirection, number> = { left: 0, right: 1, up: 2, down: 3 }

const SHAKE_X = [-2, 2, 2, -2, 0, 0, 0, 0] as const
const SHAKE_Y = [0, 0, 0, 0, 0, 0, -2, 2, 0, 2, -2, 0] as const

/** 방향 번호 · t(까딱임을 시작한 뒤 몇 번째 그리기, 0 부터)의 옮김 — t 가 0 · 1 밖이면 (0, 0) */
export function cursorShakeOf(directionCode: number, tick: number): { readonly dx: number; readonly dy: number } {
  if (tick < 0 || tick > 1) return { dx: 0, dy: 0 }
  return { dx: SHAKE_X[2 * directionCode + tick] ?? 0, dy: SHAKE_Y[3 * directionCode + tick] ?? 0 }
}

/** 키 이름 → 방향 (화살표 키만 — 0x5550d 는 숫자 키를 안 적는다) */
export function cursorShakeDirectionOfKey(key: string): CursorShakeDirection | null {
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  return null
}
