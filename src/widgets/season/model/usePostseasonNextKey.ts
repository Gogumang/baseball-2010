import { useEffect, useRef } from 'react'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** 0x13da0 · 0x9dc8 의 확인 키 — `[+0x40]` 이 −5(OK) 또는 0x35('5') 일 때만 다음으로 */
const POSTSEASON_NEXT_KEYS: ReadonlySet<string> = new Set(['Enter', '5'])

/**
 * 대진표의 확인 키 (나리 128 키 0x13da0 · 시즌 0xef 키 0x9dc8 공통). `onNext` 가 없으면(팝업이 떠 있으면) 듣지 않는다 —
 * 그동안은 팝업이 키를 받는다. 누르고 있는 키의 되풀이(repeat)는 새 누름이 아니라 거른다.
 */
export function usePostseasonNextKey(onNext: (() => void) | undefined): void {
  const onNextRef = useRef(onNext)
  useMirrorRef(onNextRef, onNext)
  const isListening = onNext !== undefined
  useEffect(() => {
    if (!isListening) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !POSTSEASON_NEXT_KEYS.has(event.key)) return
      event.preventDefault()
      onNextRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isListening])
}
