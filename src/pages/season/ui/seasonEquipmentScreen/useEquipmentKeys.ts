import { useEffect, useEffectEvent } from 'react'

/** 장비 창 키가 할 일 — 부위 목록(back · enter · left · right) · 칸 목록(leave · select · up · down) */
type EquipmentKeyAction = 'back' | 'enter' | 'left' | 'right' | 'leave' | 'select' | 'up' | 'down'

/**
 * 부위 목록 [창+0x1a8] = 0 — 취소 → 0xdf · 확인(−5 · '5') · 아래(−2 · '8') → 칸 목록 · 왼 · 오른('4' '6') → 부위를 감아 옮긴다.
 * 그 밖의 키는 받지 않는다(preventDefault 도 안 한다).
 */
const PART_KEYS = new Map<string, EquipmentKeyAction>([
  ['Escape', 'back'],
  ['Backspace', 'back'],
  ['Enter', 'enter'],
  ['5', 'enter'],
  ['ArrowDown', 'enter'],
  ['8', 'enter'],
  ['ArrowLeft', 'left'],
  ['4', 'left'],
  ['ArrowRight', 'right'],
  ['6', 'right'],
])
/** 칸 목록 — 취소 → 부위 목록 · 확인 → 가드 · 위 · 아래('2' '8') → 칸을 감아 옮기며 끼워 본다 */
const ITEM_KEYS = new Map<string, EquipmentKeyAction>([
  ['Escape', 'leave'],
  ['Backspace', 'leave'],
  ['Enter', 'select'],
  ['5', 'select'],
  ['ArrowUp', 'up'],
  ['2', 'up'],
  ['ArrowDown', 'down'],
  ['8', 'down'],
])

export interface EquipmentKeyTarget {
  readonly isItemFocus: boolean
  /** 팝업(알림 · 물음)이 떠 있으면 키를 안 받는다 */
  readonly isPopup: boolean
  readonly run: Readonly<Record<EquipmentKeyAction, () => void>>
}

/**
 * 장비 창 키 0x957c → 창 키 0x819ac 종류 3 — 한 번만 걸고(옛 등록 차례) 그때그때 최신 칸 · 할 일을 읽는다.
 * 숫자 키: 격자 키 0x6c030 의 방식 1 갈래(0x6c096 — 표 0xd2e7c)가 '2' → 위 · '4' → 왼 · '6' → 오른 · '8' → 아래 · '5' → 확인.
 */
export function useEquipmentKeys(target: EquipmentKeyTarget) {
  const latest = useEffectEvent(() => target)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest()
      if (current.isPopup) return
      const action = (current.isItemFocus ? ITEM_KEYS : PART_KEYS).get(event.key)
      if (action === undefined) return
      current.run[action]()
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
