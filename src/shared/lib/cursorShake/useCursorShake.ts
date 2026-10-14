import { useState } from 'react'
import { CURSOR_SHAKE_DIRECTION_CODES, cursorShakeOf } from '@/shared/lib/cursorShake/cursorShake'
import type { CursorShakeDirection } from '@/shared/lib/cursorShake/cursorShake'

/**
 * 커서가 옮겨 간 그리기부터 두 그리기 동안의 까딱임 (`cursorShakeOf`).
 * `tick` 은 그 화면의 갱신 횟수(`useUpdateCounter`)다. `start(방향)` 은 커서가 **실제로 옮겨 간** 키에서만 부른다 —
 * 원본은 격자 +0x25(커서 바뀜)가 선 그리기에서만 [방향 칸] 을 세운다.
 */
export function useCursorShake(tick: number) {
  const [shake, setShake] = useState<{ readonly directionCode: number; readonly startedAt: number } | null>(null)
  const offset = shake === null ? { dx: 0, dy: 0 } : cursorShakeOf(shake.directionCode, tick - shake.startedAt)
  const start = (direction: CursorShakeDirection) =>
    setShake({ directionCode: CURSOR_SHAKE_DIRECTION_CODES[direction], startedAt: tick })
  return { offset, start }
}
