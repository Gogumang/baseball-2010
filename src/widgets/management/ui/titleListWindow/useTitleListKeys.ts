import { useEffect } from 'react'
import { titleListTopAfter } from '@/widgets/management/lib/titleListLayout'

/** ↑ · ↓ 키 → 커서 한 칸 (그 밖 키는 0) */
const CURSOR_STEP_BY_KEY: ReadonlyMap<string, number> = new Map([
  ['ArrowDown', 1],
  ['ArrowUp', -1],
])

interface TitleListKeysInput {
  /** 팝업이 떠 있으면 MessageBox 가 먼저 키를 가져간다 */
  readonly isActive: boolean
  readonly count: number
  readonly cursor: number
  readonly top: number
  readonly visibleRows: number
  /** 커서가 옮겨 갔다 — 윗줄이 바뀌었으면 `nextTop` 이 다르다 */
  readonly onMove: (next: number, nextTop: number) => void
  readonly onConfirm: () => void
}

/** 키 0x11f78 — ↑ · ↓ 는 한 줄씩 돌고(윗줄은 `titleListTopAfter`), 확인은 장착 */
export function useTitleListKeys({ isActive, count, cursor, top, visibleRows, onMove, onConfirm }: TitleListKeysInput) {
  useEffect(() => {
    if (!isActive) return
    const onKey = (event: KeyboardEvent) => {
      const step = CURSOR_STEP_BY_KEY.get(event.key) ?? 0
      if (step !== 0) {
        event.preventDefault()
        if (count === 0) return
        const next = (cursor + step + count) % count
        onMove(next, titleListTopAfter(top, next, visibleRows))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
