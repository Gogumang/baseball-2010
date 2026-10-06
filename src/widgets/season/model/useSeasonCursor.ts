import { useEffect, useRef, useState } from 'react'

/**
 * 시즌 화면의 커서 — 원본 키 규칙 그대로 (P4 1a).
 *
 * ```
 * 키 값: −5 · 0x35('5') = 확인 ,  −16 = 취소/뒤로   (0x8f30 · 0x48d0 · 0x4e40 공통)
 * ```
 * 웹에서는 Enter·Space·`5` 를 확인으로, Escape·Backspace 를 취소로 받는다.
 * 위·아래 화살표는 원본 메뉴 객체(`0x6c219(메뉴, 6, 1, 1)` — 한 열짜리)의 커서 이동이다.
 */
export interface SeasonCursorOptions {
  /** 칸 수. 0 이면 커서가 움직이지 않는다 */
  readonly count: number
  readonly onSelect: (index: number) => void
  readonly onCancel?: () => void
  /** 팝업이 떠 있으면 화면은 키를 안 받는다 (원본 `this+0xc0 +0x99 ≠ 0` 이면 키 무시) */
  readonly isEnabled?: boolean
  /**
   * 커서를 부르는 쪽이 들고 있으면 넘긴다 — 원본 메뉴 객체(관리 메뉴 this+0x70 · 구단관리 this+0x78)는 장면이 사는 동안
   * 남아 상태를 오가도 커서가 이어진다. 주면 `onCursorChange` 로만 바뀐다.
   */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
}

export interface SeasonCursor {
  readonly cursor: number
  readonly moveTo: (index: number) => void
}

export function useSeasonCursor({
  count, onSelect, onCancel, isEnabled = true, cursor: heldCursor, onCursorChange,
}: SeasonCursorOptions): SeasonCursor {
  const [ownCursor, setOwnCursor] = useState(0)
  const cursor = heldCursor ?? ownCursor

  // 칸이 줄어들면 커서를 안으로 끌어온다 — 목록이 바뀌는 화면(영입 목록)이 있다
  const safeCursor = count === 0 ? 0 : Math.min(cursor, count - 1)

  const setCursor = (index: number) => {
    if (heldCursor === undefined) setOwnCursor(index)
    onCursorChange?.(index)
  }
  /** 위·아래 한 칸 — 화면이 커서를 들면 이전 값에서 셈하고, 부르는 쪽이 들면 지금 값에서 셈해 넘긴다 */
  const stepCursor = (step: number, total: number, current: number) => {
    const next = (previous: number) => (Math.min(previous, total - 1) + step + total) % total
    if (heldCursor === undefined) return setOwnCursor(next)
    onCursorChange?.(next(current))
  }

  const latest = useRef({ count, onSelect, onCancel, cursor: safeCursor, stepCursor })
  latest.current = { count, onSelect, onCancel, cursor: safeCursor, stepCursor }

  useEffect(() => {
    if (!isEnabled) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const { count: total, cursor: current, onSelect: select, onCancel: cancel, stepCursor: move } = latest.current
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (total === 0) return
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        move(step, total, current)
        return
      }
      // 확인 — 원본 −5 · '5'
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        if (total === 0) return
        event.preventDefault()
        select(current)
        return
      }
      // 취소 — 원본 −16
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (cancel === undefined) return
        event.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEnabled])

  return { cursor: safeCursor, moveTo: setCursor }
}
