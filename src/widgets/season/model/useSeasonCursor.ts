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
}

export interface SeasonCursor {
  readonly cursor: number
  readonly moveTo: (index: number) => void
}

export function useSeasonCursor({ count, onSelect, onCancel, isEnabled = true }: SeasonCursorOptions): SeasonCursor {
  const [cursor, setCursor] = useState(0)

  // 칸이 줄어들면 커서를 안으로 끌어온다 — 목록이 바뀌는 화면(영입 목록)이 있다
  const safeCursor = count === 0 ? 0 : Math.min(cursor, count - 1)

  const latest = useRef({ count, onSelect, onCancel, cursor: safeCursor })
  latest.current = { count, onSelect, onCancel, cursor: safeCursor }

  useEffect(() => {
    if (!isEnabled) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const { count: total, cursor: current, onSelect: select, onCancel: cancel } = latest.current
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (total === 0) return
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setCursor((previous) => (Math.min(previous, total - 1) + step + total) % total)
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
