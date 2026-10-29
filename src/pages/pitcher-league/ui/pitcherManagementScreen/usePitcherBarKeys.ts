import { useEffect, useEffectEvent } from 'react'
import { isNariMenuOkKey, nariMenuCursorAfterStep, nariMenuStepOfKey } from './otherSlices'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'

/** 키 처리기가 볼 커맨드 줄의 지난 그림 값 */
export interface PitcherBarHeld {
  readonly cursor: number
  readonly slots: readonly { readonly id: string }[]
  readonly moveTo: (index: number) => void
  readonly menu: PitcherManagementMenu
  readonly isOffSlot: (index: number) => boolean
  readonly isSliding: boolean
}

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/**
 * 커맨드 줄 키 — 칸이 펼쳐지는 동안은 버리고, vt+0x18 0x6c299 → 0x6c031(숫자키 꼴 1) → vt+8 0x6c445 —
 * ←↑'4''2' / →↓'6''8' 은 칸 옮기기(꺼진 칸은 건너뛴다, `nariMenuKeys`) · 확인(Enter · '5' · ' ') · 취소(−16).
 */
export function usePitcherBarKeys(isKeyEnabled: boolean, held: () => PitcherBarHeld) {
  const latest = useEffectEvent(held)
  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const current = latest()
      if (current.isSliding) return
      const step = nariMenuStepOfKey(event.key)
      if (step !== 0) {
        event.preventDefault()
        return current.moveTo(nariMenuCursorAfterStep(current.cursor, step, current.slots.length, current.isOffSlot))
      }
      if (isNariMenuOkKey(event.key) || event.key === ' ') {
        event.preventDefault()
        return current.menu.select(current.slots[current.cursor].id)
      }
      if (isCancelKey(event.key)) {
        event.preventDefault()
        current.menu.back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isKeyEnabled])
}
