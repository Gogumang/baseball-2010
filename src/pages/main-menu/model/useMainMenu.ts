import { useEffect, useRef, useState } from 'react'
import { initialMainMenu, listCursorOf, reduceMainMenu, topCursorOf } from '@/pages/main-menu/model/mainMenu'
import type {
  GameStartCursor, MainMenuAction, MainMenuEffect, MainMenuOpenTier, MainMenuState, NariGameReady,
} from '@/pages/main-menu/model/mainMenu'

/**
 * 웹 키 → 메뉴 동작. 하위 4·5·9 갱신(0x29454 · 0x28cb0 · 0x28ad4)이 같은 키를 본다:
 *   −1(↑) · −3(←) · '2' · '4' → 방향 −1(앞 칸) · −2(↓) · −4(→) · '6' · '8' → 방향 −2(다음 칸) · −5(OK) · '5' → 시작 ·
 *   CLR(−16) → 하위 5·9 만 처음 메뉴로 (하위 4 는 CLR 을 안 본다 — `reduceMainMenu` '뒤로').
 */
function actionOfKey(key: string): MainMenuAction | null {
  switch (key) {
    case 'Enter':
    case '5':
      return { type: '시작' }
    case 'Escape':
    case 'Backspace':
      return { type: '뒤로' }
    case 'ArrowUp':
    case 'ArrowLeft':
    case '2':
    case '4':
      return { type: '커서', step: -1 }
    case 'ArrowDown':
    case 'ArrowRight':
    case '6':
    case '8':
      return { type: '커서', step: 1 }
    default:
      return null
  }
}

/**
 * 메뉴 상태와 화면 단위 키 입력 (`actionOfKey`).
 * `isSheetOpen` 은 예전 셀렉트박스 시절에 키를 시트에 넘겨주던 자리다 (지금은 늘 false 로 들어온다).
 */
export function useMainMenu(
  hasSavedGame: boolean,
  isSheetOpen: boolean,
  onEffect: (effect: Exclude<MainMenuEffect, null>) => void,
  /**
   * 전역기록 칸 — +0x4d(일반모드 경기 중간 저장) · +0x3c(마지막 모드) · 나리 두 편 `+0x40+m && +0x4c+m`.
   * 안 넘기면 저장 없음 · 1(새 저장 — 생성자 0x9f26c) · 나리 곧장 경기 없음
   */
  globalRecord: {
    readonly isGeneralGameInProgress: boolean
    readonly lastPlayedMode: number
    readonly nariGameReady?: NariGameReady
  } = {
    isGeneralGameInProgress: false,
    lastPlayedMode: 1,
  },
  /** 장면을 세울 때의 첫 단(`[0x140006c]` — 4 처음 메뉴 · 5 게임시작 목록, 생성자 0x234d4). 안 넘기면 4 */
  openTier: MainMenuOpenTier = 4,
  /** 게임시작 목록 커서 전역 [0x1552d24] — 첫 단 5 면 이 칸에 서고, 커서가 움직이면 고쳐 적는다. 안 넘기면 0 · 안 적는다 */
  gameStartCursor?: GameStartCursor,
  /**
   * 처음 메뉴 바퀴 커서 `[this+0xe8]` — 같은 장면 안(하위 6~10)을 다녀오면 그 칸에 선다. 루트가 들고 화면이 고쳐 적는다.
   * 안 넘기면 늘 0 칸
   */
  topMenuCursor?: GameStartCursor,
  /**
   * 키를 버리는 동안 — 하위 5·9 갱신(0x28cb0 · 0x28ad4)은 띠가 자라는 동안(`[this+0xe2]` ≠ 0) 키를 통째로 버린다.
   * 렌더마다 고쳐 읽는다
   */
  isInputBlocked = false,
): { state: MainMenuState; dispatch: (action: MainMenuAction) => void } {
  const [state, setState] = useState<MainMenuState>(
    () => initialMainMenu(
      hasSavedGame, openTier, openTier === 5 ? gameStartCursor?.current ?? 0 : 0, topMenuCursor?.current ?? 0,
    ),
  )

  const stateRef = useRef(state)
  stateRef.current = state
  const onEffectRef = useRef(onEffect)
  onEffectRef.current = onEffect
  const hasSavedRef = useRef(hasSavedGame)
  hasSavedRef.current = hasSavedGame
  const isSheetOpenRef = useRef(isSheetOpen)
  isSheetOpenRef.current = isSheetOpen
  const globalRecordRef = useRef(globalRecord)
  globalRecordRef.current = globalRecord
  const gameStartCursorRef = useRef(gameStartCursor)
  gameStartCursorRef.current = gameStartCursor
  const topMenuCursorRef = useRef(topMenuCursor)
  topMenuCursorRef.current = topMenuCursor
  const isInputBlockedRef = useRef(isInputBlocked)
  isInputBlockedRef.current = isInputBlocked

  // setState 업데이터 안에서 부모 콜백을 부르면 StrictMode 가 두 번 부른다 — ref 로 읽고 한 번만 반영한다.
  const dispatchRef = useRef((action: MainMenuAction) => {
    if (isInputBlockedRef.current) return
    const { isGeneralGameInProgress, lastPlayedMode, nariGameReady } = globalRecordRef.current
    const result = reduceMainMenu(
      stateRef.current, action, hasSavedRef.current, isGeneralGameInProgress, lastPlayedMode, nariGameReady,
    )
    stateRef.current = result.state
    const listCursor = listCursorOf(result.state)
    if (gameStartCursorRef.current !== undefined && listCursor !== null) gameStartCursorRef.current.current = listCursor
    if (topMenuCursorRef.current !== undefined) topMenuCursorRef.current.current = topCursorOf(result.state)
    setState(result.state)
    if (result.effect !== null) onEffectRef.current(result.effect)
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSheetOpenRef.current) return
      // 버튼에 포커스가 있으면 브라우저가 Enter 를 클릭으로 처리한다 — 두 번 실행되지 않게 비켜 준다.
      if (event.target instanceof HTMLButtonElement) return

      const action = actionOfKey(event.key)
      if (action === null) return
      event.preventDefault()
      dispatchRef.current(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { state, dispatch: (action) => dispatchRef.current(action) }
}
