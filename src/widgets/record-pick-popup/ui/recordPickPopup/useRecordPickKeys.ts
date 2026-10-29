import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { PopupCloseKind, PopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** 키 콜백 — 그림마다 최신 것을 읽는다 */
export interface RecordPickHandlers {
  readonly onToggle: () => void
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly onClosed?: () => void
}

type RecordPickKeyKind = '바꾸기' | '확인' | '취소'

/** 좌·우(−3 · −4) · '4' · '6' 바꾸기 · 확인(−5 · '5') · CLR(Escape · Backspace) */
const RECORD_PICK_KEY_KIND_OF: ReadonlyMap<string, RecordPickKeyKind> = new Map([
  ['ArrowLeft', '바꾸기'],
  ['ArrowRight', '바꾸기'],
  ['4', '바꾸기'],
  ['6', '바꾸기'],
  ['Enter', '확인'],
  ['5', '확인'],
  ['Escape', '취소'],
  ['Backspace', '취소'],
] as const)

/**
 * 키는 잡는 단계에서 다 가져간다(뒤 메뉴가 같은 키를 받지 않게). 펼치는 동안 · 줄이는 동안은 잡기만 하고 콜백을 안 부른다
 * (0x754f8 → 0x75556 · 0x7558a 갈래). 돌려주는 확인은 `'바로'` 면 치운 자리에서, `'줄임'` 이면 다음 갱신에 `onConfirm` · 다 닫히면 `onClosed`
 */
export function useRecordPickKeys(motion: PopupWindowMotion, closeKind: PopupCloseKind, latest: RefObject<RecordPickHandlers>): () => void {
  const closeKindRef = useRef(closeKind)
  useMirrorRef(closeKindRef, closeKind)
  const closeMotion = motion.close
  const confirm = useCallback(() => {
    if (closeKindRef.current === '바로') return closeMotion('바로', () => latest.current.onConfirm())
    return closeMotion(
      '줄임',
      () => latest.current.onClosed?.(),
      () => latest.current.onConfirm(),
    )
  }, [closeMotion, latest])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      const kind = RECORD_PICK_KEY_KIND_OF.get(event.key) ?? null
      if (!motion.acceptsKeys()) {
        if (motion.isClosed) return
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (kind === null) return
      if (kind === '취소') motion.close(closeKindRef.current, current.onCancel)
      else if (kind === '바꾸기') current.onToggle()
      else confirm()
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
    // `motion` 은 그림마다 새 꼴이라 이 effect 는 그림마다 다시 건다
  }, [motion, confirm, latest])
  return confirm
}
