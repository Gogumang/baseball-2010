import { useEffect } from 'react'

/** GP 결과 창 닫기 키 — 확인 · 취소 (관리 화면 결과 창과 같은 처리, 0x742a9) */
export function useDetailCloseKeys(isDetailOpen: boolean, onCloseDetail: (() => void) | undefined) {
  useEffect(() => {
    if (!isDetailOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      onCloseDetail?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDetailOpen, onCloseDetail])
}
