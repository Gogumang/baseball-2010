import { useEffect } from 'react'

type AceLevelUpKeyKind = '바꾸기' | '확인' | '닫기'

/** 0x5fb68~0x5fb94 — −4 · −3 · '4' · '6' 예 ↔ 아니오 · −5(OK) · '5' 확인 · −16(CLR) · '0' 닫기. 그 밖(−2·−1·0·1·2 따위)은 아무 일도 없다 */
const ACE_LEVEL_UP_KEY_KIND_OF: ReadonlyMap<string, AceLevelUpKeyKind> = new Map([
  ['ArrowLeft', '바꾸기'],
  ['ArrowRight', '바꾸기'],
  ['4', '바꾸기'],
  ['6', '바꾸기'],
  ['Enter', '확인'],
  ['5', '확인'],
  ['Escape', '닫기'],
  ['Backspace', '닫기'],
  ['0', '닫기'],
] as const)

/** 창 키 — G 부족 팝업이 떠 있으면 팝업이 키를 받는다. 그림마다 다시 건다(키 콜백이 그 그림의 값을 본다) */
export function useAceLevelUpKeys(
  isShortageOpen: boolean,
  handlers: { readonly onToggle: () => void; readonly onConfirm: () => void; readonly onClose: () => void },
): void {
  useEffect(() => {
    if (isShortageOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const kind = ACE_LEVEL_UP_KEY_KIND_OF.get(event.key) ?? null
      if (kind === null) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (kind === '바꾸기') handlers.onToggle()
      else if (kind === '확인') handlers.onConfirm()
      else handlers.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
