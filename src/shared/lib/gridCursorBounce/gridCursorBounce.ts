import { useCallback, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

export type GridBounceDirection = 'left' | 'right' | 'up' | 'down'

/** 방향 번호 — 0x5550d 가 키를 [skin+0x8c] 에 적는 값: −3 → 0 왼 · −4 → 1 오른 · −1 → 2 위 · −2 → 3 아래 (0x5550c~0x5553c) */
const DIRECTION_INDEX: Readonly<Record<GridBounceDirection, number>> = { left: 0, right: 1, up: 2, down: 3 }

/** 0xd4080 — s32, (방향 · 2 + 걸음) 으로 읽는다 */
const BOUNCE_DX: readonly number[] = [-2, 2, 2, -2, 0, 0, 0, 0]
/** 0xd4050 — s32, (방향 · 3 + 걸음) 으로 읽는다 (원본 그대로 간격이 다르다) */
const BOUNCE_DY: readonly number[] = [0, 0, 0, 0, 0, 0, -2, 2, 0, 2, -2, 0]

export interface GridBounceOffset {
  readonly dx: number
  readonly dy: number
}

const NO_BOUNCE: GridBounceOffset = { dx: 0, dy: 0 }

/**
 * **격자 커서 튕김** — 공용 격자 그리기 0x7a571 (0x7a60a~0x7a61e · 0x7a7f6~0x7a842, 직접 떴다).
 * ```
 * 그릴 때 [격자+6] 이고 커서 +0x25(이번 갱신에 칸이 바뀌었다 — 격자 키 0x6c030 의 0x6c17c~0x6c192)면
 *   +0x6c = 0 · +0x70 = [skin+0x8c](키 방향, 0x5550d)
 * 칸 자리를 셈한 뒤 i == 고른 칸이고 [격자+6] · +0x70 ≠ −1 이면
 *   x += 0xd4080[2·+0x70 + +0x6c] · y += 0xd4050[3·+0x70 + +0x6c] · +0x6c++ · +0x6c > 1 이면 +0x70 = −1
 * ```
 * 칸 자리는 그림마다 새로 셈하므로 쌓이지 않는다 — 옮긴 그림에 그 방향으로 2, 다음 그림에 반대로 2, 그다음 제자리.
 * 커서 +0x25 는 다음 갱신의 격자 키가 맨 앞에서 지우므로(0x6c04a~0x6c052) 한 그림만 선다. 고른 칸의 바탕 · 내용 · 커서가 함께 움직인다.
 * `step` 은 옮긴 그림을 0 으로 센 그림 수다.
 */
export function gridCursorBounceOf(direction: GridBounceDirection, step: number): GridBounceOffset {
  if (step < 0 || step > 1) return NO_BOUNCE
  const index = DIRECTION_INDEX[direction]
  return { dx: BOUNCE_DX[2 * index + step] ?? 0, dy: BOUNCE_DY[3 * index + step] ?? 0 }
}

/**
 * 격자 커서 튕김을 그림 수로 굴린다. 키 처리기가 **칸이 바뀐** 방향 키에서 `start(방향)` 을 부르면 그 그림부터 두 그림 동안
 * 고른 칸에 `offset` 을 더하면 된다. 튕김은 시작 0x7a005 의 셋째 인자 [격자+6] 이 선 격자만 — 팀 고르기 k 0 · 1 · 9 (0x6409c) ·
 * 마선수 k 2 · 10 · 11 (0x64836) · 명전 k 6 ~ 8 (0x651e4) · 미션 고르기 (0x1e1b0).
 */
export function useGridCursorBounce(): { readonly offset: GridBounceOffset; readonly start: (direction: GridBounceDirection) => void } {
  const draws = useUpdateCounter()
  const drawsRef = useRef(draws)
  useMirrorRef(drawsRef, draws)
  const [bounce, setBounce] = useState<{ readonly direction: GridBounceDirection; readonly startDraw: number } | null>(null)
  const start = useCallback((direction: GridBounceDirection) => {
    setBounce({ direction, startDraw: drawsRef.current })
  }, [])
  const offset = bounce === null ? NO_BOUNCE : gridCursorBounceOf(bounce.direction, draws - bounce.startDraw)
  return { offset, start }
}
