import { useCallback, useRef, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'

/**
 * 일시정지 창이 어떻게 떴는가 — 창 [+0x290] 과 펼침이 이것으로 갈린다 (2026-10-14 직접 뜸):
 * ```
 * '별표'  '*' 처리 0x49930 · 0x463e6 → 0x741a1(창, 0, 0x3cdd1, 0x3c159, 장면) 뒤 [창+0x290] = 0 (0x49936~0x49940 · 0x463ec~0x463f4)
 *         → 0x754f8 첫 갈래(7550a~75552)가 다음 갱신에 펼침을 끄고 그 갱신에 키를 받으며, [+0x215] 면 다음 갱신에 줄임 없이 닫는다
 * '복귀'  [조작방법] 뷰어 닫기 0x3ca8c · [설정] 닫기 0x3cb70 · 0x3cd2a — 떠 있는 창(뷰어 · 설정 판) 위라 0x741a0 이 대기 칸에만
 *         적고, 그 창의 [+0x290] = 0 · [+0x215] = 1 (0x3ca98~0x3caa6 · 0x3cb96~0x3cb9c) → 다음 갱신 첫 갈래가 줄임 없이 닫고 0x75440 이
 *         메뉴를 0x741a0 으로 띄운다([+0x290] = 1). 그 갱신이 75556 펼침 갈래로 이어져 목표 0 인 메뉴는 그 자리에서 펼침을 마친다.
 *         닫힘은 줄임(240 → 120 → 닫힘, 두 갱신)이다
 * '질문뒤' 질문 [아니오](하위 1 0x3c7a6~0x3c7d6) · 알림 [확인](하위 6 0x3cd5c) — 닫힘 콜백이라 역시 대기 칸이고, 질문 창은 줄임 갈래
 *         (0x7558a~0x755d8 — 경기 장면 [+0x24e] 라 폭 0)에서 닫히며 0x75440 뒤 곧장 돌아간다(755d8) → 메뉴는 [+0x290] = 1 로
 *         한 갱신 펼침(그동안 그리기 콜백 · 키 없음) 뒤 선다. 닫힘은 줄임(두 갱신)이다
 * ```
 */
export type InGameMenuOpening = '별표' | '복귀' | '질문뒤'

/**
 * 창이 닫기를 맡는다 — `finish` 는 창이 치워진 갱신에 부른다. 창이 키를 안 받는 때(펼침 · 줄임 중, 질문 창이 떠 있음)면 아무것도
 * 안 하고 true, 창이 이미 내려간 자리(질문 [예] 뒤 · 뷰어로 넘어감)면 false — 부르는 쪽이 곧바로 닫는다.
 */
export type InGameMenuCloser = (finish: () => void) => boolean

export interface InGameMenuState {
  readonly isOpen: boolean
  /** 메뉴 객체(장면 +0xf30)의 커서 칸 — `InGameMenu` 의 `cursor`·`onCursorChange` 에 넘긴다 */
  readonly cursor: number
  readonly setCursor: (cursor: number) => void
  /** '*'·소프트키1 — 닫혀 있으면 **새로 연다**(커서 0), 열려 있으면 닫는다(창이 떠 있으면 창의 닫힘을 따른다) */
  readonly toggle: () => void
  /**
   * 닫는다 (계속·CLR·'*', 또는 [조작방법]·[설정]으로 넘어갈 때). 일시정지 창이 떠 있으면 원본처럼 [창+0x215] 닫힘을 탄다 —
   * '별표' 창은 한 갱신, 그 밖은 두 갱신 뒤에 내려가고 그동안 메뉴는 그대로 그려지며 경기는 멈춰 있다(0x754f9 는 늘 1).
   */
  readonly close: () => void
  /** [조작방법]·[설정]에서 돌아온다 — **커서를 그대로 두고** 다시 띄운다 */
  readonly reopen: () => void
  /**
   * 판이 왼쪽에서 밀려 드는가 — 일시정지 창을 띄우는 곳마다 [장면+0x1954] = 0 · [+0x1958] = 1 로 되돌린다
   * ('*' 0x3c02c 0x3c03c~0x3c04e · 뷰어 닫기 0x3caaa~0x3cab4 · 설정 닫기 0x3cb8a~0x3cb94 · 0x3cd44~0x3cd4e ·
   * 질문 [아니오] 0x3c7ce~0x3c7d6(0x3ca32) — 2026-10-14 다시 떴다. 예전 "다시 띄우면 안 되돌린다" 는 틀렸다).
   * `InGameMenu` 의 `slidesIn` 에 넘긴다.
   */
  readonly slidesIn: boolean
  /** 지금 창이 어떻게 떴는가 — `InGameMenu` 의 `opening` 에 넘긴다 */
  readonly opening: InGameMenuOpening
  /** `InGameMenu` 가 창을 세우면 닫기를 맡긴다 — `InGameMenu` 의 `bindCloser` 에 넘긴다 */
  readonly bindCloser: (closer: InGameMenuCloser | null) => void
}

/**
 * 경기 중 메뉴 '\*' 의 열림과 커서.
 *
 * 원본 커서는 메뉴 객체 `장면 +0xf30` 의 +0xc/+0x10 이고, 0 으로 되돌리는 곳은 **'\*' 로 여는 `0x3c02c` 하나뿐**이다
 * (`0x6c00c(메뉴, 0, 0)` — 0x6c00c 를 이 객체에 부르는 곳은 0x3c056 뿐, 0x3c02c 를 부르는 곳은 '\*' 처리 0x49944 · 0x463f8).
 * [조작방법] 뷰어를 닫을 때 `0x3ca36` 과 [설정]에서 돌아올 때는 하위 0 으로 돌리고 일시정지 팝업
 * `0x741a0(…, 그리기 0x3cdd0, 키 0x3c158)` 만 다시 띄우며 메뉴 객체는 건드리지 않는다 — 그래서 **커서가 남는다**.
 * 질문 창(나가기·다시하기·자동진행)에서 돌아올 때도 같은 객체라 남는다 (`InGameMenu` 가 안에서 들고 있다).
 */
export function useInGameMenuState(): InGameMenuState {
  const [isOpen, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [slidesIn, setSlidesIn] = useState(false)
  const [opening, setOpening] = useState<InGameMenuOpening>('별표')
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  const closerRef = useRef<InGameMenuCloser | null>(null)

  const closeAtOnce = useCallback(() => {
    isOpenRef.current = false
    setOpen(false)
  }, [])
  const close = useCallback(() => {
    const closer = closerRef.current
    if (closer !== null && closer(closeAtOnce)) return
    closeAtOnce()
  }, [closeAtOnce])
  const reopen = useCallback(() => {
    isOpenRef.current = true
    setSlidesIn(true)
    setOpening('복귀')
    setOpen(true)
  }, [])
  const toggle = useCallback(() => {
    if (isOpenRef.current) return close()
    // 0x3c02c 맨 앞 0x3c036 — 울리던 소리를 끊는다(0x6e418)
    activeSound().stop()
    // 0x3c02c → 0x6c00c(메뉴, 0, 0) — 새로 열면 첫 칸
    isOpenRef.current = true
    setCursor(0)
    // 0x3c03c~0x3c04e — [장면+0x1954] = 0 · [장면+0x1958] = 1
    setSlidesIn(true)
    setOpening('별표')
    setOpen(true)
  }, [close])
  const bindCloser = useCallback((closer: InGameMenuCloser | null) => {
    closerRef.current = closer
  }, [])

  return { isOpen, cursor, setCursor, toggle, close, reopen, slidesIn, opening, bindCloser }
}
