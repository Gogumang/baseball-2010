import { useEffect } from 'react'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'

/** 브라우저 키 → 편집기 키 (화살표 · 숫자 키패드 둘 다). 없는 키는 넘기지 않는다 */
const ENTRY_KEY_OF: ReadonlyMap<string, EntryKey> = new Map([
  ['ArrowUp', '위'],
  ['2', '위'],
  ['ArrowDown', '아래'],
  ['8', '아래'],
  ['ArrowLeft', '왼'],
  ['4', '왼'],
  ['ArrowRight', '오른'],
  ['6', '오른'],
  ['Enter', '확인'],
  ['5', '확인'],
  ['Escape', '취소'],
  ['*', '별'],
  ['0', '영'],
] as const)

/** 키를 편집기 키(0x55864 가 받는 것)로 바꿔 넘긴다 — 마선수 잠금 창이 떠 있으면 안 받는다 */
export function useEntryKeyboard(isAceLocked: boolean, onKey: (key: EntryKey) => void): void {
  useEffect(() => {
    if (isAceLocked) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const key = ENTRY_KEY_OF.get(event.key) ?? null
      if (key === null) return
      event.preventDefault()
      onKey(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isAceLocked, onKey])
}
