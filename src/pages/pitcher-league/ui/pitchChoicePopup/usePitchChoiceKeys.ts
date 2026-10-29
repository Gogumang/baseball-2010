import { useEffect, useEffectEvent } from 'react'
import type { RefObject } from 'react'
import type { PopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'

/** 키 · 연출 끝 콜백이 볼 최신 값 — 창이 커밋 때 적는다 */
export interface PitchChoiceLatest {
  readonly selected: number
  readonly onMove: (index: number) => void
  readonly onChoose: (index: number) => void
  readonly onClosed: () => void
}

/** 키 0x19398 — ← → · '4' · '6' 은 +0x166 뒤집기(193ae~193be), OK(−5) · ' ' · '5' 는 확인, CLR(−16)은 줄이기만(1942a~19434) */
const CHOICE_KEY_ACTIONS = new Map<string, 'move' | 'confirm' | 'cancel'>([
  ['ArrowLeft', 'move'],
  ['ArrowRight', 'move'],
  ['4', 'move'],
  ['6', 'move'],
  ['Enter', 'confirm'],
  [' ', 'confirm'],
  ['5', 'confirm'],
  ['Escape', 'cancel'],
  ['Backspace', 'cancel'],
])

/** 창 키를 잡는다 — 펼치는 동안 · 줄이는 동안은 키를 잡기만 하고 키 콜백을 부르지 않는다 (0x754f8 → 0x75556 · 0x7558a 갈래) */
export function usePitchChoiceKeys(motion: PopupWindowMotion, latest: RefObject<PitchChoiceLatest>, confirm: (index: number) => void) {
  const confirmFromKey = useEffectEvent(confirm)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (!motion.acceptsKeys()) {
        if (motion.isClosed) return
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const action = CHOICE_KEY_ACTIONS.get(event.key)
      if (action === undefined) return
      if (action === 'move') current.onMove(current.selected === 0 ? 1 : 0)
      else if (action === 'confirm') confirmFromKey(current.selected === 0 ? 0 : 1)
      else motion.close('줄임', () => latest.current.onClosed())
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [motion, latest])
}
