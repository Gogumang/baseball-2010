import { useCallback, useState } from 'react'
import {
  announceHiddenOpens, closeHiddenOpenWindow, EMPTY_HIDDEN_OPEN_WINDOW,
} from '@/entities/collection/model/hiddenOpenNotice'
import type { HiddenOpenWindow } from '@/entities/collection/model/hiddenOpenNotice'

/**
 * **히든 오픈 알림 — 공용 창 [0x140005c]** (0x62368 → 0x6249e `0x74ef5(창, 글, 종류 1, 0, 0)`).
 * 원본 창은 장면과 상관없는 전역 객체라 어느 화면 위에도 뜬다. 웹은 앱이 하나 들고 모든 화면 위에 그린다.
 * 띄우는 쪽은 **새로 연 k** 만 넘긴다 — 0x62368 셋째 인자 0 은 이미 열린 k 에 창을 안 띄운다(0x6237c 0x61f5c).
 * 떠 있는 동안 장면이 멈추는 것(0x754f9)은 앱이 `CommonWindowOpenContext` 로 알린다 — 키는 상자가 잡고, 경기 장면은 갱신까지 선다.
 */
export function useHiddenOpenNotice() {
  const [window, setWindow] = useState<HiddenOpenWindow>(EMPTY_HIDDEN_OPEN_WINDOW)
  /** 창을 새로 띄운 횟수 — 대기 글로 다시 띄울 때 상자를 새로 세운다(0x75440 → 0x741a0, 펼침부터) */
  const [serial, setSerial] = useState(0)
  const announce = useCallback((ids: readonly number[]) => {
    if (ids.length === 0) return
    setWindow((current) => announceHiddenOpens(current, ids))
  }, [])
  const close = useCallback(() => {
    setWindow(closeHiddenOpenWindow)
    setSerial((previous) => previous + 1)
  }, [])
  return { text: window.shown, serial, announce, close }
}
