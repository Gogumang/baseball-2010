import { useEffect, useEffectEvent } from 'react'

/** 구장 창 키가 할 일 — 종류 목록(back · enter · left · right) · 칸 목록(leave · select · up · down) */
type StadiumKeyAction = 'back' | 'enter' | 'left' | 'right' | 'leave' | 'select' | 'up' | 'down'

/** 확인 키 −5 · '5'(웹은 Space 도) / 취소 −16 */
const CONFIRM_KEYS = ['Enter', ' ', '5']
const CANCEL_KEYS = ['Escape', 'Backspace']
const keyEntries = (keys: readonly string[], action: StadiumKeyAction) => keys.map((key) => [key, action] as const)

/** 종류 목록(초점 0) — 취소 → 뒤로 · 확인 · 아래('8') → 칸 목록 · 왼 · 오른('4' '6') → 종류를 감아 옮긴다 */
const KIND_KEYS = new Map<string, StadiumKeyAction>([
  ...keyEntries(CANCEL_KEYS, 'back'),
  ...keyEntries([...CONFIRM_KEYS, 'ArrowDown', '8'], 'enter'),
  ...keyEntries(['ArrowLeft', '4'], 'left'),
  ...keyEntries(['ArrowRight', '6'], 'right'),
])
/** 칸 목록(초점 1) — 취소 → 종류 목록 · 확인 → 가드 · 교체 · 위 · 아래('2' '8') → 칸을 감아 옮긴다 */
const SLOT_KEYS = new Map<string, StadiumKeyAction>([
  ...keyEntries(CANCEL_KEYS, 'leave'),
  ...keyEntries(CONFIRM_KEYS, 'select'),
  ...keyEntries(['ArrowUp', '2'], 'up'),
  ...keyEntries(['ArrowDown', '8'], 'down'),
])

export interface StadiumKeyTarget {
  readonly isPopup: boolean
  readonly isSlotFocus: boolean
  readonly run: Readonly<Record<StadiumKeyAction, () => void>>
}

/** 창 키 0x819ac 종류 3 · 4 공용 두 층 갈래 — 그때 그 렌더의 값으로 본다 (`useEffectEvent` — 등록은 들어올 때 한 번) */
export function useStadiumKeys(target: StadiumKeyTarget) {
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (target.isPopup) return
    const action = (target.isSlotFocus ? SLOT_KEYS : KIND_KEYS).get(event.key)
    if (action === undefined) return
    target.run[action]()
    event.preventDefault()
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
