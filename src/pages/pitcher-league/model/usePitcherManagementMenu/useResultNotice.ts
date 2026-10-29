import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** 알림 글을 띄우고 그 창이 닫힐 때 할 일을 둔다 (없으면 null) */
export type ShowNoticeThen = (text: string, then: (() => void) | null) => void

/**
 * 알림 창 글과 결과 상태 125 · 127 — 창(상세 결과 창 · 알림 창)이 닫힐 때까지 105 가 아니다. 알림 창이 닫히면 125 틀 0x18dd8 이
 * (휴식 · 상세 창은 0x1b5b8 · 0x1b466 이) `0xbcb49(0x69)` 로 105 에 다시 들어온다 — 알림 쪽 그 일을 `noticeThenRef` 에 둔다.
 *
 * 돌려주는 차례: [알림 글, 알림 글 쓰기, 결과 창 여부 쓰기, 알림 띄우고 닫힌 뒤 할 일 두기, 알림 닫기]
 */
export function useResultNotice(
  onResultWindowChange: ((isOpen: boolean) => void) | undefined,
): readonly [string, Dispatch<SetStateAction<string>>, Dispatch<SetStateAction<boolean>>, ShowNoticeThen, () => void] {
  const [notice, setNotice] = useState('')
  const [isResultWindowOpen, setIsResultWindowOpen] = useState(false)
  const noticeThenRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    onResultWindowChange?.(isResultWindowOpen)
    // 창이 뜬 채 화면이 내려가면(장면 전환) 풀어 둔다
    return () => {
      if (isResultWindowOpen) onResultWindowChange?.(false)
    }
  }, [isResultWindowOpen, onResultWindowChange])

  const showNoticeThen = useCallback<ShowNoticeThen>((text, then) => {
    noticeThenRef.current = then
    setNotice(text)
  }, [])

  /** 알림 창 닫기 — 결과 상태(125)의 알림이면 그때 105 에 다시 들어온다(125 틀 0x18dd8) */
  const dismissNotice = useCallback(() => {
    setNotice('')
    setIsResultWindowOpen(false)
    const then = noticeThenRef.current
    noticeThenRef.current = null
    then?.()
  }, [])

  return [notice, setNotice, setIsResultWindowOpen, showNoticeThen, dismissNotice]
}
