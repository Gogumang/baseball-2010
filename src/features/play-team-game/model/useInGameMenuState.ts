import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { isCommonWindowShown, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

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
 * **'*' 로 메뉴를 여는 그림의 남은 갱신** — 경기 장면 프레임 0x52c50 은 공용 창 게이트 0x754f9 를 52cc6 에서 **키보다 먼저** 보고,
 * 키 0x498d4(52d9e — '*' 49918 → 0x741a0 · 0x3c02c 가 창을 세운다) 뒤 52e14~ 의 갱신 표를 다시 묻지 않고 돈다. 그래서 '*' 를 누른
 * 그림에도 그 상태의 갱신(0x10 이면 0x39c5c)이 한 번 돈다. '*' 가 장면 키 칸으로 들어 그 틀의 키 자리에서 열리면(`pressStar` ·
 * `isRunningSceneKeys`) 그 틀의 갱신이 뒤이어 그대로 돈다. 칸이 없어 키를 받은 자리에서 곧바로 열면 웹은 다음 틱이 이미 멈춘 장면을
 * 보므로, 그 한 틱을 여는 자리에서 곧바로 돌린다 — 그 틱이 있는 부품(조준 `AimCursor`)이 여기에 건다.
 */
const starOpenFrameListeners = new Set<() => void>()

/** '*' 로 메뉴를 새로 열기 직전에 부른다 — 돌려준 함수로 뗀다 */
export function subscribeInGameMenuStarOpen(listener: () => void): () => void {
  starOpenFrameListeners.add(listener)
  return () => {
    starOpenFrameListeners.delete(listener)
  }
}

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
   * '*' 키를 받았다 — 창이 없으면 경기 장면 키 칸에 넣어 **받은 다음 틀의 키 0x498d4**('*' 가지 49918~49948)가 연다(`sceneKeyLatch`).
   * 창(메뉴 · 설정 따위)이 서 있으면 경기 장면 키는 안 돌고(52cc6) 키는 창 0x754f9 몫이라 그 자리에서 `toggle` 한다
   */
  readonly pressStar: () => void
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
  /**
   * 단말 일시정지(멈춤 콜백 0x463ac)가 연다 — 463e6 0x741a1(창, 0, 0x3cdd1, 0x3c159, 장면) · 463f4 [창+0x290] = 0 · 463f8 0x3c02c 로
   * '*' 와 같은 창('별표')을 그 자리에서 세운다. 키 틀 밖이라 그 틀의 갱신(`subscribeInGameMenuStarOpen`)은 없다. 이미 열려 있으면 아무 일 없다
   */
  readonly openFromPause: () => void
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
  const openAsStar = useCallback(() => {
    // 0x3c02c 맨 앞 0x3c036 — 울리던 소리를 끊는다(0x6e418)
    activeSound().stop()
    // 0x3c02c → 0x6c00c(메뉴, 0, 0) — 새로 열면 첫 칸
    isOpenRef.current = true
    setCursor(0)
    // 0x3c03c~0x3c04e — [장면+0x1954] = 0 · [장면+0x1958] = 1
    setSlidesIn(true)
    setOpening('별표')
    setOpen(true)
  }, [])
  const toggle = useCallback(() => {
    if (isOpenRef.current) return close()
    // 그 그림의 키 뒤 갱신(52e14~) — 창은 이미 섰지만 게이트(52cc6)는 키 앞에서 지나갔다
    for (const listener of [...starOpenFrameListeners]) listener()
    openAsStar()
  }, [close, openAsStar])
  const openFromPause = useCallback(() => {
    if (isOpenRef.current) return
    openAsStar()
  }, [openAsStar])
  const pressStar = useCallback(() => {
    if (isOpenRef.current || isGameSceneFrozen()) return toggle()
    pushSceneKey(() => {
      // 받은 틀 뒤에 다른 길로 창이 섰으면 그 틀은 키가 없다(52cc6) — 칸은 그 틀에 비워진다
      if (!isOpenRef.current) toggle()
    })
  }, [toggle])
  const bindCloser = useCallback((closer: InGameMenuCloser | null) => {
    closerRef.current = closer
  }, [])

  return { isOpen, cursor, setCursor, toggle, pressStar, close, reopen, slidesIn, opening, bindCloser, openFromPause }
}

/**
 * **탭을 숨기면 경기 중 메뉴를 연다** — 앱 일시정지 0x2da0 이 2db4 에서 장면 vt+0x18 을 부르고, 경기 장면 0x104 의 그 칸
 * (vtable 0xcfa0c [6] = 0x463ac, 직접 뜸 r215)은:
 * ```
 * 463b2  0x457cc · [장면+0x1084] = 1 · [창+0x250] = 1
 * 463ce  [창+9](공용 창이 떠 있음) == 0 이고 0xd ≤ 상태 [장면+0x1c] ≤ 0x15 면 463e6 0x741a1 · [창+0x290] = 0 · 0x3c02c(장면)
 * ```
 * '*'(4991c 상태 0xd~0x15)와 같은 메뉴다. 웹은 탭 숨김을 단말 일시정지로 본다(`app/model/useSound.useSoundPauseOnHide`).
 * `canOpen` 은 그 화면에서 '*' 가 메뉴를 여는 때(상태 0xd~0x15)이고 하위 창(조작방법 · 설정)이 없을 때다 — 공용 창은 여기서 본다.
 */
export function useInGameMenuOpenOnHide(menu: Pick<InGameMenuState, 'openFromPause'>, canOpen: boolean): void {
  const canOpenRef = useRef(canOpen)
  canOpenRef.current = canOpen
  const { openFromPause } = menu
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      if (!canOpenRef.current || isCommonWindowShown()) return
      openFromPause()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [openFromPause])
}
