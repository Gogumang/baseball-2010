import { useCallback, useRef, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'

export interface InGameMenuState {
  readonly isOpen: boolean
  /** 메뉴 객체(장면 +0xf30)의 커서 칸 — `InGameMenu` 의 `cursor`·`onCursorChange` 에 넘긴다 */
  readonly cursor: number
  readonly setCursor: (cursor: number) => void
  /** '*'·소프트키1 — 닫혀 있으면 **새로 연다**(커서 0), 열려 있으면 닫는다 */
  readonly toggle: () => void
  /** 닫는다 (계속·CLR·'*', 또는 [조작방법]·[설정]으로 넘어갈 때) */
  readonly close: () => void
  /** [조작방법]·[설정]에서 돌아온다 — **커서를 그대로 두고** 다시 띄운다 */
  readonly reopen: () => void
}

/**
 * 경기 중 메뉴 '\*' 의 열림과 커서.
 *
 * 원본 커서는 메뉴 객체 `장면 +0xf30` 의 +0xc/+0x10 이고, 0 으로 되돌리는 곳은 **'\*' 로 여는 `0x3c02c` 하나뿐**이다
 * (`0x6c00c(메뉴, 0, 0)` — 0x6c00c 를 이 객체에 부르는 곳은 0x3c056 뿐, 0x3c02c 를 부르는 곳은 '\*' 처리 0x49944 · 0x463f8).
 * [조작방법] 뷰어를 닫을 때 `0x3ca36` 과 [설정]에서 CLR 로 돌아올 때 `0x3cb0e` 는 하위 0 으로 돌리고 일시정지 팝업
 * `0x741a0(…, 그리기 0x3cdd0, 키 0x3c158)` 만 다시 띄우며 메뉴 객체는 건드리지 않는다 — 그래서 **커서가 남는다**.
 * 질문 창(나가기·다시하기·자동진행)에서 돌아올 때도 같은 객체라 남는다 (`InGameMenu` 가 안에서 들고 있다).
 */
export function useInGameMenuState(): InGameMenuState {
  const [isOpen, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  const close = useCallback(() => setOpen(false), [])
  const reopen = useCallback(() => setOpen(true), [])
  const toggle = useCallback(() => {
    if (isOpenRef.current) {
      isOpenRef.current = false
      return setOpen(false)
    }
    // 0x3c02c 맨 앞 0x3c036 — 울리던 소리를 끊는다(0x6e418)
    activeSound().stop()
    // 0x3c02c → 0x6c00c(메뉴, 0, 0) — 새로 열면 첫 칸
    isOpenRef.current = true
    setCursor(0)
    setOpen(true)
  }, [])

  return { isOpen, cursor, setCursor, toggle, close, reopen }
}
